import { AgentRuntimeErrorType } from '../../error';
import { AgentRuntimeError } from '../../utils/createError';

/**
 * ComfyUI 模型解析工具类
 * 负责从 ComfyUI 服务器获取和解析模型信息
 */
export class ComfyUIModelResolver {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  /**
   * 获取 ComfyUI 服务器上可用的模型文件列表
   */
  async getAvailableModelFiles(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/object_info`, {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      });

      const objectInfo = await response.json();
      const checkpointLoader = objectInfo.CheckpointLoaderSimple;

      if (!checkpointLoader?.input?.required?.ckpt_name?.[0]) {
        return [];
      }

      return checkpointLoader.input.required.ckpt_name[0] as string[];
    } catch {
      return [];
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

    if (modelFiles.length === 0) {
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
        model: modelId,
      });
    }

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

    // Last resort: first available model
    return modelFiles[0];
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
