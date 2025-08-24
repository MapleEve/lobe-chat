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
import { ModelValidationManager } from './utils/modelValidationManager';
import { WorkflowTypeDetector } from './utils/WorkflowTypeDetector';
import { WorkflowRouter, WorkflowRoutingError } from './utils/WorkflowRouter';

const log = debug('lobe-image:comfyui');
// Removed unused debugVerbose variable

/**
 * ComfyUI Runtime implementation / ComfyUI Runtime 实现
 * Supports text-to-image and image editing for FLUX series models / 支持 FLUX 系列模型的文生图和图像编辑
 */
// Export ComfyUI utilities and types
export { ComfyUIModelResolver } from './utils/modelResolver';
export * from './workflows';

export class LobeComfyUI implements LobeRuntimeAI {
  private client: ComfyApi;
  private options: ComfyUIKeyVault;
  private modelResolver: ComfyUIModelResolver;
  protected modelValidator: ModelValidationManager;

  // Test helper method to set model validator for testing purposes
  setModelValidatorForTesting(validator: ModelValidationManager) {
    this.modelValidator = validator;
  }
  private connectionValidated: boolean;
  baseURL: string;

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

    // 在创建客户端后，将其传递给 modelResolver 和 modelValidator 以支持认证请求
    this.modelResolver = new ComfyUIModelResolver(this.client);
    this.modelValidator = new ModelValidationManager(() => this.modelResolver.getAvailableModelFiles());
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

    const { model, params } = payload;

    try {
      await this.client.waitForReady();

      // 1. 首先进行严格的模型存在性验证
      const validationResult = await this.modelValidator.validateModelExistence(model);
      log('Model ID:', model);
      log('Model validation result:', validationResult);

      // 2. 使用验证通过的实际文件名构建工作流
      const modelFileName = validationResult.actualFileName!; // 验证通过必然有文件名
      log('Validated model filename:', modelFileName);

      // Direct workflow building with validated model name
      const workflow = this.buildWorkflow(model, modelFileName, params);

      // 🔍 DEBUG: Log the actual workflow being sent to ComfyUI
      log('=== ACTUAL WORKFLOW BEING SENT TO COMFYUI ===');
      log('Model ID:', model);
      log('Model Filename:', modelFileName);
      try {
        const workflowJson = JSON.stringify(workflow.prompt, null, 2);
        log('Full Workflow JSON:');
        log(workflowJson);

        // Look for SamplerCustomAdvanced node specifically
        const workflowNodes = workflow.prompt || {};
        const samplerNodes = Object.entries(workflowNodes).filter(([_, node]) =>
          (node as any).class_type === 'SamplerCustomAdvanced'
        );

        if (samplerNodes.length > 0) {
          log('Found SamplerCustomAdvanced nodes:');
          samplerNodes.forEach(([nodeId, node]) => {
            log(`Node ${nodeId}:`, JSON.stringify(node, null, 2));
          });
        }

        // Look for BasicGuider nodes specifically
        const guiderNodes = Object.entries(workflowNodes).filter(([_, node]) =>
          (node as any).class_type === 'BasicGuider'
        );

        if (guiderNodes.length > 0) {
          log('Found BasicGuider nodes:');
          guiderNodes.forEach(([nodeId, node]) => {
            log(`Node ${nodeId}:`, JSON.stringify(node, null, 2));
          });
        } else {
          log('❌ WARNING: No BasicGuider nodes found in workflow!');
        }
      } catch (error) {
        log('Error serializing workflow:', error);
      }
      log('=== END WORKFLOW DEBUG ===');

      const result = await new Promise<any>((resolve, reject) => {
        new CallWrapper(this.client, workflow)
          .onFinished(resolve)
          .onFailed((error: any) => {
            log('❌ ComfyUI request failed:', error?.message || error);

            // If error already has errorType, it's an existing structured error - re-throw as-is
            if (error && typeof error === 'object' && 'errorType' in error) {
              reject(error);
              return;
            }

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

            // Parse error using our error parser for better error categorization
            const { error: parsedError, errorType } = parseComfyUIErrorMessage(error);
            log('Parsed error type:', errorType);
            log('Parsed error details:', parsedError);

            // Create structured error
            const structuredError = AgentRuntimeError.createImage({
              error: parsedError,
              errorType,
              provider: 'comfyui',
            });

            reject(structuredError);
          })
          .onProgress((info: any) => {
            // Handle progress updates if needed
            log('Progress:', info);
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
      // 保留已有的 AgentRuntimeError (已在 onFailed 中处理)
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }

      // 使用结构化错误解析器处理其他未捕获的错误
      const { error: parsedError, errorType } = parseComfyUIErrorMessage(error);

      throw AgentRuntimeError.createImage({
        error: parsedError,
        errorType,
        provider: 'comfyui',
      });
    }
  }

  /**
   * Build workflow using modern type detection and routing
   *
   * This method has been completely refactored to:
   * - Use strict model type detection
   * - Remove dangerous SD fallback logic
   * - Provide clear error messages for unsupported models
   * - Maintain compatibility with existing API
   */
  private buildWorkflow(
    model: string,
    modelFileName: string,
    params: Record<string, any>,
  ): PromptBuilder<any, any, any> {
    log('🔧 Building workflow for model:', model);

    // Step 1: Detect model type using modern detection system
    const detectionResult = WorkflowTypeDetector.detectModelType(model);
    log('Model detection result:', detectionResult);

    // Step 2: Validate model architecture compatibility
    if (!detectionResult.isSupported) {
      const supportedModels = WorkflowRouter.getExactlySupportedModels();
      const supportedVariants = WorkflowRouter.getSupportedFluxVariants();

      throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
        error: `Unsupported model "${model}". ` +
               `Architecture: ${detectionResult.architecture}. ` +
               `Supported exact models: [${supportedModels.join(', ')}]. ` +
               `Supported FLUX variants: [${supportedVariants.join(', ')}].`,
        model,
      });
    }

    // Step 3: Route to appropriate workflow builder
    try {
      const workflow = WorkflowRouter.routeWorkflow(
        model,
        detectionResult,
        modelFileName,
        params
      );

      log('✅ Workflow built successfully for:', model);
      return workflow;
    } catch (error) {
      if (error instanceof WorkflowRoutingError) {
        // Convert routing error to runtime error
        throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
          error: error.message,
          model: error.modelId,
        });
      }

      // Re-throw other errors as-is
      throw error;
    }
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
