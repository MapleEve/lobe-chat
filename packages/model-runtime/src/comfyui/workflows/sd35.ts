/**
 * SD3.5 Workflow with Dynamic Encoder Detection
 *
 * Supports three encoder configurations:
 * 1. Triple: CLIP L + CLIP G + T5 (best quality)
 * 2. Dual CLIP: CLIP L + CLIP G only
 * 3. T5 only: T5XXL encoder only
 */
import { PromptBuilder } from '@saintno/comfyui-sdk';

import { DEFAULT_NEGATIVE_PROMPT } from '@/libs/model-runtime/comfyui/constants';
import { generateUniqueSeeds } from '@/utils/number';

import { getAllComponentsWithNames } from '../config/systemComponents';
import { WorkflowError } from '../errors';

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

  // Find CLIP L and CLIP G
  const clipL = clipComponents.find((c) => c.name === 'clip_l.safetensors');
  const clipG = clipComponents.find((c) => c.name === 'clip_g.safetensors');

  // Find T5XXL (prefer fp16, fallback to fp8)
  const t5 = t5Components.sort((a, b) => a.config.priority - b.config.priority)[0];

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
 * Build SD3.5 workflow with dynamic encoder detection
 */
export function buildSD35Workflow(
  modelFileName: string,
  params: Record<string, any>,
): PromptBuilder<any, any, any> {
  const { prompt, width, height, steps, seed, cfg } = params;

  const actualSeed = seed ?? generateUniqueSeeds(1)[0];

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

  // Base workflow structure
  const workflow: Record<string, any> = {
    '1': {
      _meta: { title: 'Load Checkpoint' },
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: modelFileName,
      },
    },
  };

  // Configure conditioning based on available encoders
  let positiveConditioningNode: [string, number] = ['3', 0];
  let negativeConditioningNode: [string, number] = ['4', 0];

  if (encoderConfig && encoderConfig.type === 'triple') {
    // Triple encoder: Use TripleCLIPLoader to combine all three
    workflow['2'] = {
      _meta: { title: 'Triple CLIP Loader' },
      class_type: 'TripleCLIPLoader',
      inputs: {
        clip_name1: encoderConfig.clipL,
        clip_name2: encoderConfig.clipG,
        clip_name3: encoderConfig.t5,
      },
    };
    workflow['3'] = {
      _meta: { title: 'Positive Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 0],
        text: prompt,
      },
    };
    workflow['4'] = {
      _meta: { title: 'Negative Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 0],
        text: DEFAULT_NEGATIVE_PROMPT,
      },
    };
    positiveConditioningNode = ['3', 0];
    negativeConditioningNode = ['4', 0];
  } else if (encoderConfig && encoderConfig.type === 'dual_clip') {
    // Dual CLIP: Use DualCLIPLoader
    workflow['2'] = {
      _meta: { title: 'Dual CLIP Loader' },
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: encoderConfig.clipL,
        clip_name2: encoderConfig.clipG,
      },
    };
    workflow['3'] = {
      _meta: { title: 'Positive Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 0],
        text: prompt,
      },
    };
    workflow['4'] = {
      _meta: { title: 'Negative Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 0],
        text: DEFAULT_NEGATIVE_PROMPT,
      },
    };
    positiveConditioningNode = ['3', 0];
    negativeConditioningNode = ['4', 0];
  } else if (encoderConfig && encoderConfig.type === 't5') {
    // T5 only: Use CLIPLoader with T5
    workflow['2'] = {
      _meta: { title: 'Load T5' },
      class_type: 'CLIPLoader',
      inputs: {
        clip_name: encoderConfig.t5,
        type: 't5',
      },
    };
    workflow['3'] = {
      _meta: { title: 'Positive Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 0],
        text: prompt,
      },
    };
    workflow['4'] = {
      _meta: { title: 'Negative Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 0],
        text: DEFAULT_NEGATIVE_PROMPT,
      },
    };
    positiveConditioningNode = ['3', 0];
    negativeConditioningNode = ['4', 0];
  }

  // Add the rest of the workflow (same for all configurations)
  workflow['5'] = {
    _meta: { title: 'Empty Latent' },
    class_type: 'EmptyLatentImage',
    inputs: {
      batch_size: 1,
      height,
      width,
    },
  };

  workflow['6'] = {
    _meta: { title: 'KSampler' },
    class_type: 'KSampler',
    inputs: {
      cfg: cfg || 4,
      denoise: 1,
      latent_image: ['5', 0],
      model: ['1', 0],
      negative: negativeConditioningNode,
      positive: positiveConditioningNode,
      sampler_name: 'euler',
      scheduler: 'sgm_uniform',
      seed: actualSeed,
      steps,
    },
  };

  workflow['7'] = {
    _meta: { title: 'VAE Decode' },
    class_type: 'VAEDecode',
    inputs: {
      samples: ['6', 0],
      vae: ['1', 2],
    },
  };

  workflow['8'] = {
    _meta: { title: 'Save Image' },
    class_type: 'SaveImage',
    inputs: {
      filename_prefix: 'SD35',
      images: ['7', 0],
    },
  };

  // Create PromptBuilder
  const builder = new PromptBuilder(
    workflow,
    ['prompt', 'width', 'height', 'steps', 'seed', 'cfg'],
    ['images'],
  );

  // Set output node
  builder.setOutputNode('images', '8');

  // Set input node mappings
  builder.setInputNode('prompt', '3.inputs.text');
  builder.setInputNode('width', '5.inputs.width');
  builder.setInputNode('height', '5.inputs.height');
  builder.setInputNode('steps', '6.inputs.steps');
  builder.setInputNode('seed', '6.inputs.seed');
  builder.setInputNode('cfg', '6.inputs.cfg');

  return builder;
}
