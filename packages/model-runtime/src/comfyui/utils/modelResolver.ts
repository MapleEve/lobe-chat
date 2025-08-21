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
      const objectInfo = await response.json();

      const checkpointLoader = objectInfo.CheckpointLoaderSimple;

      if (!checkpointLoader?.input?.required?.ckpt_name?.[0]) {
        throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
          model: 'No models available on ComfyUI server',
        });
      }

      return checkpointLoader.input.required.ckpt_name[0] as string[];
    } catch (error) {
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
        cause: error,
        model: 'Failed to fetch models from ComfyUI server',
      });
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
   * 解析模型 ID 到实际的模型文件名
   */
  async resolveModelFileName(modelId: string): Promise<string> {
    const modelFiles = await this.getAvailableModelFiles();

    // Extract model name without comfyui prefix for matching
    const modelName = modelId.replace('comfyui/', '');

    // Try exact match first
    const exactMatch = modelFiles.find((file: string) => {
      const baseName = file.replace(/\.(safetensors|ckpt|pt)$/i, '');
      return this.normalizeModelName(baseName) === modelName;
    });

    if (exactMatch) return exactMatch;

    // Try fuzzy matching with keywords
    const keywords = modelName.split('-');
    const fuzzyMatch = modelFiles.find((file: string) => {
      const fileLower = file.toLowerCase();
      return keywords.some((keyword) => fileLower.includes(keyword));
    });

    if (fuzzyMatch) return fuzzyMatch;

    // Fallback to FLUX models if available
    const fluxMatch = modelFiles.find((file: string) => file.toLowerCase().includes('flux'));

    if (fluxMatch) return fluxMatch;

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
