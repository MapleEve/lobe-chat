import debug from 'debug';

import { AgentRuntimeErrorType } from '../../error';
import { AgentRuntimeError } from '../../utils/createError';
import { ModelNameStandardizer, ModelNotFoundError } from './model-name-standardizer';

const logger = debug('lobe-chat:comfyui:model-validation');

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface ModelValidationResult {
  actualFileName?: string;
  exists: boolean;
  isValid?: boolean;
  priority?: number;
  timestamp: number;
  validatedAt?: number;
  variant?: string;
}

interface CacheStats {
  modelListCacheAge: number;
  modelListCached: boolean;
  validationCacheSize: number;
}

/**
 * 模型验证管理器 / Model Validation Manager
 * 
 * @description RFC-128架构：实现简化的模型验证机制，使用1分钟TTL缓存，仅缓存模型列表
 * RFC-128 Architecture: Implements simplified model validation with 1-minute TTL cache, only caches model list
 * 
 * Features / 特性:
 * - 1-minute TTL cache ONLY for model list (no error caching) / 1分钟TTL缓存仅用于模型列表（不缓存错误）
 * - Simple integer priority system: 1=official, 2=enterprise, 3=community / 简单整数优先级：1=官方，2=企业，3=社区
 * - Integration with modelRegistry.ts configuration / 集成modelRegistry.ts配置
 * - Support for 95+ FLUX models across 4 variants / 支持4个变体的95+个FLUX模型
 */
export class ModelValidationManager {
  private static instance: ModelValidationManager | null = null;
  
  // RFC-128: 1分钟TTL缓存仅用于模型列表 / 1-minute TTL cache for model list only
  private modelListCache: CacheEntry<string[]> | null = null;
  
  // RFC-128: 1分钟统一缓存TTL配置 / 1-minute unified cache TTL configuration
  private readonly CACHE_TTL = 60 * 1000; // 1 minute in milliseconds
  
  private getModelListFn: () => Promise<string[]>;

  /**
   * 构造函数 / Constructor
   * 
   * @param getModelListFn - Function to fetch available model files / 获取可用模型文件的函数
   */
  constructor(getModelListFn: () => Promise<string[]> | any) {
    // Handle both ComfyUIModelResolver and direct function
    if (typeof getModelListFn === 'function') {
      this.getModelListFn = getModelListFn;
    } else if (getModelListFn && typeof (getModelListFn as any).getAvailableModelFiles === 'function') {
      this.getModelListFn = () => (getModelListFn as any).getAvailableModelFiles();
    } else {
      throw new Error('Invalid getModelListFn parameter: must be function or object with getAvailableModelFiles method');
    }
    
    logger('ModelValidationManager initialized with RFC-128 1-minute TTL caching system');
  }

  /**
   * 获取单例实例 / Get singleton instance
   */
  static getInstance(getModelListFn?: () => Promise<string[]> | any): ModelValidationManager {
    if (!ModelValidationManager.instance) {
      if (!getModelListFn) {
        throw new Error('getModelListFn is required for first initialization');
      }
      ModelValidationManager.instance = new ModelValidationManager(getModelListFn);
    }
    return ModelValidationManager.instance;
  }

  /**
   * 核心验证方法 - RFC-128架构模型存在性验证 / Core validation method - RFC-128 architecture model existence validation
   * 
   * @param modelId - Model identifier to validate / 要验证的模型标识符
   * @returns Validation result with priority and variant information / 包含优先级和变体信息的验证结果
   */
  async validateModelExistence(modelId: string): Promise<ModelValidationResult> {
    logger(`Starting RFC-128 validation for model: ${modelId}`);
    
    try {
      // Step 1: Validate using ModelNameStandardizer (includes registry check)
      // 步骤1：使用ModelNameStandardizer验证（包含注册表检查）
      const standardizedInfo = ModelNameStandardizer.standardize(modelId);
      const priorityInfo = ModelNameStandardizer.getModelPriority(modelId);
      
      // Step 2: Get server model list with 1-minute cache
      // 步骤2：获取服务器模型列表（1分钟缓存）
      const serverModels = await this.getServerModelList();
      
      // Step 3: Find exact match on server
      // 步骤3：在服务器上查找精确匹配
      const actualFileName = this.findExactMatch(standardizedInfo.standardName, serverModels);
      
      if (!actualFileName) {
        throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
          error: `Model file not found on server: ${modelId} (standardized: ${standardizedInfo.standardName})`,
          model: modelId,
        });
      }

      const now = Date.now();
      const result: ModelValidationResult = {
        actualFileName,
        exists: true,
        isValid: true,
        priority: priorityInfo?.priority,
        timestamp: now,
        validatedAt: now,
        variant: standardizedInfo.variant,
      };
      
