/**
 * SD3.5 Workflow with Static JSON Structure
 *
 * Supports three encoder configurations through conditional values:
 * 1. Triple: CLIP L + CLIP G + T5 (best quality)
 * 2. Dual CLIP: CLIP L + CLIP G only
 * 3. T5 only: T5XXL encoder only
 */
import { PromptBuilder } from '@saintno/comfyui-sdk';

import { generateUniqueSeeds } from '../../../../utils/src/number';
import { getAllComponentsWithNames } from '../config/systemComponents';
import { DEFAULT_NEGATIVE_PROMPT, WORKFLOW_DEFAULTS } from '../constants';
import { WorkflowError } from '../errors';
import type { WorkflowContext } from '../services/workflowBuilder';

export interface SD35WorkflowParams {
  cfg?: number;
  denoise?: number;
  height?: number;
  negativePrompt?: string;
  prompt: string;
  sampler?: string;
  scheduler?: string;
  seed?: number;
  shift?: number;
  steps?: number;
  width?: number;
}

/**
 * Detect available encoder configuration
 */
function detectAvailableEncoder(): {
  clipG?: string;
  clipL?: string;
  t5?: string;
  type: 'triple' | 'dual_clip' | 't5';
} | null {
  // Get all available CLIP and T5 components
  const clipComponents = getAllComponentsWithNames({ type: 'clip' });
  const t5Components = getAllComponentsWithNames({ type: 't5' });

  // Find CLIP L and CLIP G for SD3
  const clipL = clipComponents.find((c) => c.name === 'clip_l.safetensors');
  const clipG = clipComponents.find(
    (c) => c.name === 'clip_g.safetensors' && c.config.modelFamily === 'SD3',
  );

  // Find T5XXL (prefer fp16, fallback to fp8)
  const t5 = t5Components
    .filter((c) => c.config.modelFamily === 'SD3' || c.config.modelFamily === 'FLUX')
    .sort((a, b) => a.config.priority - b.config.priority)[0];

  // Best case: all three encoders available
  if (clipL && clipG && t5) {
    return {
      clipG: clipG.name,
      clipL: clipL.name,
      t5: t5.name,
      type: 'triple',
    };
  }

  // Dual CLIP configuration
  if (clipL && clipG) {
    return {
      clipG: clipG.name,
      clipL: clipL.name,
      type: 'dual_clip',
    };
  }

  // T5 only configuration
  if (t5) {
    return {
      t5: t5.name,
      type: 't5',
    };
  }

  // No valid encoder configuration found
  return null;
}

/**
 * Build SD3.5 workflow with static JSON structure
 */
