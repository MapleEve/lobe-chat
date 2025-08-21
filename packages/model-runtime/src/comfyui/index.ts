import { CallWrapper, ComfyApi, PromptBuilder } from '@saintno/comfyui-sdk';
import type {
  BasicCredentials,
  BearerTokenCredentials,
  CustomCredentials,
} from '@saintno/comfyui-sdk';
import debug from 'debug';

import { ChatModelCard } from '@/types/llm';
import { ComfyUIKeyVault } from '@/types/user/settings';

import { LobeRuntimeAI } from '../BaseAI';
import { AgentRuntimeErrorType } from '../error';
import { CreateImagePayload, CreateImageResponse } from '../types/image';
import { parseComfyUIErrorMessage } from '../utils/comfyuiErrorParser';
import { AgentRuntimeError } from '../utils/createError';
import { MODEL_LIST_CONFIGS, processModelList } from '../utils/modelParse';
import { ComfyUIModelResolver } from './utils/modelResolver';
import { buildFluxDevWorkflow } from './workflows/flux-dev';
import { buildFluxKontextWorkflow } from './workflows/flux-kontext';
import { buildFluxKreaWorkflow } from './workflows/flux-krea';
// Import workflow builders
import { buildFluxSchnellWorkflow } from './workflows/flux-schnell';

const log = debug('lobe-image:comfyui');

/**
 * ComfyUI Runtime 实现
 * 支持 FLUX 系列模型的文生图和图像编辑
 */
export class LobeComfyUI implements LobeRuntimeAI {
  private client: ComfyApi;
  private options: ComfyUIKeyVault;
  private modelResolver: ComfyUIModelResolver;
  private connectionValidated: boolean;
  baseURL: string;

  // Direct workflow mapping - no more string parsing
  private static readonly WORKFLOW_BUILDERS = {
    'comfyui/flux-dev': buildFluxDevWorkflow,
    'comfyui/flux-kontext-dev': buildFluxKontextWorkflow,
    'comfyui/flux-krea-dev': buildFluxKreaWorkflow,
    'comfyui/flux-schnell': buildFluxSchnellWorkflow,
  } as const;

  constructor(options: ComfyUIKeyVault = {}) {
    const { baseURL = 'http://localhost:8188' } = options;

    // 验证配置参数完整性
    this.validateConfiguration(options);

    this.options = options;
    this.baseURL = baseURL;
    this.modelResolver = new ComfyUIModelResolver(this.baseURL);
    const credentials = this.createCredentials(options);
    this.connectionValidated = false;

    this.client = new ComfyApi(this.baseURL, undefined, { credentials });
    this.client.init();
  }

  /**
   * 验证配置参数完整性
   */
  private validateConfiguration(options: ComfyUIKeyVault): void {
    const { authType = 'none' } = options;

    // 验证 basic auth 的完整性
    if (authType === 'basic' && (!options.username || !options.password)) {
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.InvalidComfyUIArgs);
    }

