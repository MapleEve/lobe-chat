import { CallWrapper, ComfyApi, PromptBuilder } from '@saintno/comfyui-sdk';
import type {
  BasicCredentials,
  BearerTokenCredentials,
  CustomCredentials,
} from '@saintno/comfyui-sdk';
import debug from 'debug';
import { ClientOptions } from 'openai';

import { ChatModelCard } from '@/types/llm';

import { LobeRuntimeAI } from '../BaseAI';
import { AgentRuntimeErrorType } from '../error';
import { CreateImagePayload, CreateImageResponse } from '../types/image';
import { AgentRuntimeError } from '../utils/createError';

const log = debug('lobe-image:comfyui');

/**
 * ComfyUI Runtime 实现
 * 支持 FLUX 系列模型的文生图和图像编辑
 */
export class LobeComfyUIAI implements LobeRuntimeAI {
  private client: ComfyApi;
  baseURL: string;

  constructor(options: ClientOptions = {}) {
    const { apiKey, baseURL = 'http://localhost:8188' } = options;

    this.baseURL = baseURL as string;

    // 根据配置创建认证凭据
    const credentials = this.createCredentials(apiKey);

    // 初始化 ComfyAPI 客户端
    this.client = new ComfyApi(this.baseURL, undefined, { credentials });
    this.client.init();

    log('ComfyUI initialized with baseURL: %s', baseURL);
  }

  /**
   * 获取可用模型列表（无缓存，直接调用 API）
   * 参考 Ollama 的实现模式
   */
  async models(): Promise<ChatModelCard[]> {
    try {
      // 等待客户端就绪
      await this.client.waitForReady();

      // 获取所有可用的检查点模型
      const checkpoints = await this.getCheckpoints();

      // 转换为标准的 ChatModelCard 格式
      return checkpoints.map((checkpoint) => ({
        displayName: this.getDisplayName(checkpoint),
        enabled: true,
        // ComfyUI 主要用于图像生成，不支持文本对话功能
functionCall: false,
        
        id: `comfyui/${this.normalizeModelName(checkpoint)}`,
        reasoning: false,
        vision: false,
      }));
    } catch (error) {
      log('Error fetching models: %O', error);
      // 如果获取失败，返回默认的 FLUX 模型
      return this.getDefaultModels();
    }
  }

