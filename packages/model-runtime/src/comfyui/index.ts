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
// Removed unused debugVerbose variable

/**
 * ComfyUI Runtime 实现
 * 支持 FLUX 系列模型的文生图和图像编辑
 */
// Export ComfyUI utilities and types
export { ComfyUIModelResolver } from './utils/modelResolver';
export * from './workflows';

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
    const {
      baseURL = process.env.COMFYUI_DEFAULT_URL || 'http://localhost:8188',
      authType = 'none',
    } = options;

    // 强制校验
    if (authType === 'basic' && (!options.username || !options.password)) {
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.InvalidComfyUIArgs);
    }
    if (authType === 'bearer' && !options.apiKey) {
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.InvalidProviderAPIKey);
    }

    this.options = options;
    this.baseURL = baseURL;
    const credentials = this.createCredentials(this.options);
    this.connectionValidated = false;

    this.client = new ComfyApi(this.baseURL, undefined, { credentials });
    this.client.init();

    // 在创建客户端后，将其传递给 modelResolver 以支持认证请求
    this.modelResolver = new ComfyUIModelResolver(this.client);
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
      // Debug logging
      log('Connection error caught:', error);
      log('Error type:', error?.constructor?.name);
      log('Error message:', (error as any)?.message);

      // 复用现有的错误处理器
      const { error: parsedError, errorType } = parseComfyUIErrorMessage(error);

      log('Parsed error type:', errorType);
      log('Parsed error:', parsedError);

      throw AgentRuntimeError.createError(errorType, {
        error: parsedError,
      });
    }
  }

  /**
   * Discover available models from ComfyUI server
   */
  async models(): Promise<ChatModelCard[]> {
    // models() 方法保留 ensureConnection，因为这不涉及 async 任务队列
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
    // 移除 ensureConnection，让错误在实际请求时被捕获并正确处理
    // await this.ensureConnection();

    const { model, params } = payload;
    const startTime = Date.now();

    try {
      log('Starting waitForReady...');
      const waitStart = Date.now();
      await this.client.waitForReady();
      log('waitForReady completed in %d ms', Date.now() - waitStart);

      // Get actual model filename for workflow
      log('Resolving model filename...');
      const resolveStart = Date.now();
      const modelFileName = await this.modelResolver.resolveModelFileName(model);
      log('Model resolution completed in %d ms', Date.now() - resolveStart);
      log('Model ID:', model);
      log('Resolved model filename:', modelFileName);

      // Direct workflow building with resolved model name
      const workflow = this.buildWorkflow(model, modelFileName, params);
      // PromptBuilder has a public prompt property
      const workflowPrompt = workflow.prompt;

      // Log comprehensive workflow details for debugging
      const workflowStr = JSON.stringify(workflowPrompt, null, 2);
      log('🔧 === WORKFLOW DEBUG INFORMATION ===');
      log('Model ID:', model);
      log('Model Filename:', modelFileName);
      log('Input Parameters:', JSON.stringify(params, null, 2));
      log('Workflow Keys:', workflowPrompt ? Object.keys(workflowPrompt) : 'undefined');

      // Log complete workflow structure (for 400 error debugging)
      if (workflowPrompt) {
        log('📋 Complete Workflow JSON to be sent to ComfyUI:');
        log(workflowStr);

        // Validate workflow structure
        const nodeIds = Object.keys(workflowPrompt);
        log('Total nodes:', nodeIds.length);

        // Check for common issues
        nodeIds.forEach((nodeId) => {
          const node = workflowPrompt[nodeId];
          if (!node.class_type) {
            log(`⚠️ Node ${nodeId} missing class_type`);
          }
          if (!node.inputs) {
            log(`⚠️ Node ${nodeId} missing inputs`);
          }
          // Check for invalid input references
          if (node.inputs) {
            Object.entries(node.inputs).forEach(([key, value]) => {
              if (Array.isArray(value) && value.length === 2) {
                const [refNodeId] = value;
                if (!nodeIds.includes(String(refNodeId))) {
                  log(`❌ Node ${nodeId}.${key} references non-existent node ${refNodeId}`);
                }
              }
            });
          }
        });
      } else {
        log('❌ Workflow prompt is undefined or null!');
      }
      log('🔧 === END WORKFLOW DEBUG ===');

      log('Starting CallWrapper execution at %d ms from start', Date.now() - startTime);
      const callWrapperStart = Date.now();

      const result = await new Promise<any>((resolve, reject) => {
        new CallWrapper(this.client, workflow)
          .onFinished((result: any) => {
            log('CallWrapper finished successfully in %d ms', Date.now() - callWrapperStart);
            resolve(result);
          })
          .onFailed((error: any) => {
            log(
              '❌ ComfyUI request failed after %d ms:',
              Date.now() - callWrapperStart,
              error?.message || error,
            );

            // Log basic error details
            const status = error?.response?.status || error?.status;
            if (status) {
              log('HTTP Status:', status);
            }

            // Log response data if available
            const responseData = error?.response?.data || error?.data || error?.body;
            if (responseData) {
              log(
                'Response:',
                typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
              );
            }

            reject(error);
          })
          .onProgress((info: any) => {
            // Handle progress updates if needed
            const elapsed = Date.now() - callWrapperStart;
            log('Progress at %d ms:', elapsed, info);
          })
          .run();
      });

      const images = result.images?.images ?? [];
      if (images.length === 0) {
        throw AgentRuntimeError.createImage({
          error: new Error('Empty result from ComfyUI workflow'),
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
    // Add comfyui/ prefix if not present for workflow lookup
    const fullModelId = model.startsWith('comfyui/') ? model : `comfyui/${model}`;

    // Debug logging
    log('=== Workflow Selection Debug ===');
    log('Original model:', model);
    log('Full model ID:', fullModelId);
    log('Available workflow builders:', Object.keys(LobeComfyUI.WORKFLOW_BUILDERS));

    const workflowBuilder =
      LobeComfyUI.WORKFLOW_BUILDERS[fullModelId as keyof typeof LobeComfyUI.WORKFLOW_BUILDERS];
    if (workflowBuilder) {
      log('Found exact workflow builder for:', fullModelId);
      try {
        const workflow = workflowBuilder(modelFileName, params);
        log('✅ Workflow created successfully');
        return workflow;
      } catch (error) {
        log('❌ Error creating workflow:', error);
        throw error;
      }
    }

    // Smart FLUX model detection for variants not in WORKFLOW_BUILDERS
    const modelName = fullModelId.replace('comfyui/', '').toLowerCase();

    log('No exact match found, checking FLUX detection...');
    log('Model name for detection:', modelName);

    if (modelName.includes('flux')) {
      log('✅ FLUX model detected, routing to appropriate workflow');
      // Route FLUX model variants to appropriate workflows
      if (modelName.includes('schnell')) {
        log('Using FluxSchnellWorkflow for:', modelName);
        const workflow = buildFluxSchnellWorkflow(modelFileName, params);
        log('Workflow input parameters:', (workflow as any).inputParameters);
        log('Workflow prompt keys:', Object.keys(workflow.prompt || {}));
        return workflow;
      } else if (modelName.includes('krea')) {
        log('Using FluxKreaWorkflow for:', modelName);
        const workflow = buildFluxKreaWorkflow(modelFileName, params);
        log('Workflow input parameters:', (workflow as any).inputParameters);
        log('Workflow prompt keys:', Object.keys(workflow.prompt || {}));
        return workflow;
      } else if (modelName.includes('kontext')) {
        log('Using FluxKontextWorkflow for:', modelName);
        const workflow = buildFluxKontextWorkflow(modelFileName, params);
        log('Workflow input parameters:', (workflow as any).inputParameters);
        log('Workflow prompt keys:', Object.keys(workflow.prompt || {}));
        return workflow;
      } else {
        // Default FLUX variant to dev workflow (most common)
        log('Using FluxDevWorkflow (default) for:', modelName);
        const workflow = buildFluxDevWorkflow(modelFileName, params);
        log('Workflow input parameters:', (workflow as any).inputParameters);
        log('Workflow prompt keys:', Object.keys(workflow.prompt || {}));
        return workflow;
      }
    }

    // Fallback to generic SD workflow for unknown models
    log('❌ No FLUX detected, falling back to generic SD workflow for:', modelName);
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
      ['prompt', 'prompt_clip_l', 'negativePrompt', 'width', 'height', 'steps', 'cfg', 'seed'],
      ['images'],
    );

    // 设置输出节点
    builder.setOutputNode('images', '7');

    // 添加setInputNode映射以支持前端参数传递
    builder
      .setInputNode('prompt', '2.inputs.text')
      .setInputNode('prompt_clip_l', '2.inputs.text') // 为兼容性映射到同一个prompt字段
      .setInputNode('negativePrompt', '3.inputs.text')
      .setInputNode('width', '4.inputs.width')
      .setInputNode('height', '4.inputs.height')
      .setInputNode('steps', '5.inputs.steps')
      .setInputNode('cfg', '5.inputs.cfg')
      .setInputNode('seed', '5.inputs.seed');

    // 设置输入值
    builder
      .input('prompt', params.prompt ?? '')
      .input('prompt_clip_l', params.prompt ?? params.prompt_clip_l ?? '')
      .input('negativePrompt', params.negativePrompt ?? '')
      .input('width', params.width ?? 512)
      .input('height', params.height ?? 512)
      .input('steps', params.steps ?? 20)
      .input('cfg', params.cfg ?? 7)
      .input('seed', params.seed ?? -1);

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
        // 构造函数已验证参数完整性，直接返回
        return { password: password!, type: 'basic', username: username! } as BasicCredentials;
      }

      case 'bearer': {
        // 构造函数已验证参数完整性，直接返回
        return { token: apiKey!, type: 'bearer_token' } as BearerTokenCredentials;
      }

      case 'custom': {
        if (customHeaders && Object.keys(customHeaders).length > 0) {
          return { headers: customHeaders, type: 'custom' } as CustomCredentials;
        }
        return undefined;
      }

      default: {
        return undefined;
      }
    }
  }
}
