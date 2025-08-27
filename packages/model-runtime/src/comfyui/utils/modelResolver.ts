/**
 * Simple Model Resolver
 *
 * Replaces 700+ lines of over-engineered validation, caching, and detection
 * with simple O(1) model registry lookups and basic server validation.
 */
import { ComfyApi } from '@saintno/comfyui-sdk';
import debug from 'debug';

import {
  type ModelConfig,
  getAllModelNames,
  getModelConfig,
  getModelsByVariant,
} from '../config/modelRegistry';

const log = debug('lobe-image:comfyui');

/**
 * Internal error class for model resolver / 模型解析器内部错误类
 *
 * This error is thrown by model resolver when it cannot find models
 * or encounters issues with the ComfyUI server.
 * It will be caught and converted to framework errors at the main entry level.
 */
export class ModelResolverError extends Error {
  public readonly reason: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, reason: string, details?: Record<string, any>) {
    super(message);
    this.name = 'ModelResolverError';
    this.reason = reason;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ModelResolverError);
    }
  }

  static readonly Reasons = {
    CONNECTION_ERROR: 'CONNECTION_ERROR',
    INVALID_API_KEY: 'INVALID_API_KEY',
    MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  } as const;
}

/**
 * Simple model resolver - O(1) lookup via getModelConfig interface
 * @param modelName - The model filename (with or without path)
 * @returns Model configuration or null if not found
 */