export async function buildSD35Workflow(
  modelFileName: string,
  params: SD35WorkflowParams,
  _context: WorkflowContext,
): Promise<PromptBuilder<any, any, any>> {
  void _context; // Context not used in SD3.5 workflow
  const { prompt, width, height, steps, seed, cfg, sampler, scheduler, negativePrompt, shift } =
    params;

  const actualSeed = seed ?? generateUniqueSeeds(1)[0];
  const finalSampler = sampler ?? WORKFLOW_DEFAULTS.SAMPLING.SAMPLER;
  const finalScheduler = scheduler ?? WORKFLOW_DEFAULTS.SAMPLING.SCHEDULER;

  // Detect available encoders
  const encoderConfig = detectAvailableEncoder();

  // SD3.5 REQUIRES external encoders - no encoder = throw error
  if (!encoderConfig) {
    throw new WorkflowError(
      'SD3.5 models require external CLIP/T5 encoder files. Available configurations: 1) Triple (CLIP L+G+T5), 2) Dual CLIP (L+G), or 3) T5 only. No encoder files found.',
      WorkflowError.Reasons.MISSING_ENCODER,
      { model: modelFileName },
    );
  }

  // Configure conditioning references based on encoder type
  const clipNode = ['2', 0];
  const positiveConditioningNode: [string, number] = ['3', 0];
  const negativeConditioningNode: [string, number] = ['4', 0];

  // Build complete static JSON structure with conditional values
  /* eslint-disable sort-keys-fix/sort-keys-fix */
  const workflow = {
    '1': {
      _meta: { title: 'Load Checkpoint' },
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: modelFileName,
      },
    },
    '2':
      encoderConfig.type === 'triple'
        ? {
            _meta: { title: 'Triple CLIP Loader' },
            class_type: 'TripleCLIPLoader',
            inputs: {
              clip_name1: encoderConfig.clipL,
              clip_name2: encoderConfig.clipG,
              clip_name3: encoderConfig.t5,
            },
          }
        : encoderConfig.type === 'dual_clip'
          ? {
              _meta: { title: 'Dual CLIP Loader' },
              class_type: 'DualCLIPLoader',
              inputs: {
                clip_name1: encoderConfig.clipL,
                clip_name2: encoderConfig.clipG,
              },
            }
          : {
              _meta: { title: 'Load T5' },
              class_type: 'CLIPLoader',
              inputs: {
                clip_name: encoderConfig.t5,
                type: 't5',
              },
            },
    '3': {
      _meta: { title: 'Positive Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: clipNode,
        text: prompt,
      },
    },
    '4': {
      _meta: { title: 'Negative Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: clipNode,
        text: negativePrompt || DEFAULT_NEGATIVE_PROMPT,
      },
    },
    '5': {
      _meta: { title: 'Empty SD3 Latent Image' },
      class_type: 'EmptySD3LatentImage',
      inputs: {
        batch_size: WORKFLOW_DEFAULTS.IMAGE.BATCH_SIZE,
        height: height || WORKFLOW_DEFAULTS.IMAGE.HEIGHT,
        width: width || WORKFLOW_DEFAULTS.IMAGE.WIDTH,
      },
    },
    '6': {
      _meta: { title: 'KSampler' },
      class_type: 'KSampler',
      inputs: {
        cfg: cfg || 4.5,
        denoise: params.denoise || WORKFLOW_DEFAULTS.SAMPLING.DENOISE,
        latent_image: ['5', 0],
        model: ['12', 0], // Use ModelSamplingSD3 output
        negative: negativeConditioningNode,
        positive: positiveConditioningNode,
        sampler_name: finalSampler,
        scheduler: finalScheduler,
        seed: actualSeed,
        steps: steps || 28,
      },
    },
    '7': {
      _meta: { title: 'VAE Decode' },
      class_type: 'VAEDecode',
      inputs: {
        samples: ['6', 0],
        vae: ['1', 2],
      },
    },
    '8': {
      _meta: { title: 'Save Image' },
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'LobeChat/%year%-%month%-%day%/SD35',
        images: ['7', 0],
      },
    },
    '12': {
      _meta: { title: 'ModelSamplingSD3' },
      class_type: 'ModelSamplingSD3',
      inputs: {
        model: ['1', 0],
        shift: shift || 3,
      },
    },
  };
  /* eslint-enable sort-keys-fix/sort-keys-fix */

  // Create PromptBuilder
  const builder = new PromptBuilder(
    workflow,
    [
      'prompt',
      'width',
      'height',
      'steps',
      'seed',
      'cfg',
      'sampler',
      'scheduler',
      'negativePrompt',
      'denoise',
      'shift',
    ],
    ['images'],
  );

  // Set output node
  builder.setOutputNode('images', '8');

  // Set input node mappings
  builder.setInputNode('prompt', '3.inputs.text');
  builder.setInputNode('negativePrompt', '4.inputs.text');
  builder.setInputNode('width', '5.inputs.width');
  builder.setInputNode('height', '5.inputs.height');
  builder.setInputNode('steps', '6.inputs.steps');
  builder.setInputNode('seed', '6.inputs.seed');
  builder.setInputNode('cfg', '6.inputs.cfg');
  builder.setInputNode('sampler', '6.inputs.sampler_name');
  builder.setInputNode('scheduler', '6.inputs.scheduler');
  builder.setInputNode('denoise', '6.inputs.denoise');
  builder.setInputNode('shift', '12.inputs.shift');

  // Set input values
  builder
    .input('prompt', prompt)
    .input('negativePrompt', negativePrompt || DEFAULT_NEGATIVE_PROMPT)
    .input('width', width || WORKFLOW_DEFAULTS.IMAGE.WIDTH)
    .input('height', height || WORKFLOW_DEFAULTS.IMAGE.HEIGHT)
    .input('steps', steps || 28)
    .input('cfg', cfg || 4.5)
    .input('seed', actualSeed)
    .input('sampler', finalSampler)
    .input('scheduler', finalScheduler)
    .input('denoise', params.denoise || WORKFLOW_DEFAULTS.SAMPLING.DENOISE)
    .input('shift', shift || 3);

  return builder;
}
