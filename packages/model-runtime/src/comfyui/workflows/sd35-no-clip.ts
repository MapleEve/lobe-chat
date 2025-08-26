/**
 * SD3.5 No-CLIP Workflow
 *
 * For SD3.5 models with built-in CLIP/T5 encoders
 * E.g., sd3.5_medium_incl_clips_t5xxlfp8scaled.safetensors
 */
import { PromptBuilder } from '@saintno/comfyui-sdk';

import { generateUniqueSeeds } from '../../../../utils/src/number';
import { DEFAULT_NEGATIVE_PROMPT } from '../constants';

/**
 * Default negative prompt for SD3.5
 */

/**
 * Build SD3.5 No-CLIP workflow for models with internal encoders
 */
export function buildSD35NoClipWorkflow(
  modelFileName: string,
  params: Record<string, any>,
): PromptBuilder<any, any, any> {
  const { prompt, width, height, steps, seed, cfg } = params;

  const actualSeed = seed ?? generateUniqueSeeds(1)[0];
  // Workflow for models with built-in CLIP/T5 encoders
  const workflow = {
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
        text: prompt,
      },
    },
    '3': {
      _meta: { title: 'Negative Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['1', 1], // Use checkpoint's built-in CLIP
        text: DEFAULT_NEGATIVE_PROMPT,
      },
    },
    '4': {
      _meta: { title: 'Empty Latent' },
      class_type: 'EmptyLatentImage',
      inputs: {
        batch_size: 1,
        height,
        width,
      },
    },
    '5': {
      _meta: { title: 'KSampler' },
      class_type: 'KSampler',
      inputs: {
        cfg: cfg || 4,
        denoise: 1,
        latent_image: ['4', 0],
        model: ['1', 0],
        negative: ['3', 0],
        positive: ['2', 0],
        sampler_name: 'euler',
        scheduler: 'sgm_uniform',
        seed: actualSeed,
        steps,
      },
    },
    '6': {
      _meta: { title: 'VAE Decode' },
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2], // Use checkpoint's built-in VAE
      },
    },
    '7': {
      _meta: { title: 'Save Image' },
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'SD35_NoClip',
        images: ['6', 0],
      },
    },
  };

  // Create PromptBuilder
  const builder = new PromptBuilder(
    workflow,
    ['prompt', 'width', 'height', 'steps', 'seed', 'cfg'],
    ['images'],
  );

  // Set output node
  builder.setOutputNode('images', '7');

  // Set input node mappings
  builder.setInputNode('prompt', '2.inputs.text');
  builder.setInputNode('width', '4.inputs.width');
  builder.setInputNode('height', '4.inputs.height');
  builder.setInputNode('steps', '5.inputs.steps');
  builder.setInputNode('seed', '5.inputs.seed');
  builder.setInputNode('cfg', '5.inputs.cfg');

  return builder;
}