  /**
   * 创建图像
   */
  async createImage(payload: CreateImagePayload): Promise<CreateImageResponse> {
    const { model, params } = payload;
    log('Creating image with model: %s and params: %O', model, params);

    try {
      // 等待客户端就绪
      await this.client.waitForReady();

      // 动态查找最佳匹配的模型
      const actualModel = await this.findBestModel(model);

      // 根据模型类型构建工作流
      const workflow = this.buildWorkflowForModel(actualModel, params);

      // 执行工作流
      const result = await new Promise<any>((resolve, reject) => {
        new CallWrapper(this.client, workflow)
          .onFinished((data) => {
            log('Workflow finished with data: %O', data);
            resolve(data);
          })
          .onFailed((error) => {
            log('Workflow failed with error: %O', error);
            reject(error);
          })
          .onProgress((info) => {
            log('Workflow progress: %O', info);
          })
          .run();
      });

      // 提取图像 URL
      const images = result.images?.images || [];
      if (images.length === 0) {
        throw AgentRuntimeError.createError(AgentRuntimeErrorType.ProviderBizError, {
          error: new Error('No images generated'),
        });
      }

      const imageInfo = images[0];
      const imageUrl = this.client.getPathImage(imageInfo);

      return {
        height: imageInfo.height || params.height,
        imageUrl,
        width: imageInfo.width || params.width,
      };
    } catch (error) {
      log('Error creating image: %O', error);

      // 检查是否已经是 AgentRuntimeError
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }

      throw AgentRuntimeError.createError(AgentRuntimeErrorType.ProviderBizError, { error });
    }
  }

  /**
   * 创建认证凭据
   */
  private createCredentials(
    apiKey?: string,
  ): BasicCredentials | BearerTokenCredentials | CustomCredentials | undefined {
    if (!apiKey) return undefined;

    // 解析认证配置
    // 格式1: "basic:username:password"
    // 格式2: "bearer:token"
    // 格式3: "custom:header1=value1,header2=value2"
    // 格式4: 直接作为 Bearer Token

    if (apiKey.startsWith('basic:')) {
      const [, username, password] = apiKey.split(':');
      return { password, type: 'basic', username } as BasicCredentials;
    }

    if (apiKey.startsWith('bearer:')) {
      const token = apiKey.slice(7);
      return { token, type: 'bearer_token' } as BearerTokenCredentials;
    }

    if (apiKey.startsWith('custom:')) {
      const headerStr = apiKey.slice(7);
      const headers: Record<string, string> = {};
      headerStr.split(',').forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key && value) headers[key] = value;
      });
      return { headers, type: 'custom' } as CustomCredentials;
    }

    // 默认作为 Bearer Token
    return { token: apiKey, type: 'bearer_token' } as BearerTokenCredentials;
  }

  /**
   * 获取可用的检查点模型（无缓存，每次实时查询）
   */
  private async getCheckpoints(): Promise<string[]> {
    try {
      // 通过 ComfyUI API 获取对象信息
      const response = await fetch(`${this.baseURL}/object_info`);
      const objectInfo = await response.json();

      // 查找 CheckpointLoaderSimple 节点的输入信息
      const checkpointLoader = objectInfo.CheckpointLoaderSimple;
      if (checkpointLoader?.input?.required?.ckpt_name?.[0]) {
        return checkpointLoader.input.required.ckpt_name[0] as string[];
      }

      return [];
    } catch (error) {
      log('Error fetching checkpoints: %O', error);
      return [];
    }
  }

  /**
   * 动态查找最佳匹配的模型（无缓存）
   */
  private async findBestModel(requestedModel: string): Promise<string> {
    const availableCheckpoints = await this.getCheckpoints();

    // 提取模型名称（去掉 comfyui/ 前缀）
    const modelName = requestedModel.replace(/^comfyui\//, '');

    // 精确匹配
    const exactMatch = availableCheckpoints.find(
      (checkpoint) => this.normalizeModelName(checkpoint) === modelName,
    );
    if (exactMatch) return exactMatch;

    // 模糊匹配（包含关键词）
    const keywords = modelName.toLowerCase().split(/[_-]/);
    const fuzzyMatch = availableCheckpoints.find((checkpoint) => {
      const checkpointLower = checkpoint.toLowerCase();
      return keywords.some((keyword) => checkpointLower.includes(keyword));
    });
    if (fuzzyMatch) return fuzzyMatch;

    // 默认匹配 FLUX 模型
    const fluxMatch = availableCheckpoints.find((checkpoint) =>
      checkpoint.toLowerCase().includes('flux'),
    );
    if (fluxMatch) return fluxMatch;

    // 如果都没找到，使用第一个可用模型
    if (availableCheckpoints.length > 0) {
      return availableCheckpoints[0];
    }

    throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
      model: requestedModel,
    });
  }

  /**
   * 标准化模型名称
   */
  private normalizeModelName(checkpoint: string): string {
    return checkpoint
      .replace(/\.(safetensors|ckpt|pt)$/i, '')
      .replaceAll(/[_-]/g, '-')
      .toLowerCase();
  }

  /**
   * 获取显示名称
   */
  private getDisplayName(checkpoint: string): string {
    return checkpoint
      .replace(/\.(safetensors|ckpt|pt)$/i, '')
      .replaceAll(/[_-]/g, ' ')
      .replaceAll(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * 获取默认模型列表
   */
  private getDefaultModels(): ChatModelCard[] {
    return [
      {
        displayName: 'FLUX Schnell',
        enabled: true,
        functionCall: false,
        id: 'comfyui/flux-schnell',
        reasoning: false,
        vision: false,
      },
      {
        displayName: 'FLUX Dev',
        enabled: true,
        functionCall: false,
        id: 'comfyui/flux-dev',
        reasoning: false,
        vision: false,
      },
    ];
  }

  /**
   * 根据模型构建工作流
   */
  private buildWorkflowForModel(
    modelName: string,
    params: Record<string, any>,
  ): PromptBuilder<any, any, any> {
    const modelLower = modelName.toLowerCase();

    // 判断是否为 FLUX 模型
    if (modelLower.includes('flux')) {
      if (modelLower.includes('schnell')) {
        return this.buildFluxSchnellWorkflow(modelName, params);
      } else {
        return this.buildFluxDevWorkflow(modelName, params);
      }
    }

    // 默认使用通用 SD 工作流
    return this.buildGenericSDWorkflow(modelName, params);
  }

  /**
   * 构建 FLUX Schnell 工作流（4步快速生成）
   */
  private buildFluxSchnellWorkflow(
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
      '2': {
        _meta: {
          title: 'UNET Loader',
        },
        class_type: 'UNETLoader',
        inputs: {
          unet_name: modelName,
          weight_dtype: 'fp8_e4m3fn',
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
          title: 'CLIP Text Encode (Flux)',
        },
        class_type: 'CLIPTextEncodeFlux',
        inputs: {
          clip: ['1', 0],
          clip_l: params.prompt || '',
          guidance: 1,
          t5xxl: params.prompt || '',
        },
      },
      '5': {
        _meta: {
          title: 'Empty SD3 Latent Image',
        },
        class_type: 'EmptySD3LatentImage',
        inputs: {
          batch_size: 1,
          height: params.height || 1024,
          width: params.width || 1024,
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
          sampler_name: 'euler',
          scheduler: 'simple',
          seed: params.seed || -1,
          steps: params.steps || 4,
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
          filename_prefix: 'flux_schnell',
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

  /**
   * 构建 FLUX Dev 工作流（高质量20步生成）
   */
  private buildFluxDevWorkflow(
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
          filename_prefix: 'flux_dev',
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
          weight_dtype: 'fp8_e4m3fn',
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
          height: params.height || 1024,
          max_shift: 1.15,
          model: ['2', 0],
          width: params.width || 1024,
        },
      },
      '5': {
        _meta: {
          title: 'CLIP Text Encode (Flux)',
        },
        class_type: 'CLIPTextEncodeFlux',
        inputs: {
          clip: ['1', 0],
          clip_l: params.prompt || '',
          guidance: params.cfg || 3.5,
          t5xxl: params.prompt || '',
        },
      },
      '6': {
        _meta: {
          title: 'Flux Guidance',
        },
        class_type: 'FluxGuidance',
        inputs: {
          conditioning: ['5', 0],
          guidance: params.cfg || 3.5,
        },
      },
      '7': {
        _meta: {
          title: 'Empty SD3 Latent Image',
        },
        class_type: 'EmptySD3LatentImage',
        inputs: {
          batch_size: 1,
          height: params.height || 1024,
          width: params.width || 1024,
        },
      },
      '8': {
        _meta: {
          title: 'K Sampler Select',
        },
        class_type: 'KSamplerSelect',
        inputs: {
          sampler_name: 'euler',
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
          scheduler: 'simple',
          steps: params.steps || 20,
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

  /**
   * 构建通用 SD 工作流
   */
  private buildGenericSDWorkflow(
    modelName: string,
    params: Record<string, any>,
  ): PromptBuilder<any, any, any> {
    const workflow = {
      '1': {
        _meta: {
          title: 'Load Checkpoint',
        },
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: modelName,
        },
      },
      '2': {
        _meta: {
          title: 'CLIP Text Encode (Positive)',
        },
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['1', 1],
          text: params.prompt || '',
        },
      },
      '3': {
        _meta: {
          title: 'CLIP Text Encode (Negative)',
        },
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['1', 1],
          text: params.negative_prompt || '',
        },
      },
      '4': {
        _meta: {
          title: 'Empty Latent Image',
        },
        class_type: 'EmptyLatentImage',
        inputs: {
          batch_size: 1,
          height: params.height || 512,
          width: params.width || 512,
        },
      },
      '5': {
        _meta: {
          title: 'K Sampler',
        },
        class_type: 'KSampler',
        inputs: {
          cfg: params.cfg || 7,
          denoise: 1,
          latent_image: ['4', 0],
          model: ['1', 0],
          negative: ['3', 0],
          positive: ['2', 0],
          sampler_name: 'euler',
          scheduler: 'normal',
          seed: params.seed || -1,
          steps: params.steps || 20,
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
          filename_prefix: 'comfyui',
          images: ['6', 0],
        },
      },
    };

    // 创建 PromptBuilder
    const builder = new PromptBuilder(
      workflow,
      ['prompt', 'negative_prompt', 'width', 'height', 'steps', 'cfg', 'seed'],
      ['images'],
    );

    // 设置输出节点
    builder.setOutputNode('images', '7');

    return builder;
  }
}
