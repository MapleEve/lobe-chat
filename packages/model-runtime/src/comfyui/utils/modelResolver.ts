import { ComfyApi } from '@saintno/comfyui-sdk';

import { AgentRuntimeErrorType } from '../../error';
import { AgentRuntimeError } from '../../utils/createError';

/**
 * ComfyUI 模型解析工具类
 * 负责从 ComfyUI 服务器获取和解析模型信息
 */
export class ComfyUIModelResolver {
  private client: ComfyApi;

  constructor(client: ComfyApi) {
    this.client = client;
  }

  /**
   * 获取 ComfyUI 服务器上可用的模型文件列表
   * 使用 ComfyApi 客户端进行请求（支持所有认证模式包括 authType='none'）
   */
  async getAvailableModelFiles(): Promise<string[]> {
    try {
      // 使用 ComfyApi 客户端进行请求，认证由客户端内部处理
      const response = await this.client.fetchApi('/object_info', {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      });

      // 检查响应状态
      if (!response.ok) {
        // 对于非 200 响应，应该抛出错误让上层处理
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
   */
  async resolveModelFileName(modelId: string): Promise<string> {
    const modelFiles = await this.getAvailableModelFiles();

    // Extract model name without comfyui prefix for matching
    const modelName = modelId.replace('comfyui/', '');

    // Try exact match first
    const exactMatch = modelFiles.find((file: string) => {
      const baseName = file.replace(/\.(safetensors|ckpt|pt|gguf)$/i, '');
      return this.normalizeModelName(baseName) === modelName;
    });

    if (exactMatch) return exactMatch;

    // Model-specific matching for FLUX models

    if (modelName === 'flux-dev') {
      // Priority order for flux-dev models
      const devMatches = [
        // Exact matches first
        (f: string) => f === 'flux1-dev.safetensors',
        (f: string) => f === 'flux-dev.safetensors',
        // FP8 versions (preferred for performance)
        (f: string) =>
          this.fileLower(f).includes('flux') &&
          this.fileLower(f).includes('dev') &&
          this.fileLower(f).includes('fp8'),
        // FP16 versions
        (f: string) => this.fileLower(f).includes('flux1-dev'),
        // Any dev version
        (f: string) =>
          this.fileLower(f).includes('flux') &&
          this.fileLower(f).includes('dev') &&
          !this.fileLower(f).includes('schnell'),
      ];

      for (const matcher of devMatches) {
        const match = modelFiles.find(matcher);
        if (match) return match;
      }
    }

    if (modelName === 'flux-schnell') {
      // Priority order for flux-schnell models
      const schnellMatches = [
        // Exact matches first
        (f: string) => f === 'flux1-schnell.safetensors',
        (f: string) => f === 'flux-schnell.safetensors',
        // FP8 versions (preferred for performance)
        (f: string) =>
          this.fileLower(f).includes('flux') &&
          this.fileLower(f).includes('schnell') &&
          this.fileLower(f).includes('fp8'),
        // Any schnell version
        (f: string) => this.fileLower(f).includes('schnell'),
      ];

      for (const matcher of schnellMatches) {
        const match = modelFiles.find(matcher);
        if (match) return match;
      }
    }

    // For other FLUX variants (krea, kontext, etc.)
    if (modelName.startsWith('flux-')) {
      const variant = modelName.replace('flux-', '');
      const variantMatch = modelFiles.find((file: string) => {
        const fl = this.fileLower(file);
        return fl.includes('flux') && fl.includes(variant);
      });
      if (variantMatch) return variantMatch;
    }

    // Generic fuzzy matching for non-FLUX models
    const keywords = modelName.split('-');
    const fuzzyMatch = modelFiles.find((file: string) => {
      const fl = this.fileLower(file);
      return keywords.every((keyword) => fl.includes(keyword));
    });

    if (fuzzyMatch) return fuzzyMatch;

    // Last resort: first available model if any
    if (modelFiles.length > 0) {
      return modelFiles[0];
    }

    // No models available
    throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
      model: modelId,
    });
  }

  /**
   * 将模型文件名转换为模型列表项
   */
  transformModelFilesToList(modelFiles: string[]): Array<{ enabled: boolean; id: string }> {
    return modelFiles.map((fileName: string) => {
      const cleanName = fileName.replace(/\.(safetensors|ckpt|pt)$/i, '');
      const modelId = this.normalizeModelName(cleanName);

      return {
        enabled: true,
        id: modelId, // Without the comfyui/ prefix for config matching
      };
    });
  }
}