      logger(`RFC-128 validation successful for ${modelId}: priority=${result.priority}, variant=${result.variant}`);
      return result;
      
    } catch (error) {
      if (error instanceof ModelNotFoundError) {
        throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
          error: error.message,
          model: modelId,
        });
      }
      
      // Re-throw AgentRuntimeError as-is
      if (error && typeof error === 'object' && 'errorType' in error) {
        throw error;
      }
      
      // Convert other errors to AgentRuntimeError
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger(`RFC-128 validation failed for ${modelId}: ${errorMessage}`);
      
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
        error: errorMessage,
        model: modelId,
      });
    }
  }

  /**
   * RFC-128: 获取服务器模型列表（1分钟TTL缓存）/ Get server model list (1-minute TTL cache)
   */
  private async getServerModelList(): Promise<string[]> {
    // Check 1-minute TTL cache
    // 检查1分钟TTL缓存
    if (this.modelListCache && !this.isCacheExpired(this.modelListCache)) {
      logger('Model list cache hit (RFC-128 1-minute TTL)');
      return this.modelListCache.data;
    }

    logger('Fetching model list from server (RFC-128)');
    try {
      const models = await this.getModelListFn();
      
      // Cache with 1-minute TTL
      // 使用1分钟TTL缓存
      this.modelListCache = {
        data: models,
        timestamp: Date.now(),
        ttl: this.CACHE_TTL
      };
      
      logger(`Cached ${models.length} models from server (RFC-128 1-minute TTL)`);
      return models;
    } catch (error) {
      logger(`Failed to fetch model list (RFC-128): ${error}`);
      throw AgentRuntimeError.createError(AgentRuntimeErrorType.ModelNotFound, {
        error: 'Failed to fetch model list from ComfyUI server',
      });
    }
  }

  /**
   * 精确匹配文件名 / Find exact filename match
   * 
   * @param standardName - Standardized model name / 标准化模型名称
   * @param serverModels - Available models on server / 服务器上可用的模型
   * @returns Matching filename or null / 匹配的文件名或null
   */
  private findExactMatch(standardName: string, serverModels: string[]): string | null {
    // Check each server model to see if any standardize to the target standardName
    // 检查每个服务器模型，看是否有任何模型标准化后匹配目标标准化名称
    for (const serverModel of serverModels) {
      try {
        const serverModelInfo = ModelNameStandardizer.standardize(serverModel);
        if (serverModelInfo.standardName === standardName) {
          return serverModel;
        }
      } catch {
        // Skip models that can't be standardized
        // 跳过无法标准化的模型
        continue;
      }
    }

    // No match found
    // 未找到匹配
    return null;
  }

  /**
   * RFC-128: 检查缓存是否过期 / Check if cache is expired
   */
  private isCacheExpired<T>(cache: CacheEntry<T>): boolean {
    return Date.now() - cache.timestamp > cache.ttl;
  }

  /**
   * RFC-128: 清除所有缓存 / Clear all caches
   */
  clearCache(): void {
    this.modelListCache = null;
    logger('RFC-128 cache cleared');
  }

  /**
   * 兼容性方法 - 别名for clearCache / Compatibility method - alias for clearCache
   */
  clearCaches(): void {
    this.clearCache();
  }

  /**
   * RFC-128: 清理过期缓存 / Clear expired caches
   */
  clearExpiredCaches(): void {
    let cleaned = 0;
    
    // Clear model list cache if expired
    // 清理过期的模型列表缓存
    if (this.modelListCache && this.isCacheExpired(this.modelListCache)) {
      this.modelListCache = null;
      cleaned++;
    }
    
    if (cleaned > 0) {
      logger(`RFC-128: Cleared ${cleaned} expired cache entries`);
    }
  }

  /**
   * RFC-128: 获取缓存统计信息 / Get cache statistics
   */
  getCacheStats(): CacheStats {
    return {
      modelListCacheAge: this.modelListCache ? Date.now() - this.modelListCache.timestamp : 0,
      modelListCached: this.modelListCache !== null && !this.isCacheExpired(this.modelListCache),
      validationCacheSize: 0, // RFC-128: No validation cache
    };
  }

  /**
   * RFC-128: 获取模型优先级信息 / Get model priority information
   * 
   * @param modelId - Model identifier / 模型标识符
   * @returns Priority information or null / 优先级信息或null
   */
  getModelPriority(modelId: string): { category: string, priority: number; subPriority: number; } | null {
    return ModelNameStandardizer.getModelPriority(modelId);
  }

  /**
   * RFC-128: 按优先级获取已验证模型列表 / Get validated models by priority
   * 
   * @param priority - Priority level (1=official, 2=enterprise, 3=community) / 优先级级别
   * @returns Array of model names / 模型名称数组
   */
  getModelsByPriority(priority: number): string[] {
    return ModelNameStandardizer.getModelsByPriority(priority);
  }

  /**
   * RFC-128: 按变体获取已验证模型列表 / Get validated models by variant
   * 
   * @param variant - FLUX variant (dev, schnell, kontext, krea) / FLUX变体
   * @returns Array of model names / 模型名称数组
   */
  getModelsByVariant(variant: string): string[] {
    return ModelNameStandardizer.getModelsByVariant(variant);
  }

  /**
   * RFC-128: 获取所有已验证模型列表 / Get all validated models
   * 
   * @returns Array of all validated model names / 所有已验证模型名称数组
   */
  getAllValidatedModels(): string[] {
    return ModelNameStandardizer.getAllValidModels();
  }

  /**
   * RFC-128: 检查模型是否在验证注册表中 / Check if model is in validation registry
   * 
   * @param modelId - Model identifier / 模型标识符
   * @returns Whether model is validated / 模型是否已验证
   */
  isValidatedModel(modelId: string): boolean {
    return ModelNameStandardizer.isValidModel(modelId);
  }

  /**
   * RFC-128: 定期清理过期缓存 / Periodic cleanup of expired caches
   * 
   * @param intervalMs - Cleanup interval in milliseconds / 清理间隔（毫秒）
   * @returns Timer handle / 定时器句柄
   */
  startPeriodicCleanup(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
    const cleanup = () => {
      this.clearExpiredCaches();
    };

    return setInterval(cleanup, intervalMs);
  }
}