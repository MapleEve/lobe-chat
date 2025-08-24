import { ComfyApi } from '@saintno/comfyui-sdk';

import { AgentRuntimeErrorType } from '../../error';
import { AgentRuntimeError } from '../../utils/createError';
import { ModelValidationManager } from './modelValidationManager';

/**
 * ComfyUI model resolver utility class / ComfyUI 模型解析工具类
 * Responsible for fetching and parsing model information from ComfyUI server / 负责从 ComfyUI 服务器获取和解析模型信息
 * 
 * Refactored version fully depends on ModelValidationManager for strict validation / 重构后的版本完全依赖 ModelValidationManager 进行严格验证
 * Remove all fallback logic to ensure only models that actually exist are used / 移除所有回退逻辑，确保只使用确实存在的模型
 */
export class ComfyUIModelResolver {
  private client: ComfyApi;
  private modelValidator: ModelValidationManager;

  constructor(client: ComfyApi) {
    this.client = client;
    this.modelValidator = new ModelValidationManager(() => this.getAvailableModelFiles());
  }

  /**
   * Get available model file list from ComfyUI server / 获取 ComfyUI 服务器上可用的模型文件列表
   * Use ComfyApi client for requests (supports all auth modes including authType='none') / 使用 ComfyApi 客户端进行请求（支持所有认证模式包括 authType='none'）
   */
  async getAvailableModelFiles(): Promise<string[]> {
    try {
      // Use ComfyApi client for requests, authentication handled internally by client / 使用 ComfyApi 客户端进行请求，认证由客户端内部处理
      const response = await this.client.fetchApi('/object_info', {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      });

      // Check response status / 检查响应状态
      if (!response.ok) {
        // For non-200 responses, should throw error for upper layer handling / 对于非 200 响应，应该抛出错误让上层处理
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      const objectInfo = await response.json();

      const checkpointLoader = objectInfo.CheckpointLoaderSimple;

      if (!checkpointLoader?.input?.required?.ckpt_name?.[0]) {
        throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
          model: 'No models available on ComfyUI server',
        });
      }

      return checkpointLoader.input.required.ckpt_name[0] as string[];
    } catch (error) {
      // 如果是已经被处理的 AgentRuntimeError，直接重新抛出
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }

      // 使用统一的错误解析器
      const { parseComfyUIErrorMessage } = await import('../../utils/comfyuiErrorParser');
      const { error: parsedError, errorType } = parseComfyUIErrorMessage(error);

      // 只有真正的模型不存在错误才应该在这里抛出 ModelNotFound
      // 其他错误（如连接错误）应该保持原样
      if (errorType === AgentRuntimeErrorType.ModelNotFound) {
        throw AgentRuntimeError.createError(errorType, {
          error: parsedError,
        });
      }

      // 其他错误类型，直接抛出原始错误让上层处理
      throw error;
    }
  }

  /**
   * 规范化模型名称，用于一致的 ID 生成
   * 
   * 现在主要用于向后兼容，严格验证逻辑已迁移到 ModelValidationManager
   */
  normalizeModelName(name: string): string {
    return name
      .toLowerCase()
      .replaceAll(/[\s_]+/g, '-')
      .replaceAll(/[^\da-z-]/g, '')
      .replaceAll(/^-+|-+$/g, '');
  }

  /**
   * Helper function to convert file name to lowercase
   */
  private fileLower = (file: string) => file.toLowerCase();

  /**
   * 解析模型 ID 到实际的模型文件名
   * 
   * 严格版本：完全依赖 ModelValidationManager 进行验证
   * 不存在的模型立即抛出 ModelNotFoundError，无任何回退逻辑
   */
  async resolveModelFileName(modelId: string): Promise<string> {
    try {
      // 使用 ModelValidationManager 进行严格验证
      const validationResult = await this.modelValidator.validateModelExistence(modelId);
      
      // 验证通过，返回实际文件名
      return validationResult.actualFileName!;
    } catch (error) {
      // 如果是 ModelNotFoundError，直接重新抛出
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }
      
      // 其他错误也转换为 ModelNotFound
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
        error: error instanceof Error ? error.message : String(error),
        model: modelId,
      });
    }
  }

  /**
   * 将模型文件名转换为模型列表项（诚实化版本）
   * 
   * 架构诚实化修复：
   * - 只返回4个实际支持的FLUX变体
   * - 移除虚假的174个量化模型变体
   * - 与WorkflowRouter支持的模型保持一致
   */
  transformModelFilesToList(_modelFiles: string[]): Array<{ enabled: boolean; id: string }> {
    // 固定返回4个真实支持的FLUX模型，与WorkflowRouter.EXACT_MODEL_BUILDERS保持一致
    const HONEST_SUPPORTED_MODELS = [
      { enabled: true, id: 'flux-dev' },
      { enabled: true, id: 'flux-schnell' },  
      { enabled: true, id: 'flux-kontext-dev' },
      { enabled: true, id: 'flux-krea-dev' },
    ];
    
    return HONEST_SUPPORTED_MODELS;
  }


}