export function resolveModel(modelName: string): ModelConfig | null {
  // Remove path, keep only filename
  const fileName = modelName.split('/').pop() || modelName;

  log('🔍 [ModelResolver] resolveModel called with:', { fileName, modelName });

  // Direct O(1) lookup
  let config = getModelConfig(fileName);

  log('🔍 [ModelResolver] Direct lookup result:', {
    config: config ? { priority: config.priority, variant: config.variant } : null,
    fileName,
    found: !!config,
  });

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
    throw new ModelResolverError(
      `Model not found: ${modelName}`,
      ModelResolverError.Reasons.MODEL_NOT_FOUND,
      { modelName },
    );
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
    log('🎯 ModelResolver.getAvailableModelFiles() CALLED');
    if (this.modelCache && Date.now() < this.cacheExpiry) {
      log('📦 ModelResolver: Returning cached models');
      return this.modelCache;
    }

    log('🔄 ModelResolver: Cache miss, fetching from server');
    try {
      log('🔧 ModelResolver: About to call /object_info');
      const response = await this.client.fetchApi('/object_info');
      log('📡 ModelResolver: Response status:', response.status, response.statusText);

      if (!response.ok) {
        // Properly classify HTTP errors based on status code
        if (response.status === 401) {
          log('✅ ModelResolver: 401 detected, throwing InvalidProviderAPIKey');
          throw new ModelResolverError(
            `HTTP ${response.status}: ${response.statusText}`,
            ModelResolverError.Reasons.INVALID_API_KEY,
            { status: response.status, statusText: response.statusText },
          );
        } else if (response.status === 403) {
          log('✅ ModelResolver: 403 detected, throwing PermissionDenied');
          throw new ModelResolverError(
            `HTTP ${response.status}: ${response.statusText}`,
            ModelResolverError.Reasons.PERMISSION_DENIED,
            { status: response.status, statusText: response.statusText },
          );
        } else {
          log('✅ ModelResolver: Other HTTP error, throwing ComfyUIServiceUnavailable');
          // Other HTTP errors (404, 5xx) are service unavailability issues
          throw new ModelResolverError(
            `HTTP ${response.status}: ${response.statusText}`,
            ModelResolverError.Reasons.SERVICE_UNAVAILABLE,
            { status: response.status, statusText: response.statusText },
          );
        }
      }

      const objectInfo = await response.json();
      const checkpointLoader = objectInfo.CheckpointLoaderSimple;

      if (!checkpointLoader?.input?.required?.ckpt_name?.[0]) {
        throw new ModelResolverError(
          'No models available on ComfyUI server',
          ModelResolverError.Reasons.MODEL_NOT_FOUND,
          { server: true },
        );
      }

      this.modelCache = checkpointLoader.input.required.ckpt_name[0] as string[];
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      return this.modelCache;
    } catch (error: unknown) {
      log('🔥 ModelResolver fetchApi caught error:', {
        error,
        errorCause: (error as any)?.cause,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorResponse: (error as any)?.response,
        errorStatus: (error as any)?.status,
        errorType: typeof error,
      });

      // Check if SDK threw a Response object as the error
      if (error instanceof Response) {
        log('📦 Error is a Response object, status:', error.status);
        if (error.status === 401) {
          log('✅ ModelResolver: 401 from Response object, throwing InvalidProviderAPIKey');
          throw new ModelResolverError(
            `HTTP 401: Unauthorized`,
            ModelResolverError.Reasons.INVALID_API_KEY,
            { status: 401 },
          );
        } else if (error.status === 403) {
          log('✅ ModelResolver: 403 from Response object, throwing PermissionDenied');
          throw new ModelResolverError(
            `HTTP 403: Forbidden`,
            ModelResolverError.Reasons.PERMISSION_DENIED,
            { status: 403 },
          );
        }
      }

      // Check if error has a cause that's a Response object or Response-like object
      const errorCause = (error as any)?.cause;
      if (errorCause && typeof errorCause === 'object' && 'status' in errorCause) {
        const cause = errorCause;
        log('📦 Error cause is a Response-like object, status:', cause.status);
        if (cause.status === 401) {
          log('✅ ModelResolver: 401 from error.cause, throwing InvalidProviderAPIKey');
          throw new ModelResolverError(
            (error as Error).message || `HTTP 401: Unauthorized`,
            ModelResolverError.Reasons.INVALID_API_KEY,
            { originalError: (error as Error).message, status: 401 },
          );
        } else if (cause.status === 403) {
          log('✅ ModelResolver: 403 from error.cause, throwing PermissionDenied');
          throw new ModelResolverError(
            (error as Error).message || `HTTP 403: Forbidden`,
            ModelResolverError.Reasons.PERMISSION_DENIED,
            { originalError: (error as Error).message, status: 403 },
          );
        }
      }

      // If it's already a ModelResolverError, re-throw it
      if (error instanceof ModelResolverError) {
        throw error;
      }

      // If it's already a properly typed error, re-throw it
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }

      // For other unknown errors, throw a generic connection error
      throw new ModelResolverError(
        error instanceof Error ? error.message : 'Unknown error',
        ModelResolverError.Reasons.CONNECTION_ERROR,
        { originalError: error },
      );
    }
  }

  /**
   * Resolve model ID to filename - supports both variant names and direct filenames
   * Prioritizes variant-based selection over direct filename matching
   */
  async resolveModelFileName(modelId: string): Promise<string> {
    log('🔍 [ModelResolver] resolveModelFileName called with:', modelId);

    // Get server models first
    const serverModels = await this.getAvailableModelFiles();
    log('🔍 [ModelResolver] Available server models:', serverModels.length, 'models');

    // Clean up modelId (remove path if any)
    const cleanModelId = modelId.split('/').pop() || modelId;

    // Map model IDs to variants (e.g., 'flux-dev' -> 'dev')
    const modelIdToVariant: Record<string, string> = {
      'flux-dev': 'dev',
      'flux-fill-dev': 'fill',
      'flux-kontext-dev': 'kontext',
      'flux-krea-dev': 'krea',
      'flux-redux-dev': 'redux',
      'flux-schnell': 'schnell',
      'stable-diffusion-3.5': 'sd35',
      'stable-diffusion-3.5-inclclip': 'custom-sd',
      // SD1.5 model ID mappings
      'stable-diffusion-1.5': 'sd15',
      'stable-diffusion-xl': 'sdxl',
    };

    // Determine if we have a variant (either direct variant name or model ID)
    const variantName =
      modelIdToVariant[cleanModelId] ||
      (['dev', 'schnell', 'kontext', 'krea', 'fill', 'redux', 'sd35', 'custom-sd', 'sd15', 'sdxl',
        'sd15-t2i', 'sdxl-t2i', 'sdxl-i2i', 'custom-sd-t2i', 'custom-sd-i2i'].includes(
        cleanModelId,
      )
        ? cleanModelId
        : null);

    // First priority: Check if it's a variant name (e.g., 'dev', 'schnell')
    const isVariantName = variantName !== null;

    if (isVariantName) {
      log('🔍 [ModelResolver] Input recognized as variant name:', variantName);

      // Get all models for this variant, sorted by priority
      const variantModels = getModelsByVariant(variantName as ModelConfig['variant']);
      log('🔍 [ModelResolver] Found variant models:', {
        models: variantModels.slice(0, 5),
        totalModels: variantModels.length,
        variant: variantName, // Log first 5 for debugging
      });

      // Find the best match that exists on server
      for (const candidateModel of variantModels) {
        if (serverModels.includes(candidateModel)) {
          log('✅ [ModelResolver] Best matching file found via variant selection:', candidateModel);
          return candidateModel;
        }
      }

      // No variant models found on server
      log('❌ [ModelResolver] No variant models found on server for variant:', variantName);
      // Don't include detailed message - let frontend handle i18n
      throw new ModelResolverError(
        `Model not found for variant: ${variantName}`,
        ModelResolverError.Reasons.MODEL_NOT_FOUND,
        { variant: variantName },
      );
    }

    // Second priority: Check if it's a direct filename on server (for backward compatibility)
    if (serverModels.includes(cleanModelId)) {
      log('✅ [ModelResolver] Direct filename found on server:', cleanModelId);
      // Still validate it's a supported model (but don't fail if not)
      const config = getModelConfig(cleanModelId);
      if (!config) {
        log(
          '⚠️ [ModelResolver] Direct filename found but not in registry, allowing for backward compatibility',
        );
      }
      return cleanModelId;
    }

    // Third priority: Try to resolve as a model file that might have variant info
    const config = getModelConfig(cleanModelId);
    log('🔍 [ModelResolver] getModelConfig result for direct lookup:', {
      cleanModelId,
      found: !!config,
      variant: config?.variant,
    });

    if (config && config.variant) {
      log(
        '🔍 [ModelResolver] Found model config with variant, looking for files on server for variant:',
        config.variant,
      );

      // Find all files on server that match this variant
      const matchingFiles = serverModels.filter((serverFile) => {
        const serverConfig = getModelConfig(serverFile);
        return serverConfig && serverConfig.variant === config.variant;
      });

      log('🔍 [ModelResolver] Matching files for variant:', {
        matchingFiles,
        variant: config.variant,
      });

      if (matchingFiles.length > 0) {
        // Sort by priority (lower number = higher priority)
        const sortedFiles = matchingFiles.sort((a, b) => {
          const configA = getModelConfig(a);
          const configB = getModelConfig(b);
          return (configA?.priority || 999) - (configB?.priority || 999);
        });

        const bestMatch = sortedFiles[0];
        log(
          '✅ [ModelResolver] Best matching file found via model config variant lookup:',
          bestMatch,
        );
        return bestMatch;
      }
    }

    // No match found - throw error
    throw new ModelResolverError(
      `Model not found: ${modelId}`,
      ModelResolverError.Reasons.MODEL_NOT_FOUND,
      { modelId },
    );
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
    } catch (error) {
      // Re-throw ModelResolverError (connection errors, auth errors, etc.)
      if (error instanceof ModelResolverError) {
        throw error;
      }
      // Re-throw other properly typed errors
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }
      // Only return exists: false for actual "model not found" errors
      return { exists: false };
    }
  }
}
