import { PromptBuilder } from '@saintno/comfyui-sdk';

import { generateUniqueSeeds } from '@/utils/number';

import { FLUX_MODEL_CONFIG, WORKFLOW_DEFAULTS } from '../constants';
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
        guider: ['6', 0], // Required parameter - use FluxGuidance output
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
        filename_prefix: FLUX_MODEL_CONFIG.FILENAME_PREFIXES.KONTEXT,
        images: ['11', 0],
      },
    },
    '13': {
      _meta: {
        title: 'Random Noise',
      },
      class_type: 'RandomNoise',
      inputs: {
        noise_seed: WORKFLOW_DEFAULTS.NOISE.SEED,
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
        base_shift: 0.5, // Required parameter for FLUX models
        height: WORKFLOW_DEFAULTS.IMAGE.HEIGHT,
        max_shift: WORKFLOW_DEFAULTS.SAMPLING.MAX_SHIFT,
        model: ['2', 0],
        width: WORKFLOW_DEFAULTS.IMAGE.WIDTH,
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
        guidance: WORKFLOW_DEFAULTS.KONTEXT.CFG,
        t5xxl: '',
      },
    },
    '6': {
      _meta: {
        title: 'Flux Guidance',
      },
      class_type: 'FluxGuidance',
      inputs: {
        // FluxGuidance接收positive输入，输出GUIDER类型
        guidance: WORKFLOW_DEFAULTS.KONTEXT.CFG,
        positive: ['5', 0],
      },
    },
    '8': {
      _meta: {
        title: 'K Sampler Select',
      },
      class_type: 'KSamplerSelect',
      inputs: {
        sampler_name: 'dpmpp_2m', // 图生图用普通DPM++（无SDE）
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
        scheduler: 'karras',
        steps: WORKFLOW_DEFAULTS.KONTEXT.STEPS,
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
        image: '', // 将通过SDK映射设置
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
        batch_size: WORKFLOW_DEFAULTS.IMAGE.BATCH_SIZE,
        height: WORKFLOW_DEFAULTS.IMAGE.HEIGHT,
        width: WORKFLOW_DEFAULTS.IMAGE.WIDTH,
      },
    };
  }

  // 创建 PromptBuilder
  const inputParams = ['prompt_clip_l', 'prompt_t5xxl', 'width', 'height', 'steps', 'cfg', 'seed'];
  if (hasInputImage) {
    inputParams.push('imageUrl', 'denoise');
  }

  const builder = new PromptBuilder(workflow, inputParams, ['images']);

  // 设置输出节点
  builder.setOutputNode('images', '12');

  // 添加setInputNode映射 - 修复SDK链式调用bug，改为分开调用
  // Note: Each parameter can only be mapped to one node path with setInputNode
  builder.setInputNode('seed', '13.inputs.noise_seed');
  builder.setInputNode('steps', '9.inputs.steps');
  builder.setInputNode('cfg', '6.inputs.guidance'); // Use FluxGuidance as primary
  builder.setInputNode('prompt_clip_l', '5.inputs.clip_l');
  builder.setInputNode('prompt_t5xxl', '5.inputs.t5xxl');

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

  // 图生图模式下的额外映射
  if (hasInputImage) {
    builder.setInputNode('imageUrl', 'img_load.inputs.image');
    builder.setInputNode('denoise', '9.inputs.denoise');
  } else {
    // 文生图模式下仍然需要denoise映射，但会使用默认值
    builder.setInputNode('denoise', '9.inputs.denoise');
  }

  // 处理prompt分离
  const { t5xxlPrompt, clipLPrompt } = splitPromptForDualCLIP(params.prompt ?? '');

  // Apply input values to workflow
  const width = params.width ?? WORKFLOW_DEFAULTS.IMAGE.WIDTH;
  const height = params.height ?? WORKFLOW_DEFAULTS.IMAGE.HEIGHT;
  const cfg = params.cfg ?? WORKFLOW_DEFAULTS.KONTEXT.CFG;

  // Manually set values for nodes that need the same parameters (since setInputNode can only map one-to-one)
  workflow['5'].inputs.guidance = cfg; // CLIPTextEncodeFlux needs guidance

  if (!hasInputImage) {
    // Text-to-image mode: ModelSamplingFlux needs width/height (EmptySD3LatentImage will get it via setInputNode)
    workflow['4'].inputs.width = width;
    workflow['4'].inputs.height = height;
  } else {
    // Image-to-image mode: EmptySD3LatentImage needs width/height (ModelSamplingFlux will get it via setInputNode)
    if (workflow['7']) {
      workflow['7'].inputs.width = width;
      workflow['7'].inputs.height = height;
    }
  }

  // 设置输入值 (these will be applied to nodes mapped via setInputNode)
  builder
    .input('prompt_clip_l', clipLPrompt)
    .input('prompt_t5xxl', t5xxlPrompt)
    .input('width', width)
    .input('height', height)
    .input('steps', params.steps ?? WORKFLOW_DEFAULTS.KONTEXT.STEPS)
    .input('cfg', cfg)
    .input('seed', params.seed ?? generateUniqueSeeds(1)[0]);

  if (hasInputImage) {
    builder
      .input('imageUrl', params.imageUrl || params.imageUrls?.[0] || '')
      .input('denoise', params.denoise ?? 0.75);
  } else {
    // 文生图模式使用默认denoise值
    builder.input('denoise', params.denoise ?? WORKFLOW_DEFAULTS.SAMPLING.DENOISE);
  }

  return builder;
}
