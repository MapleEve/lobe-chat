import { PromptBuilder } from '@saintno/comfyui-sdk';

import { FLUX_MODEL_CONFIG, WORKFLOW_DEFAULTS } from '../constants';
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
        clip_name1: FLUX_MODEL_CONFIG.CLIP.T5XXL,
        clip_name2: FLUX_MODEL_CONFIG.CLIP.CLIP_L,
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
        filename_prefix: FLUX_MODEL_CONFIG.FILENAME_PREFIXES.DEV,
        images: ['11', 0],
      },
    },
    '13': {
      _meta: {
        title: 'Random Noise',
      },
      class_type: 'RandomNoise',
      inputs: {
        noise_seed: params.seed ?? WORKFLOW_DEFAULTS.NOISE.SEED,
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
        title: 'Model Sampling Flux',
      },
      class_type: 'ModelSamplingFlux',
      inputs: {
        height: params.height ?? WORKFLOW_DEFAULTS.IMAGE.HEIGHT,
        max_shift: WORKFLOW_DEFAULTS.SAMPLING.MAX_SHIFT,
        model: ['2', 0],
        width: params.width ?? WORKFLOW_DEFAULTS.IMAGE.WIDTH,
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
        guidance: params.cfg ?? WORKFLOW_DEFAULTS.SAMPLING.CFG,
      },
    },
    '6': {
      _meta: {
        title: 'Flux Guidance',
      },
      class_type: 'FluxGuidance',
      inputs: {
        conditioning: ['5', 0],
        guidance: params.cfg ?? WORKFLOW_DEFAULTS.SAMPLING.CFG,
      },
    },
    '7': {
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
    '8': {
      _meta: {
        title: 'K Sampler Select',
      },
      class_type: 'KSamplerSelect',
      inputs: {
        sampler_name: params.samplerName ?? WORKFLOW_DEFAULTS.SAMPLING.SAMPLER,
      },
    },
    '9': {
      _meta: {
        title: 'Basic Scheduler',
      },
      class_type: 'BasicScheduler',
      inputs: {
        denoise: WORKFLOW_DEFAULTS.SAMPLING.DENOISE,
        model: ['4', 0],
        scheduler: params.scheduler ?? WORKFLOW_DEFAULTS.SAMPLING.SCHEDULER,
        steps: params.steps ?? WORKFLOW_DEFAULTS.SAMPLING.STEPS,
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
