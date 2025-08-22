import { PromptBuilder } from '@saintno/comfyui-sdk';

import { FLUX_MODEL_CONFIG, WORKFLOW_DEFAULTS } from '../constants';
import { splitPromptForDualCLIP } from '../utils/prompt-splitter';
import { selectOptimalWeightDtype } from '../utils/weight-dtype';

/**
 * FLUX Schnell 工作流构建器
 * 4步快速生成，针对速度优化
 */
export function buildFluxSchnellWorkflow(
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
        clip_name1: FLUX_MODEL_CONFIG.CLIP.T5XXL,
        clip_name2: FLUX_MODEL_CONFIG.CLIP.CLIP_L,
        type: 'flux',
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
        vae_name: FLUX_MODEL_CONFIG.VAE.DEFAULT,
      },
    },
    '4': {
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
        guidance: WORKFLOW_DEFAULTS.SCHNELL.CFG, // Schnell 使用 CFG 1
      },
    },
    '5': {
      _meta: {
        title: 'Empty SD3 Latent Image',
      },
      class_type: 'EmptySD3LatentImage',
      inputs: {
        batch_size: WORKFLOW_DEFAULTS.IMAGE.BATCH_SIZE,
        height: params.height ?? WORKFLOW_DEFAULTS.IMAGE.HEIGHT,
        width: params.width ?? WORKFLOW_DEFAULTS.IMAGE.WIDTH,
      },
    },
    '6': {
      _meta: {
        title: 'K Sampler',
      },
      class_type: 'KSampler',
      inputs: {
        cfg: 1,
        denoise: 1,
        latent_image: ['5', 0],
        model: ['2', 0],
        negative: ['4', 0],
        positive: ['4', 0],
        sampler_name: params.samplerName ?? WORKFLOW_DEFAULTS.SAMPLING.SAMPLER,
        scheduler: params.scheduler ?? WORKFLOW_DEFAULTS.SAMPLING.SCHEDULER,
        seed: params.seed ?? WORKFLOW_DEFAULTS.NOISE.SEED,
        steps: params.steps ?? WORKFLOW_DEFAULTS.SCHNELL.STEPS,
      },
    },
    '7': {
      _meta: {
        title: 'VAE Decode',
      },
      class_type: 'VAEDecode',
      inputs: {
        samples: ['6', 0],
        vae: ['3', 0],
      },
    },
    '8': {
      _meta: {
        title: 'Save Image',
      },
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: FLUX_MODEL_CONFIG.FILENAME_PREFIXES.SCHNELL,
        images: ['7', 0],
      },
    },
  };

  // 创建 PromptBuilder
  const builder = new PromptBuilder(
    workflow,
    ['prompt', 'width', 'height', 'steps', 'seed'],
    ['images'],
  );

  // 设置输出节点
  builder.setOutputNode('images', '8');

  return builder;
}
