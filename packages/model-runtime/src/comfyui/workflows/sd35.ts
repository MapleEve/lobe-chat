/**
 * SD3.5 Basic Workflow - Simple SD workflow for SD3.5 Large and Medium models
 */
import { PromptBuilder } from '@saintno/comfyui-sdk';

import { generateUniqueSeeds } from '@/utils/number';

/**
 * Default negative prompt for SD3.5
 */
const DEFAULT_NEGATIVE_PROMPT = `worst quality, normal quality, low quality, low res, blurry, distortion, text, watermark, logo, banner, extra digits, cropped, jpeg artifacts, signature, username, error, sketch, duplicate, ugly, monochrome, horror, geometry, mutation, disgusting, bad anatomy, bad proportions, bad quality, deformed, disconnected limbs, out of frame, out of focus, dehydrated, disfigured, extra arms, extra limbs, extra hands, fused fingers, gross proportions, long neck, jpeg, malformed limbs, mutated, mutated hands, mutated limbs, missing arms, missing fingers, picture frame, poorly drawn hands, poorly drawn face, collage, pixel, pixelated, grainy, color aberration, amputee, autograph, bad illustration, beyond the borders, blank background, body out of frame, boring background, branding, cut off, dismembered, disproportioned, distorted, draft, duplicated features, extra fingers, extra legs, fault, flaw, grains, hazy, identifying mark, improper scale, incorrect physiology, incorrect ratio, indistinct, kitsch, low resolution, macabre, malformed, mark, misshapen, missing hands, missing legs, mistake, morbid, mutilated, off-screen, outside the picture, poorly drawn feet, printed words, render, repellent, replicate, reproduce, revolting dimensions, script, shortened, sign, split image, squint, storyboard, tiling, trimmed, unfocused, unattractive, unnatural pose, unreal engine, unsightly, written language`;

/**
 * Build SD3.5 workflow - Same signature as FLUX workflows
 */
export function buildSD35Workflow(
  modelFileName: string,
  params: Record<string, any>,
): PromptBuilder<any, any, any> {
  const { prompt, negativePrompt, width, height, steps, seed } = params;

  const actualSeed = seed ?? generateUniqueSeeds(1)[0];
  const actualNegativePrompt = negativePrompt || DEFAULT_NEGATIVE_PROMPT;

  const workflow = {
    '1': {
      _meta: {
        title: 'Load Checkpoint',
      },
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: modelFileName,
      },
    },
    '2': {
      _meta: {
        title: 'Positive Prompt',
      },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['1', 1],
        text: prompt,
      },
    },
    '3': {
      _meta: {
        title: 'Negative Prompt',
      },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['1', 1],
        text: actualNegativePrompt,
      },
    },
    '4': {
      _meta: {
        title: 'Empty Latent',
      },
      class_type: 'EmptyLatentImage',
      inputs: {
        batch_size: 1,
        height,
        width,
      },
    },
    '5': {
      _meta: {
        title: 'KSampler',
      },
      class_type: 'KSampler',
      inputs: {
        cfg: 7,
        denoise: 1,
        latent_image: ['4', 0],
        model: ['1', 0],
        negative: ['3', 0],
        positive: ['2', 0],
        sampler_name: 'euler',
        scheduler: 'normal',
        seed: actualSeed,
        steps,
      },
    },
    '6': {
      _meta: {
        title: 'VAE Decode',
      },
      class_type: 'VAEDecode',
      inputs: {
        samples: ['5', 0],
        vae: ['1', 2],
      },
    },
    '7': {
      _meta: {
        title: 'Save Image',
      },
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'SD35',
        images: ['6', 0],
      },
    },
  };

  // Create PromptBuilder
  const builder = new PromptBuilder(
    workflow,
    ['prompt', 'negativePrompt', 'width', 'height', 'steps', 'seed'],
    ['images'],
  );

  // Set output node
  builder.setOutputNode('images', '7');

  // Set input node mappings
  builder.setInputNode('prompt', '2.inputs.text');
  builder.setInputNode('negativePrompt', '3.inputs.text');
  builder.setInputNode('width', '4.inputs.width');
  builder.setInputNode('height', '4.inputs.height');
  builder.setInputNode('steps', '5.inputs.steps');
  builder.setInputNode('seed', '5.inputs.seed');

  return builder;
}
