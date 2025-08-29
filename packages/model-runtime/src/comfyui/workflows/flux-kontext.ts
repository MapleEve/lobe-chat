import { PromptBuilder } from '@saintno/comfyui-sdk';

import { generateUniqueSeeds } from '@/utils/number';
import {  WORKFLOW_DEFAULTS } from '../constants';
import { getWorkflowFilenamePrefix } from '../config/workflowRegistry';
import type { WorkflowContext } from '../services/workflowBuilder';
import { splitPromptForDualCLIP } from '../utils/promptSplitter';
import { selectOptimalWeightDtype } from '../utils/weightDType';

/**
 * FLUX Kontext Workflow Builder
 *
 * @description Builds 28-step image editing workflow supporting text-to-image and image-to-image
 *
 * @param {string} modelFileName - Model filename
 * @param {Record<string, any>} params - Generation parameters
 * @param {WorkflowContext} context - Workflow context
 * @returns {PromptBuilder<any, any, any>} Built workflow
 */
export async function buildFluxKontextWorkflow(
  modelFileName: string,
  params: Record<string, any>,
  context: WorkflowContext,
): Promise<PromptBuilder<any, any, any>> {
  // Get required components - will throw if not available (workflow cannot run without them)
  const selectedT5Model = await context.modelResolverService.getOptimalComponent('t5', 'FLUX');
  const selectedVAE = await context.modelResolverService.getOptimalComponent('vae', 'FLUX');
  const selectedCLIP = await context.modelResolverService.getOptimalComponent('clip', 'FLUX');

  // Check if there's an input image
  const hasInputImage = Boolean(params.imageUrl || params.imageUrls?.[0]);

  /* eslint-disable sort-keys-fix/sort-keys-fix */
  const workflow: any = {
    '1': {
      _meta: {
        title: 'DualCLIP Loader',
      },
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: selectedT5Model,
        clip_name2: selectedCLIP,
        type: 'flux',
      },
    },
    '2': {
      _meta: {
        title: 'UNET Loader',
      },
      class_type: 'UNETLoader',
      inputs: {
        unet_name: modelFileName,
        weight_dtype: selectOptimalWeightDtype(modelFileName),
      },
    },
    '3': {
      _meta: {
        title: 'VAE Loader',
      },
      class_type: 'VAELoader',
      inputs: {
        vae_name: selectedVAE,
      },
    },
    '4': {
      _meta: {
        title: 'Model Sampling Flux',
      },
      class_type: 'ModelSamplingFlux',
      inputs: {
        base_shift: 0.5, // Required parameter for FLUX models
        height: params.height,
        max_shift: WORKFLOW_DEFAULTS.SAMPLING.MAX_SHIFT,
        model: ['2', 0],
        width: params.width,
      },
    },
    '5': {
      _meta: {
        title: 'CLIP Text Encode (Flux)',
      },
      class_type: 'CLIPTextEncodeFlux',
      inputs: {
        clip: ['1', 0],
        clip_l: '',
        guidance: params.cfg,
        t5xxl: '',
      },
    },
    '6': {
      _meta: {
        title: 'Flux Guidance',
      },
      class_type: 'FluxGuidance',
      inputs: {
        // FluxGuidance requires conditioning input from CLIPTextEncodeFlux output
        conditioning: ['5', 0],
        guidance: params.cfg,
      },
    },
    '8': {
      _meta: {
        title: 'K Sampler Select',
      },
      class_type: 'KSamplerSelect',
      inputs: {
        sampler_name: 'dpmpp_2m', // Use regular DPM++ (no SDE) for i2i
      },
    },
    '9': {
      _meta: {
        title: 'Basic Scheduler',
      },
      class_type: 'BasicScheduler',
      inputs: {
        denoise: params.strength,
        model: ['4', 0],
        scheduler: 'karras',
        steps: params.steps,
      },
    },
    '10': {
      _meta: {
        title: 'Sampler Custom Advanced',
      },
      class_type: 'SamplerCustomAdvanced',
      inputs: {
        guider: ['14', 0], // ✅ BasicGuider provides GUIDER type (handles model/conditioning)
        latent_image: hasInputImage ? ['img_encode', 0] : ['7', 0], // Choose latent source based on input image presence
        noise: ['13', 0], // Random noise for initialization
        sampler: ['8', 0], // Sampling algorithm
        sigmas: ['9', 0], // Noise schedule from BasicScheduler
      },
    },
    '11': {
      _meta: {
        title: 'VAE Decode',
      },
      class_type: 'VAEDecode',
      inputs: {
        samples: ['10', 0],
        vae: ['3', 0],
      },
    },
    '12': {
      _meta: {
        title: 'Save Image',
      },
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: getWorkflowFilenamePrefix('buildFluxKontextWorkflow', context.variant),
        images: ['11', 0],
      },
    },
    '13': {
      _meta: {
        title: 'Random Noise',
      },
      class_type: 'RandomNoise',
      inputs: {
        noise_seed: params.seed ?? generateUniqueSeeds(1)[0],
      },
    },
    '14': {
      _meta: {
        title: 'Basic Guider',
      },
      class_type: 'BasicGuider',
      inputs: {
        conditioning: ['6', 0], // FluxGuidance conditioning output
        model: ['4', 0], // ModelSamplingFlux model
      },
    },
  };
  /* eslint-enable sort-keys-fix/sort-keys-fix */

  // If there's an input image, add image loading and encoding nodes
  if (hasInputImage) {
    workflow['img_load'] = {
      _meta: {
        title: 'Load Image',
      },
      class_type: 'LoadImage',
      inputs: {
        image: params.imageUrl || params.imageUrls?.[0] || '', // Set image URL directly
      },
    };

    workflow['img_encode'] = {
      _meta: {
        title: 'VAE Encode',
      },
      class_type: 'VAEEncode',
      inputs: {
        pixels: ['img_load', 0],
        vae: ['3', 0],
      },
    };
  } else {
    // Text-to-image mode, add empty latent
    workflow['7'] = {
      _meta: {
        title: 'Empty SD3 Latent Image',
      },
      class_type: 'EmptySD3LatentImage',
      inputs: {
        batch_size: WORKFLOW_DEFAULTS.IMAGE.BATCH_SIZE,
        height: params.height,
        width: params.width,
      },
    };
  }

  // Process prompt splitting early in workflow construction
  const { t5xxlPrompt, clipLPrompt } = splitPromptForDualCLIP(params.prompt);

  // Set prompt values directly to workflow nodes instead of using PromptBuilder input mapping
  workflow['5'].inputs.clip_l = clipLPrompt;
  workflow['5'].inputs.t5xxl = t5xxlPrompt;

  // Apply input values to workflow - directly set parameters without intermediate variables
  workflow['5'].inputs.guidance = params.cfg; // CLIPTextEncodeFlux needs guidance
  workflow['6'].inputs.guidance = params.cfg; // FluxGuidance needs guidance
  workflow['9'].inputs.steps = params.steps; // BasicScheduler needs steps
  workflow['13'].inputs.noise_seed = params.seed ?? generateUniqueSeeds(1)[0]; // RandomNoise needs seed

  if (!hasInputImage) {
    // Text-to-image mode: ModelSamplingFlux needs width/height (EmptySD3LatentImage will get it via setInputNode)
    workflow['4'].inputs.width = params.width;
    workflow['4'].inputs.height = params.height;
    workflow['7'].inputs.width = params.width;
    workflow['7'].inputs.height = params.height;
  } else {
    // Image-to-image mode: ModelSamplingFlux still needs width/height for proper sampling
    workflow['4'].inputs.width = params.width;
    workflow['4'].inputs.height = params.height;
  }

  // Create PromptBuilder - removed prompt input parameters as they are set directly
  const inputParams = ['width', 'height', 'steps', 'cfg', 'seed']; // Removed 'prompt_clip_l', 'prompt_t5xxl'
  if (hasInputImage) {
    inputParams.push('imageUrl', 'denoise');
  }

  const builder = new PromptBuilder(workflow, inputParams, ['images']);

  // Set output node
  builder.setOutputNode('images', '12');

  // Keep input mappings for other parameters (excluding prompt-related)
  builder.setInputNode('seed', '13.inputs.noise_seed');
  builder.setInputNode('steps', '9.inputs.steps');
  builder.setInputNode('cfg', '6.inputs.guidance');

  // Map width/height to the appropriate node based on mode
  if (!hasInputImage) {
    // Text-to-image mode: Use EmptySD3LatentImage as primary (node '7' is guaranteed to exist)
    builder.setInputNode('width', '7.inputs.width');
    builder.setInputNode('height', '7.inputs.height');
  } else {
    // Image-to-image mode: Use ModelSamplingFlux as primary (node '4' always exists)
    builder.setInputNode('width', '4.inputs.width');
    builder.setInputNode('height', '4.inputs.height');
  }

  // Additional mappings for image-to-image mode
  if (hasInputImage) {
    builder.setInputNode('imageUrl', 'img_load.inputs.image');
    builder.setInputNode('denoise', '9.inputs.denoise');
  } else {
    // Text-to-image mode still needs denoise mapping but will use default value
    builder.setInputNode('denoise', '9.inputs.denoise');
  }

  // Set input values (excluding prompt, already set directly in workflow)
  builder
    .input('width', params.width)
    .input('height', params.height)
    .input('steps', params.steps)
    .input('cfg', params.cfg)
    .input('seed', params.seed ?? generateUniqueSeeds(1)[0]);

  if (hasInputImage) {
    builder
      .input('imageUrl', params.imageUrl || params.imageUrls?.[0] || '')
      .input('denoise', params.strength);
  } else {
    // Text-to-image mode uses default denoise value 1.0
    builder.input('denoise', WORKFLOW_DEFAULTS.SAMPLING.DENOISE);
  }

  return builder;
}
