/**
 * Simple Model Resolver
 *
 * Replaces 700+ lines of over-engineered validation, caching, and detection
 * with simple O(1) model registry lookups and basic server validation.
 */
import { ComfyApi } from '@saintno/comfyui-sdk';

import { AgentRuntimeErrorType } from '../../error';
import { AgentRuntimeError } from '../../utils/createError';
import { type ModelConfig, getAllModelNames, getModelConfig } from '../config/modelRegistry';

/**
 * Simple model resolver - O(1) lookup via getModelConfig interface
 * @param modelName - The model filename (with or without path)
 * @returns Model configuration or null if not found
 */
export function resolveModel(modelName: string): ModelConfig | null {
  // Remove path, keep only filename
  const fileName = modelName.split('/').pop() || modelName;

  // Direct O(1) lookup
  let config = getModelConfig(fileName);

  // If not found, try case-insensitive lookup through the interface
  if (!config) {
    config = getModelConfig(fileName, { caseInsensitive: true });
  }

  return config || null;
}

/**
 * Resolve model with error throwing for strict validation
 * @param modelName - The model filename
 * @returns Model configuration
 * @throws {AgentRuntimeError} when model is not found
 */
export function resolveModelStrict(modelName: string): ModelConfig {
  const config = resolveModel(modelName);
  if (!config) {
    throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
      message: `Model not found: ${modelName}. Only verified FLUX models are supported.`,
      modelName,
    });
  }
  return config;
}

/**
 * Check if model exists in registry
 * @param modelName - The model filename
 * @returns Whether model is supported
 */
export function isValidModel(modelName: string): boolean {
  return resolveModel(modelName) !== null;
}

/**
 * Get all supported model names
 * @returns Array of all model filenames in registry
 */
export function getAllModels(): string[] {
  return getAllModelNames();
}

/**
 * Simple ComfyUI model resolver
 */
export class ModelResolver {
  private readonly client: ComfyApi;
  private modelCache: string[] | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 60_000; // 1 minute

  constructor(client: ComfyApi) {
    this.client = client;
  }

  /**
   * Get models from server with simple caching
   */
  async getAvailableModelFiles(): Promise<string[]> {
    if (this.modelCache && Date.now() < this.cacheExpiry) {
      return this.modelCache;
    }

    try {
      const response = await this.client.fetchApi('/object_info');
      if (!response.ok) {
        // Use framework error handling directly
        throw AgentRuntimeError.createError(AgentRuntimeErrorType.ComfyUIServiceUnavailable, {
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
      }

      const objectInfo = await response.json();
      const checkpointLoader = objectInfo.CheckpointLoaderSimple;

      if (!checkpointLoader?.input?.required?.ckpt_name?.[0]) {
        throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
          model: 'No models available on ComfyUI server',
        });
      }

      this.modelCache = checkpointLoader.input.required.ckpt_name[0] as string[];
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      return this.modelCache;
    } catch (error) {
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }

      const { parseComfyUIErrorMessage } = await import('../../utils/comfyuiErrorParser');
      const { error: parsedError, errorType } = parseComfyUIErrorMessage(error);

      throw AgentRuntimeError.createError(errorType, {
        error: parsedError,
      });
    }
  }

  /**
   * Resolve model ID to filename
   */
  async resolveModelFileName(modelId: string): Promise<string> {
    // Validate against registry first
    resolveModelStrict(modelId);

    // Check if exists on server
    const serverModels = await this.getAvailableModelFiles();
    const fileName = modelId.split('/').pop() || modelId;

    if (!serverModels.includes(fileName)) {
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
        error: `Model file not found on server: ${fileName}`,
        model: modelId,
      });
    }

    return fileName;
  }

  /**
   * Transform model files to list using model registry
   */
  transformModelFilesToList(modelFiles: string[]): Array<{ enabled: boolean; id: string }> {
    const supportedModels: Array<{ enabled: boolean; id: string }> = [];

    // Check each server model file against registry
    for (const fileName of modelFiles) {
      const config = resolveModel(fileName);
      if (config && config.modelFamily === 'FLUX') {
        // Use filename without extension as model ID
        const modelId = fileName.replace(/\.(safetensors|gguf|ckpt|pt)$/, '');
        supportedModels.push({ enabled: true, id: modelId });
      }
    }

    return supportedModels;
  }

  /**
   * Simple model validation
   */
  async validateModel(modelId: string): Promise<{ actualFileName?: string; exists: boolean }> {
    try {
      const fileName = await this.resolveModelFileName(modelId);
      return { actualFileName: fileName, exists: true };
    } catch {
      return { exists: false };
    }
  }
}
