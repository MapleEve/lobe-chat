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
        clip_l: '',
        guidance: WORKFLOW_DEFAULTS.SCHNELL.CFG,
        t5xxl: '', // Schnell 使用 CFG 1
      },
    },
    '5': {
      _meta: {
        title: 'Empty SD3 Latent Image',
      },
      class_type: 'EmptySD3LatentImage',
      inputs: {
        batch_size: WORKFLOW_DEFAULTS.IMAGE.BATCH_SIZE,
        height: WORKFLOW_DEFAULTS.IMAGE.HEIGHT,
        width: WORKFLOW_DEFAULTS.IMAGE.WIDTH,
      },
    },
    '6': {
      _meta: {
        title: 'K Sampler',
      },
      class_type: 'KSampler',
      inputs: {
        cfg: WORKFLOW_DEFAULTS.SCHNELL.CFG,
        denoise: WORKFLOW_DEFAULTS.SAMPLING.DENOISE,
        latent_image: ['5', 0],
        model: ['2', 0],
        negative: ['4', 0],
        positive: ['4', 0],
        sampler_name: WORKFLOW_DEFAULTS.SAMPLING.SAMPLER,
        scheduler: WORKFLOW_DEFAULTS.SAMPLING.SCHEDULER,
        seed: WORKFLOW_DEFAULTS.NOISE.SEED,
        steps: WORKFLOW_DEFAULTS.SCHNELL.STEPS,
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
    ['prompt_clip_l', 'prompt_t5xxl', 'width', 'height', 'steps', 'seed'],
    ['images'],
  );

  // 设置输出节点
  builder.setOutputNode('images', '8');

  // 添加setInputNode映射 - 修复SDK链式调用bug，改为分开调用
  builder.setInputNode('seed', '6.inputs.seed');
  builder.setInputNode('width', '5.inputs.width');
  builder.setInputNode('height', '5.inputs.height');
  builder.setInputNode('steps', '6.inputs.steps');
  builder.setInputNode('prompt_clip_l', '4.inputs.clip_l');
  builder.setInputNode('prompt_t5xxl', '4.inputs.t5xxl');

  // 处理prompt分离
  const { t5xxlPrompt, clipLPrompt } = splitPromptForDualCLIP(params.prompt ?? '');

  // 设置输入值
  builder
    .input('prompt_clip_l', clipLPrompt)
    .input('prompt_t5xxl', t5xxlPrompt)
    .input('width', params.width ?? WORKFLOW_DEFAULTS.IMAGE.WIDTH)
    .input('height', params.height ?? WORKFLOW_DEFAULTS.IMAGE.HEIGHT)
    .input('steps', params.steps ?? WORKFLOW_DEFAULTS.SCHNELL.STEPS)
    .input('seed', params.seed ?? WORKFLOW_DEFAULTS.NOISE.SEED);

  return builder;
}
