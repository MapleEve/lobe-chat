import { PromptBuilder } from '@saintno/comfyui-sdk';

import { splitPromptForDualCLIP } from '../utils/prompt-splitter';
import { selectOptimalWeightDtype } from '../utils/weight-dtype';

/**
 * FLUX Dev 工作流构建器
 * 20步高质量生成，使用FluxGuidance和SamplerCustomAdvanced
 */
export function buildFluxDevWorkflow(
  modelName: string,
  params: Record<string, any>,
): PromptBuilder<any, any, any> {
  const workflow = {
    '1': {
      _meta: {
        title: 'DualCLIP Loader',
      },
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: 't5xxl_fp16.safetensors',
        clip_name2: 'clip_l.safetensors',
        type: 'flux',
      },
    },
    '10': {
      _meta: {
        title: 'Sampler Custom Advanced',
      },
      class_type: 'SamplerCustomAdvanced',
      inputs: {
        latent_image: ['7', 0],
        model: ['4', 0],
        negative: ['6', 0],
        noise: ['13', 0],
        positive: ['6', 0],
        sampler: ['8', 0],
        sigmas: ['9', 0],
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
        filename_prefix: 'LobeChat/%year%-%month%-%day%/FLUX_Dev',
        images: ['11', 0],
      },
    },
    '2': {
      _meta: {
        title: 'UNET Loader',
      },
      class_type: 'UNETLoader',
      inputs: {
        unet_name: modelName,
        weight_dtype: selectOptimalWeightDtype(modelName, params),
      },
    },
    '3': {
      _meta: {
        title: 'VAE Loader',
      },
      class_type: 'VAELoader',
      inputs: {
        vae_name: 'ae.safetensors',
      },
    },
    '4': {
      _meta: {
        title: 'Model Sampling Flux',
      },
      class_type: 'ModelSamplingFlux',
      inputs: {
        height: params.height ?? 1024,
        max_shift: 1.15,
        model: ['2', 0],
        width: params.width ?? 1024,
      },
    },
    '5': {
      _meta: {
        title: 'CLIP Text Encode (Flux)',
      },
      class_type: 'CLIPTextEncodeFlux',
      inputs: {
        clip: ['1', 0],
        ...(() => {
          const { t5xxlPrompt, clipLPrompt } = splitPromptForDualCLIP(params.prompt ?? '');
          return {
            clip_l: clipLPrompt,
            t5xxl: t5xxlPrompt,
          };
        })(),
        guidance: params.cfg ?? 3.5,
      },
    },
    '6': {
      _meta: {
        title: 'Flux Guidance',
      },
      class_type: 'FluxGuidance',
      inputs: {
        conditioning: ['5', 0],
        guidance: params.cfg ?? 3.5,
      },
    },
    '7': {
      _meta: {
        title: 'Empty SD3 Latent Image',
      },
      class_type: 'EmptySD3LatentImage',
      inputs: {
        batch_size: 1,
        height: params.height ?? 1024,
        width: params.width ?? 1024,
      },
    },
    '8': {
      _meta: {
        title: 'K Sampler Select',
      },
      class_type: 'KSamplerSelect',
      inputs: {
        sampler_name: params.samplerName ?? 'euler',
      },
    },
    '9': {
      _meta: {
        title: 'Basic Scheduler',
      },
      class_type: 'BasicScheduler',
      inputs: {
        denoise: 1,
        model: ['4', 0],
        scheduler: params.scheduler ?? 'simple',
        steps: params.steps ?? 20,
      },
    },
    '13': {
      _meta: {
        title: 'Random Noise',
      },
      class_type: 'RandomNoise',
      inputs: {
        noise_seed: params.seed ?? -1,
      },
    },
  };

  // 创建 PromptBuilder
  const builder = new PromptBuilder(
    workflow,
    ['prompt', 'width', 'height', 'steps', 'cfg', 'seed'],
    ['images'],
  );

  // 设置输出节点
  builder.setOutputNode('images', '12');

  return builder;
}