    // 验证 bearer auth 的完整性
    if (authType === 'bearer' && !options.apiKey) {
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.InvalidProviderAPIKey);
    }
  }

  /**
   * 确保 ComfyUI 连接有效，使用现有的错误处理器
   */
  private async ensureConnection(): Promise<void> {
    if (this.connectionValidated) return;

    try {
      // 尝试获取模型列表来验证连接和权限
      const models = await this.modelResolver.getAvailableModelFiles();

      // 验证响应有效性
      if (!Array.isArray(models)) {
        throw new Error('Invalid response from ComfyUI server');
      }

      this.connectionValidated = true;
    } catch (error) {
      // 复用现有的错误处理器
      const { error: parsedError, errorType } = parseComfyUIErrorMessage(error);

      throw AgentRuntimeError.createError(errorType, {
        error: parsedError,
      });
    }
  }

  /**
   * Discover available models from ComfyUI server
   */
  async models(): Promise<ChatModelCard[]> {
    // 确保连接有效，防止无效请求进入处理流程
    await this.ensureConnection();

    try {
      const modelFiles = await this.modelResolver.getAvailableModelFiles();

      if (modelFiles.length === 0) {
        return [];
      }

      // Transform model files to standard format for processModelList
      const modelList = this.modelResolver.transformModelFilesToList(modelFiles);

      // Use processModelList to handle displayName and capabilities
      const processedModels = await processModelList(
        modelList,
        MODEL_LIST_CONFIGS.comfyui || {},
        'comfyui',
      );

      // Add the comfyui/ prefix back to the processed models
      return processedModels.map((model) => ({
        ...model,
        id: `comfyui/${model.id}`,
      }));
    } catch (error) {
      log('Failed to fetch models:', error);
      return [];
    }
  }

  /**
   * Create image
   */
  async createImage(payload: CreateImagePayload): Promise<CreateImageResponse> {
    // 确保连接有效，防止无效请求进入 async 队列
    await this.ensureConnection();

    const { model, params } = payload;

    try {
      await this.client.waitForReady();

      // Get actual model filename for workflow
      const modelFileName = await this.modelResolver.resolveModelFileName(model);

      // Direct workflow building with resolved model name
      const workflow = this.buildWorkflow(model, modelFileName, params);

      const result = await new Promise<any>((resolve, reject) => {
        new CallWrapper(this.client, workflow)
          .onFinished(resolve)
          .onFailed(reject)
          .onProgress((info: any) => {
            // Handle progress updates if needed
            log('Progress:', info);
          })
          .run();
      });

      const images = result.images?.images ?? [];
      if (images.length === 0) {
        throw AgentRuntimeError.createImage({
          error: {
            code: 'EMPTY_RESULT',
            message: 'Empty result from ComfyUI workflow',
            type: 'ComfyUIError',
          },
          errorType: AgentRuntimeErrorType.ComfyUIEmptyResult,
          provider: 'comfyui',
        });
      }

      const imageInfo = images[0];
      return {
        height: imageInfo.height ?? params.height,
        imageUrl: this.client.getPathImage(imageInfo),
        width: imageInfo.width ?? params.width,
      };
    } catch (error) {
      // 保留已有的 AgentRuntimeError
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }

      // 使用结构化错误解析器
      const { error: parsedError, errorType } = parseComfyUIErrorMessage(error);

      throw AgentRuntimeError.createImage({
        error: parsedError,
        errorType,
        provider: 'comfyui',
      });
    }
  }

  /**
   * Build workflow directly from model ID
   */
  private buildWorkflow(
    model: string,
    modelFileName: string,
    params: Record<string, any>,
  ): PromptBuilder<any, any, any> {
    // Direct model ID lookup with full comfyui/ prefix
    const workflowBuilder =
      LobeComfyUI.WORKFLOW_BUILDERS[model as keyof typeof LobeComfyUI.WORKFLOW_BUILDERS];
    if (workflowBuilder) {
      return workflowBuilder(modelFileName, params);
    }

    // Fallback to generic SD workflow for unknown models
    return this.buildGenericSDWorkflow(modelFileName, params);
  }

  /**
   * Generic SD workflow for unsupported models
   */
  private buildGenericSDWorkflow(
    modelFileName: string,
    params: Record<string, any>,
  ): PromptBuilder<any, any, any> {
    const workflow = {
      '1': {
        _meta: { title: 'Load Checkpoint' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: modelFileName },
      },
      '2': {
        _meta: { title: 'CLIP Text Encode (Positive)' },
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['1', 1],
          text: params.prompt ?? '',
        },
      },
      '3': {
        _meta: { title: 'CLIP Text Encode (Negative)' },
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['1', 1],
          text: params.negativePrompt ?? '',
        },
      },
      '4': {
        _meta: { title: 'Empty Latent Image' },
        class_type: 'EmptyLatentImage',
        inputs: {
          batch_size: 1,
          height: params.height ?? 512,
          width: params.width ?? 512,
        },
      },
      '5': {
        _meta: { title: 'K Sampler' },
        class_type: 'KSampler',
        inputs: {
          cfg: params.cfg ?? 7,
          denoise: 1,
          latent_image: ['4', 0],
          model: ['1', 0],
          negative: ['3', 0],
          positive: ['2', 0],
          sampler_name: params.samplerName ?? 'euler',
          scheduler: params.scheduler ?? 'normal',
          seed: params.seed ?? -1,
          steps: params.steps ?? 20,
        },
      },
      '6': {
        _meta: { title: 'VAE Decode' },
        class_type: 'VAEDecode',
        inputs: {
          samples: ['5', 0],
          vae: ['1', 2],
        },
      },
      '7': {
        _meta: { title: 'Save Image' },
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'comfyui',
          images: ['6', 0],
        },
      },
    };

    const builder = new PromptBuilder(
      workflow,
      ['prompt', 'negativePrompt', 'width', 'height', 'steps', 'cfg', 'seed'],
      ['images'],
    );

    builder.setOutputNode('images', '7');
    return builder;
  }

  /**
   * Create authentication credentials
   */
  private createCredentials(
    options: ComfyUIKeyVault,
  ): BasicCredentials | BearerTokenCredentials | CustomCredentials | undefined {
    const { authType = 'none', apiKey, username, password, customHeaders } = options;

    switch (authType) {
      case 'basic': {
        if (username && password) {
          return { password, type: 'basic', username } as BasicCredentials;
        }
        break;
      }

      case 'bearer': {
        if (apiKey) {
          return { token: apiKey, type: 'bearer_token' } as BearerTokenCredentials;
        }
        break;
      }

      case 'custom': {
        if (customHeaders && Object.keys(customHeaders).length > 0) {
          return { headers: customHeaders, type: 'custom' } as CustomCredentials;
        }
        break;
      }

      default: {
        return undefined;
      }
    }
  }
}
