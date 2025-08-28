/**
 * Simple SD Workflow
 *
 * Universal workflow for all Stable Diffusion models using CheckpointLoaderSimple
 * Supports SD1.5, SDXL, SD3.5 and other models with built-in encoders
 * E.g., sd3.5_medium_incl_clips_t5xxlfp8scaled.safetensors, sd_xl_base_1.0.safetensors
 *
 * Features:
 * - Dynamic text-to-image (t2i) and image-to-image (i2i) mode switching
 * - Automatic node connection based on input parameters
 * - Backward compatibility with existing API calls
 */
import { PromptBuilder } from '@saintno/comfyui-sdk';

import { generateUniqueSeeds } from '../../../../utils/src/number';
import { type ModelConfig, getModelConfig } from '../config/modelRegistry';
import { type ComponentConfig, getAllComponentsWithNames } from '../config/systemComponents';
import { DEFAULT_NEGATIVE_PROMPT, WORKFLOW_DEFAULTS } from '../constants';
import type { WorkflowContext } from '../services/workflowBuilder';

/**
 * Parameters for SimpleSD workflow
 */
export interface SimpleSDParams extends Record<string, any> {
  cfg?: number; // Guidance scale for generation
  customVAE?: string; // Custom VAE override
  denoise?: number; // Denoising strength for i2i mode (0.0 - 1.0, default: 0.75)
  height?: number; // Image height
  imageUrl?: string; // Frontend parameter: Input image URL for i2i mode
  imageUrls?: string[]; // Alternative: Array of image URLs (uses first one)
  inputImage?: string; // Internal parameter: Input image URL/path for i2i mode
  isCustomSD?: boolean; // Legacy flag for custom SD models
  mode?: 't2i' | 'i2i'; // Generation mode: text-to-image or image-to-image
  negativePrompt?: string; // Negative prompt text

  prompt?: string; // Text prompt for generation
  sampler?: string; // Sampling algorithm (default: 'euler')
  samplerName?: string; // Alternative name for sampler (backward compatibility)
  scheduler?: string; // Noise scheduler (default: varies by model type)
  seed?: number; // Random seed for generation
  steps?: number; // Number of denoising steps
  strength?: number; // Frontend parameter: Image modification strength (maps to denoise)
  width?: number; // Image width
}

/**
 * Determine if a model should use external VAE
 * SD3.5 variants (sd35, custom-sd) should not use external VAE
 * SD1.5 and SDXL variants should use external VAE if available
 *
 * @param modelConfig - Model configuration from registry
 * @returns Whether to attach external VAE
 */
function shouldAttachVAE(modelConfig: ModelConfig | null): boolean {
  if (!modelConfig) return false;

  // SD3.5 models with external encoders should not use external VAE
  if (modelConfig.variant === 'sd35') {
    return false;
  }

  // SD3.5 models with built-in encoders (inclclip) should not use external VAE
  // Check by model family SD3 which indicates SD3.5 architecture
  if (modelConfig.modelFamily === 'SD3') {
    return false;
  }

  // SD1.5 and SDXL variants should use external VAE if available
  if (modelConfig.modelFamily === 'SD1' || modelConfig.modelFamily === 'SDXL') {
    return true;
  }

  // Default: don't use external VAE for other models
  return false;
}

/**
 * Get optimal VAE for a model based on its family
 *
 * @param modelConfig - Model configuration from registry
 * @returns VAE filename or undefined if none found
 */
function getOptimalVAEForModel(modelConfig: ModelConfig | null): string | undefined {
  if (!modelConfig) return undefined;

  try {
    // Find VAEs for the model family
    const availableVAEs = getAllComponentsWithNames({
      modelFamily: modelConfig.modelFamily as ComponentConfig['modelFamily'],
      type: 'vae',
    });

    if (availableVAEs.length === 0) {
      return undefined;
    }

    // Sort by priority (lower number = higher priority)
    const sortedVAEs = availableVAEs.sort((a, b) => a.config.priority - b.config.priority);

    return sortedVAEs[0].name;
  } catch {
    // If there's an error getting VAE, fall back to built-in VAE
    return undefined;
  }
}

