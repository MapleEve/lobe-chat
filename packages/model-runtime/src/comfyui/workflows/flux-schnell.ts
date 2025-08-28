import { PromptBuilder } from '@saintno/comfyui-sdk';

import { generateUniqueSeeds } from '../../../../utils/src/number';
import { FLUX_MODEL_CONFIG, WORKFLOW_DEFAULTS } from '../constants';
import type { WorkflowContext } from '../services/workflowBuilder';
import { splitPromptForDualCLIP } from '../utils/promptSplitter';
import { selectOptimalWeightDtype } from '../utils/weightDType';

/**
 * FLUX Schnell 工作流构建器 / FLUX Schnell Workflow Builder
 *
 * @description 构建4步快速生成工作流，针对速度优化
 * Builds 4-step fast generation workflow optimized for speed
 *
 * @param {string} modelName - 模型文件名 / Model filename
 * @param {Record<string, any>} params - 生成参数 / Generation parameters
 * @param {WorkflowContext} context - 工作流上下文 / Workflow context
 * @returns {PromptBuilder<any, any, any>} 构建的工作流 / Built workflow
 */
export async function buildFluxSchnellWorkflow(
  modelFileName: string,
  params: Record<string, any>,
  context: WorkflowContext,
): Promise<PromptBuilder<any, any, any>> {
  // Get required components - will throw if not available (workflow cannot run without them)
  const selectedT5Model = await context.modelResolverService.getOptimalComponent('t5', 'FLUX');
  const selectedVAE = await context.modelResolverService.getOptimalComponent('vae', 'FLUX');
  const selectedCLIP = await context.modelResolverService.getOptimalComponent('clip', 'FLUX');

  // 处理prompt分离 - 在工作流构建早期进行
  const { t5xxlPrompt, clipLPrompt } = splitPromptForDualCLIP(params.prompt ?? '');

  /* eslint-disable sort-keys-fix/sort-keys-fix */
  const workflow = {
    '1': {
      _meta: {
        title: 'DualCLIP Loader',
      },
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: selectedT5Model,
        clip_name2: selectedCLIP,
        type: 'flux',
      },
    },
    '2': {
      _meta: {
        title: 'UNET Loader',
      },
      class_type: 'UNETLoader',
      inputs: {
        unet_name: modelFileName,
        weight_dtype: selectOptimalWeightDtype(modelFileName),
      },
    },
    '3': {
      _meta: {
        title: 'VAE Loader',
      },
      class_type: 'VAELoader',
      inputs: {
        vae_name: selectedVAE,
      },
    },
    '4': {
      _meta: {
        title: 'CLIP Text Encode (Flux)',
      },
      class_type: 'CLIPTextEncodeFlux',
      inputs: {
        clip: ['1', 0],
        clip_l: clipLPrompt,
        guidance: WORKFLOW_DEFAULTS.SCHNELL.CFG,
        t5xxl: t5xxlPrompt, // Schnell 使用 CFG 1
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
  /* eslint-enable sort-keys-fix/sort-keys-fix */

  // 直接设置prompt值到工作流节点，而不依赖PromptBuilder的输入映射
  workflow['4'].inputs.clip_l = clipLPrompt;
  workflow['4'].inputs.t5xxl = t5xxlPrompt;

  // Apply input values to workflow
  const width = params.width ?? WORKFLOW_DEFAULTS.IMAGE.WIDTH;
  const height = params.height ?? WORKFLOW_DEFAULTS.IMAGE.HEIGHT;
  const cfg = params.cfg ?? WORKFLOW_DEFAULTS.SCHNELL.CFG;
  const steps = params.steps ?? WORKFLOW_DEFAULTS.SCHNELL.STEPS;
  const seed = params.seed ?? generateUniqueSeeds(1)[0];

  // Set shared values directly to avoid conflicts
  workflow['5'].inputs.width = width; // EmptySD3LatentImage needs width/height
  workflow['5'].inputs.height = height;
  workflow['4'].inputs.guidance = cfg; // CLIPTextEncodeFlux needs guidance
  workflow['6'].inputs.cfg = cfg; // KSampler needs cfg
  workflow['6'].inputs.steps = steps; // KSampler needs steps
  workflow['6'].inputs.seed = seed; // KSampler needs seed

  // 创建 PromptBuilder - 移除prompt相关的输入参数，因为已直接设置
  const builder = new PromptBuilder(
    workflow,
    ['width', 'height', 'steps', 'cfg', 'seed'], // 移除prompt相关参数
    ['images'],
  );

  // 设置输出节点
  builder.setOutputNode('images', '8');

  // 设置输入节点映射
  builder.setInputNode('seed', '6.inputs.seed');
  builder.setInputNode('width', '5.inputs.width');
  builder.setInputNode('height', '5.inputs.height');
  builder.setInputNode('steps', '6.inputs.steps');
  builder.setInputNode('cfg', '6.inputs.cfg');

  // 设置输入值（不包括prompt，已直接设置到工作流）
  builder
    .input('width', width)
    .input('height', height)
    .input('steps', steps)
    .input('cfg', cfg)
    .input('seed', seed);

  return builder;
}
