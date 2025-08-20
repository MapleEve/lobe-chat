import { PromptBuilder } from '@saintno/comfyui-sdk';

import { splitPromptForDualCLIP } from '../utils/prompt-splitter';
import { selectOptimalWeightDtype } from '../utils/weight-dtype';

/**
 * FLUX Kontext 工作流构建器
 * 28步图像编辑生成，支持文生图和图生图
 */
export function buildFluxKontextWorkflow(
  modelName: string,
  params: Record<string, any>,
): PromptBuilder<any, any, any> {
  // 检查是否有输入图像
  const hasInputImage = Boolean(params.imageUrl || params.imageUrls?.[0]);

  const workflow: any = {
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
        latent_image: hasInputImage ? ['img_encode', 0] : ['7', 0], // 根据是否有输入图像选择latent来源
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
        filename_prefix: 'LobeChat/%year%-%month%-%day%/FLUX_Kontext',
        images: ['11', 0],
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
    '8': {
      _meta: {
        title: 'K Sampler Select',
      },
      class_type: 'KSamplerSelect',
      inputs: {
        sampler_name: params.samplerName ?? 'dpmpp_2m', // 图生图用普通DPM++（无SDE）
      },
    },
    '9': {
      _meta: {
        title: 'Basic Scheduler',
      },
      class_type: 'BasicScheduler',
      inputs: {
        denoise: params.denoise ?? (hasInputImage ? 0.75 : 1), // 图生图使用denoise控制编辑强度
        model: ['4', 0],
        scheduler: params.scheduler ?? 'karras',
        steps: params.steps ?? 28,
      },
    },
  };

  // 如果有输入图像，添加图像加载和编码节点
  if (hasInputImage) {
    workflow['img_load'] = {
      _meta: {
        title: 'Load Image',
      },
      class_type: 'LoadImage',
      inputs: {
        image: params.imageUrl || params.imageUrls[0],
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
    // 文生图模式，添加空白latent
    workflow['7'] = {
      _meta: {
        title: 'Empty SD3 Latent Image',
      },
      class_type: 'EmptySD3LatentImage',
      inputs: {
        batch_size: 1,
        height: params.height ?? 1024,
        width: params.width ?? 1024,
      },
    };
  }

  // 创建 PromptBuilder
  const inputParams = ['prompt', 'width', 'height', 'steps', 'cfg', 'seed'];
  if (hasInputImage) {
    inputParams.push('imageUrl', 'denoise');
  }

  const builder = new PromptBuilder(workflow, inputParams, ['images']);

  // 设置输出节点
  builder.setOutputNode('images', '12');

  return builder;
}