/**
 * Build Simple SD workflow for models with CheckpointLoaderSimple compatibility
 * Universal workflow supporting SD1.5, SDXL, SD3.5 and other Stable Diffusion variants
 *
 * @param modelFileName - The checkpoint model filename
 * @param params - Generation parameters with optional mode and inputImage
 * @param context - Workflow context with service layer access
 * @returns PromptBuilder configured for the specified mode
 */
export async function buildSimpleSDWorkflow(
  modelFileName: string,
  params: SimpleSDParams,
  context: WorkflowContext,
): Promise<PromptBuilder<any, any, any>> {
  // Map frontend parameters to workflow parameters
  // Frontend sends imageUrl and strength, we need inputImage and denoise
  const mappedParams = {
    ...params,
    denoise: params.strength ?? params.denoise,
    inputImage: params.imageUrl || params.imageUrls?.[0] || params.inputImage,
  };

  const {
    prompt,
    width,
    height,
    steps,
    seed,
    cfg,
    mode,
    inputImage,
    denoise,
    samplerName,
    sampler,
    scheduler,
    negativePrompt,
    isCustomSD,
    customVAE,
  } = mappedParams;

  const actualSeed = seed ?? generateUniqueSeeds(1)[0];

  // Determine if we're in image-to-image mode
  // Auto-detect mode based on presence of input image if mode not specified
  const detectedMode = mode || (inputImage ? 'i2i' : 't2i');
  const isI2IMode = detectedMode === 'i2i' && Boolean(inputImage);

  // Get model configuration to determine VAE handling and default parameters
  const modelConfig = getModelConfig(modelFileName) || null;

  // Set defaults based on model family
  const defaultSamplerName = WORKFLOW_DEFAULTS.SD.SAMPLER;
  const defaultScheduler =
    modelConfig?.modelFamily === 'SD3'
      ? WORKFLOW_DEFAULTS.SD.SCHEDULER.SD3
      : WORKFLOW_DEFAULTS.SD.SCHEDULER.SD1; // SD1 and SDXL use same scheduler

  const finalSamplerName = samplerName ?? sampler ?? defaultSamplerName;
  const finalScheduler = scheduler ?? defaultScheduler;
  const finalNegativePrompt = negativePrompt ?? DEFAULT_NEGATIVE_PROMPT;

  // Get optimal VAE
  let selectedVAE: string | undefined;

  // Custom SD models: use fixed VAE filename from modelResolverService
  // The service will check if the fixed VAE file exists and return it
  if (isCustomSD && context?.modelResolverService) {
    selectedVAE = await context.modelResolverService.selectVAE({
      customVAE: customVAE, // Still allow override if needed
      isCustomSD: true,
      modelFileName,
    });
  }
  // Non-custom models: auto-detect VAE based on model family
  else if (shouldAttachVAE(modelConfig)) {
    // Use the static system components approach from original implementation
    selectedVAE = getOptimalVAEForModel(modelConfig);

    // If static approach didn't find VAE, try service layer as fallback
    if (!selectedVAE && context?.modelResolverService) {
      selectedVAE = await context.modelResolverService.selectVAE({
        customVAE: undefined,
        isCustomSD: false,
        modelFileName,
      });
    }
  }
  // SD3 models or when no VAE found: use built-in VAE (selectedVAE remains undefined)

  // Base workflow for models with built-in CLIP/T5 encoders
  /* eslint-disable sort-keys-fix/sort-keys-fix */
  const workflow: any = {
    '1': {
      _meta: { title: 'Load Checkpoint' },
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: modelFileName,
      },
    },
    '2': {
      _meta: { title: 'Positive Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['1', 1], // Use checkpoint's built-in CLIP
        text: prompt || '',
      },
    },
    '3': {
      _meta: { title: 'Negative Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['1', 1], // Use checkpoint's built-in CLIP
        text: finalNegativePrompt,
      },
    },
    '4': {
      _meta: { title: 'Empty Latent' },
      class_type: 'EmptyLatentImage',
      inputs: {
        batch_size: 1,
        height: height ?? WORKFLOW_DEFAULTS.IMAGE.HEIGHT,
        width: width ?? WORKFLOW_DEFAULTS.IMAGE.WIDTH,
      },
    },
    '5': {
      _meta: { title: 'KSampler' },
      class_type: 'KSampler',
      inputs: {
        cfg: cfg ?? WORKFLOW_DEFAULTS.SAMPLING.CFG,
        denoise:
          denoise ??
          (isI2IMode ? WORKFLOW_DEFAULTS.SD.DENOISE.I2I : WORKFLOW_DEFAULTS.SD.DENOISE.T2I),
        latent_image: isI2IMode ? ['IMG_ENCODE', 0] : ['4', 0], // Dynamic connection based on mode
        model: ['1', 0],
        negative: ['3', 0],
        positive: ['2', 0],
        sampler_name: finalSamplerName,
        scheduler: finalScheduler,
        seed: actualSeed,
        steps: steps ?? WORKFLOW_DEFAULTS.SAMPLING.STEPS,
      },
    },
    '6': {
      _meta: { title: 'VAE Decode' },
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: selectedVAE ? ['VAE_LOADER', 0] : ['1', 2], // Use external or built-in VAE
      },
    },
    '7': {
      _meta: { title: 'Save Image' },
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'SimpleSD',
        images: ['6', 0],
      },
    },
  };
  /* eslint-enable sort-keys-fix/sort-keys-fix */

  // Add VAE Loader node if using external VAE
  if (selectedVAE) {
    workflow['VAE_LOADER'] = {
      _meta: { title: 'VAE Loader' },
      class_type: 'VAELoader',
      inputs: {
        vae_name: selectedVAE,
      },
    };
  }

  // Add dynamic nodes based on mode
  if (isI2IMode) {
    // Image-to-image mode: Add LoadImage and VAEEncode nodes
    workflow['IMG_LOAD'] = {
      _meta: { title: 'Load Input Image' },
      class_type: 'LoadImage',
      inputs: {
        image: inputImage || '',
      },
    };

    workflow['IMG_ENCODE'] = {
      _meta: { title: 'VAE Encode Input' },
      class_type: 'VAEEncode',
      inputs: {
        pixels: ['IMG_LOAD', 0],
        vae: selectedVAE ? ['VAE_LOADER', 0] : ['1', 2], // Use external or built-in VAE
      },
    };
  }
  // Text-to-image mode uses the existing EmptyLatentImage node ('4')

  // Create dynamic input parameters list
  const inputParams = [
    'prompt',
    'width',
    'height',
    'steps',
    'seed',
    'cfg',
    'samplerName',
    'scheduler',
  ];
  if (isI2IMode) {
    inputParams.push('inputImage', 'denoise');
  }

  // Create PromptBuilder
  const builder = new PromptBuilder(workflow, inputParams, ['images']);

  // Set output node
  builder.setOutputNode('images', '7');

  // Set input node mappings
  builder.setInputNode('prompt', '2.inputs.text');
  builder.setInputNode('width', '4.inputs.width');
  builder.setInputNode('height', '4.inputs.height');
  builder.setInputNode('steps', '5.inputs.steps');
  builder.setInputNode('seed', '5.inputs.seed');
  builder.setInputNode('cfg', '5.inputs.cfg');
  builder.setInputNode('samplerName', '5.inputs.sampler_name');
  builder.setInputNode('scheduler', '5.inputs.scheduler');

  // Add i2i-specific mappings
  if (isI2IMode) {
    builder.setInputNode('inputImage', 'IMG_LOAD.inputs.image');
    builder.setInputNode('denoise', '5.inputs.denoise');
  }

  // Set input values
  builder
    .input('prompt', prompt || '')
    .input('width', width ?? WORKFLOW_DEFAULTS.IMAGE.WIDTH)
    .input('height', height ?? WORKFLOW_DEFAULTS.IMAGE.HEIGHT)
    .input('steps', steps ?? WORKFLOW_DEFAULTS.SAMPLING.STEPS)
    .input('seed', actualSeed)
    .input('cfg', cfg ?? WORKFLOW_DEFAULTS.SAMPLING.CFG)
    .input('samplerName', finalSamplerName)
    .input('scheduler', finalScheduler);

  // Add i2i-specific input values
  if (isI2IMode) {
    builder.input('inputImage', inputImage);
    builder.input('denoise', denoise ?? WORKFLOW_DEFAULTS.SD.DENOISE.I2I);
  }

  return builder;
}
