/**
 * FLUX Model Name Standardizer - 精确匹配验证模型
 * Data-Logic Separation: 数据从配置文件导入，逻辑保持独立
 *
 * 严格模式：
 * - 精确匹配所有已知模型
 * - 无法匹配时抛出 ModelNotFound 错误
 * - 无回退逻辑，无默认值返回
 */

import { MODEL_REGISTRY, type ModelConfig, getModelConfig } from '../config/modelRegistry';

export class ModelNotFoundError extends Error {
  constructor(modelName: string) {
    super(`Model not found: ${modelName}. Only verified FLUX models are supported.`);
    this.name = 'ModelNotFoundError';
  }
}

/**
 * Standardized model information interface / 标准化模型信息接口
 */
export interface StandardizedModel {
  /** File size in GB / 文件大小（GB） */
  fileSizeGB: number;
  /** Priority: 1=official, 2=enterprise, 3=community / 优先级：1=官方，2=企业，3=社区 */
  priority: number;
  /** Quantization type / 量化类型 */
  quantization:
    | 'fp16'
    | 'fp32'
    | 'fp8_e4m3fn'
    | 'fp8_e5m2'
    | 'nf4'
    | 'bnb_nf4'
    | 'int4'
    | 'int8'
    | 'gguf'
    | null;
  /** Recommended weight data type / 推荐权重数据类型 */
  recommendedDtype: string;
  /** Source/author / 来源/作者 */
  source: string;
  /** Standardized model name / 标准化的模型名称 */
  standardName: string;
  /** Sub-priority sorting / 子优先级排序 */
  subPriority: number;
  /** Model variant type / 模型变体类型 */
  variant: 'dev' | 'schnell' | 'fill' | 'redux' | 'kontext' | 'krea' | 'lite' | 'mini';
}

/**
 * Model name standardizer class / 模型名称标准化器类 (RFC-128 Enhanced)
 *
 * Features / 功能：
 * - Exactly match 130+ verified FLUX models / 精确匹配130+个已验证的FLUX模型
 * - Intelligent mapping for 200+ models with fuzzy matching / 智能映射支持200+模型的模糊匹配
 * - Pattern recognition for GGUF, FP8, NF4 quantizations / 模式识别支持GGUF、FP8、NF4量化
 * - Alias support for model name variations / 别名支持模型名称变体
 * - Provide standardized model information and recommended configuration / 提供标准化的模型信息和推荐配置
 * - Strict mode: throw ModelNotFound error when unable to match / 严格模式：无法匹配时抛出ModelNotFound错误
 * - Backward compatibility maintained / 保持向后兼容性
 */
export class ModelNameStandardizer {
  /**
   * Adapt ModelConfig from config file to StandardizedModel / 将配置文件的ModelConfig适配为StandardizedModel
   * Handle field differences and default value generation / 处理字段差异和默认值生成
   */
  private static adaptConfigToStandardModel(fileName: string, config: ModelConfig): StandardizedModel {
    // Infer source from priority / 从priority推算source
    const source = this.getSourceFromPriority(config.priority, fileName);
    
    // Generate standardName / 生成standardName
    const standardName = this.generateStandardName(fileName, source);
    
    // Infer quantization from filename and config / 从文件名和配置推算quantization
    const quantization = this.inferQuantization(fileName, config.recommendedDtype);
    
    // Generate default fileSizeGB / 生成默认fileSizeGB
    const fileSizeGB = this.estimateFileSize(fileName, quantization);

    return {
      fileSizeGB,
      priority: config.priority,
      quantization,
      recommendedDtype: this.mapRecommendedDtype(config.recommendedDtype),
      source,
      standardName,
      subPriority: this.calculateSubPriority(config.variant, config.priority),
      variant: config.variant,
    };
  }

  /**
   * 从优先级推算来源
   */
  private static getSourceFromPriority(priority: number, fileName: string): string {
    if (priority === 1) return 'black-forest-labs';
    if (priority === 2) {
      // 企业模型的来源推算
      if (fileName.includes('lite')) return 'Freepik';
      if (fileName.includes('mini')) return 'TencentARC';
      if (fileName.includes('fp8')) return 'Kijai';
      if (fileName.includes('nf4')) return 'lllyasviel';
      if (fileName.includes('.gguf')) return 'city96';
      if (fileName.includes('clip') || fileName.includes('t5xxl') || fileName.includes('ae.')) return 'comfyanonymous';
      return 'enterprise';
    }
    // priority === 3: 社区模型
    if (fileName.includes('Jib')) return 'CivitAI-JibMix';
    if (fileName.includes('RealFlux')) return 'CivitAI-RealFlux';
    if (fileName.includes('UltraReal')) return 'CivitAI-UltraReal';
    if (fileName.includes('vision_realistic')) return 'CivitAI-VisionRealistic';
    if (fileName.includes('lora')) return 'XLabs-AI';
    return 'community';
  }

  /**
   * 生成标准化名称
   */
  private static generateStandardName(fileName: string, source: string): string {
  // 移除扩展名
  const baseName = fileName.replace(/\.(safetensors|gguf)$/i, '');
  
  // 官方模型的标准化名称
  if (source === 'black-forest-labs') {
    if (baseName.includes('flux1-dev')) return 'FLUX.1-dev';
    if (baseName.includes('flux1-schnell')) return 'FLUX.1-schnell';
    if (baseName.includes('flux1-kontext')) return 'FLUX.1-Kontext-dev';
    if (baseName.includes('flux1-krea')) return 'FLUX.1-Krea-dev';
    if (baseName.includes('flux1-fill')) return 'FLUX.1-Fill-dev';
    if (baseName.includes('flux1-redux')) return 'FLUX.1-Redux-dev';
    if (baseName === 'ae') return 'FLUX VAE AutoEncoder';
  }
  
  // 特殊企业模型
  if (source === 'Freepik' && baseName.includes('lite')) return 'Freepik FLUX.1-lite-8B';
  if (source === 'TencentARC' && baseName.includes('mini')) return 'TencentARC flux-mini';
  if (source === 'comfyanonymous') {
    if (baseName === 'clip_l') return 'CLIP-L Text Encoder';
    if (baseName.includes('t5xxl_fp16')) return 'T5-XXL Text Encoder FP16';
  }
  
  // GGUF模型的标准化
  if (baseName.includes('Q4_K_S') && baseName.includes('flux1-dev')) {
    return 'FLUX.1-dev-Q4_K_S';
  }
  
  // 社区模型特殊名称
  if (source === 'CivitAI-JibMix' && baseName.includes('Jib_mix_Flux_V11_Krea_b_00001_')) {
    return 'Jib Mix Flux V11 Krea NSFW';
  }
  if (source === 'XLabs-AI') {
    if (baseName.includes('realism_lora')) return 'XLabs Realism LoRA';
    if (baseName.includes('anime_lora')) return 'XLabs Anime LoRA';
  }
  
  // 其他模型使用美化后的文件名
  return baseName.replaceAll(/[_-]/g, ' ').replaceAll(/\b\w/g, (l: string) => l.toUpperCase());
}

  /**
   * 推断量化类型
   */
  private static inferQuantization(fileName: string, recommendedDtype: string): StandardizedModel['quantization'] {
  if (fileName.includes('.gguf')) return 'gguf';
  if (fileName.includes('fp8') || recommendedDtype === 'fp8') return 'fp8_e4m3fn';
  if (fileName.includes('bnb-nf4') || fileName.includes('bnb_nf4')) return 'bnb_nf4';
  if (fileName.includes('nf4') || recommendedDtype === 'nf4') return 'nf4';
  if (fileName.includes('bnb')) return 'bnb_nf4';
  if (fileName.includes('fp16')) return 'fp16';
  if (fileName.includes('fp32')) return 'fp32';
  if (fileName.includes('int4')) return 'int4';
  if (fileName.includes('int8')) return 'int8';
  return null;
}

  /**
   * 估算文件大小
   */
  private static estimateFileSize(fileName: string, quantization: StandardizedModel['quantization']): number {
    // GGUF模型大小估算
    if (quantization === 'gguf') {
      if (fileName.includes('Q2')) return 4.03;
      if (fileName.includes('Q3')) return 5.23;
      if (fileName.includes('Q4')) return 6.81;
      if (fileName.includes('Q5')) return 8.29;
      if (fileName.includes('Q6')) return 9.86;
      if (fileName.includes('Q8')) return 12.7;
      return 9.86; // 默认Q6大小
    }
    
    // FP8模型
    if (quantization === 'fp8_e4m3fn' || quantization === 'fp8_e5m2') return 11.9;
    
    // NF4模型
    if (quantization === 'nf4' || quantization === 'bnb_nf4') return 6;
    
    // INT量化模型
    if (quantization === 'int4') return 6;
    if (quantization === 'int8') return 12;
    
    // 特殊模型大小
    if (fileName.includes('ae.')) return 0.335;
    if (fileName.includes('clip_l')) return 0.246;
    if (fileName.includes('t5xxl_fp16')) return 9.79;
    if (fileName.includes('t5xxl_fp8')) return 4.89;
    if (fileName.includes('lora')) return 0.05;
    if (fileName.includes('mini')) return 6.36;
    if (fileName.includes('lite')) return 16.3;
    if (fileName.includes('redux')) return 0.129;
    
    // 默认全精度模型大小
    return 23.8;
  }

  /**
   * 映射推荐数据类型
   */
  private static mapRecommendedDtype(dtype: string): string {
    switch (dtype) {
      case 'fp8': { return 'fp8_e4m3fn';
      }
      case 'gguf': { return 'default';
      }
      case 'nf4': { return 'nf4';
      }
      default: { return dtype;
      }
    }
  }

  /**
   * 计算子优先级
   */
  private static calculateSubPriority(variant: string, priority: number): number {
    if (priority === 1) {
      // 官方模型的子优先级
      switch (variant) {
        case 'dev': { return 1;
        }
        case 'schnell': { return 2;
        }
        case 'kontext': { return 3;
        }
        case 'krea': { return 4;
        }
        case 'fill': { return 5;
        }
        case 'redux': { return 6;
        }
        default: { return 7;
        }
      }
    }
    return 1; // 企业和社区模型默认子优先级
  }
  /**
   * 标准化模型名称并获取模型信息 (Enhanced RFC-128)
   * RFC-128增强版：支持智能模型映射和200+模型识别
   *
   * @param modelName 输入的模型文件名
   * @param enableIntelligentMapping 是否启用智能映射 (默认false保持向后兼容)
   * @returns 标准化的模型信息
   * @throws {ModelNotFoundError} 当模型不在验证列表中且无法智能映射时
   */
  public static standardize(modelName: string, enableIntelligentMapping: boolean = false): StandardizedModel {
    // 移除路径，只保留文件名
    const fileName = modelName.split('/').pop() || modelName;

    // 1. 从配置文件获取模型配置 (精确匹配)
    const modelConfig = getModelConfig(fileName);
    if (modelConfig) {
      return ModelNameStandardizer.adaptConfigToStandardModel(fileName, modelConfig);
    }

    // 2. 尝试不区分大小写的匹配
    const lowerFileName = fileName.toLowerCase();
    for (const [configModelName] of Object.entries(MODEL_REGISTRY)) {
      if (configModelName.toLowerCase() === lowerFileName) {
        const config = getModelConfig(configModelName);
        if (config) {
          return ModelNameStandardizer.adaptConfigToStandardModel(configModelName, config);
        }
      }
    }

    // 3. RFC-128: 智能映射 (可选)
    if (enableIntelligentMapping) {
      const intelligentResult = ModelNameStandardizer.performIntelligentMapping(fileName);
      if (intelligentResult) {
        return intelligentResult;
      }
    }

    // 4. 严格模式：无法匹配时抛出错误
    throw new ModelNotFoundError(fileName);
  }

  /**
   * RFC-128: 执行智能模型映射 / Perform intelligent model mapping
   * 
   * @param fileName - 文件名 / File name
   * @returns 标准化的模型信息或null / Standardized model info or null
   */
  private static performIntelligentMapping(fileName: string): StandardizedModel | null {
    // 获取所有已注册的模型键 / Get all registered model keys
    const registryKeys = Object.keys(MODEL_REGISTRY);
    
    // 1. 检查已知别名 / Check known aliases
    const aliasMatch = this.findModelAlias(fileName);
    if (aliasMatch) {
      const config = getModelConfig(aliasMatch);
      if (config) {
        return this.adaptConfigToStandardModel(aliasMatch, config);
      }
    }

    // 2. 模糊匹配现有模型 / Fuzzy match existing models
    const fuzzyMatch = this.findFuzzyMatch(fileName, registryKeys, 0.8);
    if (fuzzyMatch) {
      const config = getModelConfig(fuzzyMatch);
      if (config) {
        return this.adaptConfigToStandardModel(fuzzyMatch, config);
      }
    }

    // 3. 模式识别新模型 / Pattern recognition for new models
    const patternMatch = this.recognizeModelPattern(fileName);
    if (patternMatch) {
      return this.adaptConfigToStandardModel(fileName, patternMatch);
    }

    return null;
  }

  /**
   * RFC-128: 查找模型别名 / Find model alias
   */
  private static findModelAlias(fileName: string): string | null {
    const aliases = new Map<string, string[]>([
      // Official model variations
      ['flux1-dev.safetensors', [
        'flux-dev.safetensors', 
        'FLUX.1-dev.safetensors',
        'flux_1_dev.safetensors',
        'flux1_dev.safetensors'
      ]],
      ['flux1-schnell.safetensors', [
        'flux-schnell.safetensors',
        'FLUX.1-schnell.safetensors', 
        'flux_1_schnell.safetensors',
        'flux1_schnell.safetensors'
      ]],
      ['flux1-kontext-dev.safetensors', [
        'flux-kontext-dev.safetensors',
        'FLUX.1-Kontext-dev.safetensors',
        'flux1_kontext_dev.safetensors'
      ]],
      ['flux1-krea-dev.safetensors', [
        'flux-krea-dev.safetensors',
        'FLUX.1-Krea-dev.safetensors',
        'flux1_krea_dev.safetensors'
      ]]
    ]);

    for (const [canonical, aliasList] of aliases) {
      if (aliasList.includes(fileName.toLowerCase())) {
        return canonical;
      }
    }
    return null;
  }

  /**
   * RFC-128: 模糊匹配 / Fuzzy matching
   */
  private static findFuzzyMatch(targetName: string, candidates: string[], threshold: number = 0.8): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const similarity = this.calculateSimilarity(targetName, candidate);
      if (similarity >= threshold && similarity > bestScore) {
        bestMatch = candidate;
        bestScore = similarity;
      }
    }

    return bestMatch;
  }

  /**
   * RFC-128: 计算字符串相似度 / Calculate string similarity
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  /**
   * RFC-128: 计算编辑距离 / Calculate Levenshtein distance
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array.from({length: str2.length + 1}).fill(null).map(() => Array.from({length: str1.length + 1}).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * RFC-128: 模式识别 / Pattern recognition
   */
  private static recognizeModelPattern(fileName: string): ModelConfig | null {
    const name = fileName.toLowerCase();

    // Official models
    if (/^(flux1?[_-]dev|flux\.1[_-]dev)\.safetensors$/i.test(fileName)) {
      return { priority: 1, recommendedDtype: 'default', variant: 'dev' };
    }
    if (/^(flux1?[_-]schnell|flux\.1[_-]schnell)\.safetensors$/i.test(fileName)) {
      return { priority: 1, recommendedDtype: 'fp8_e4m3fn', variant: 'schnell' };
    }
    if (/^(flux1?[_-]kontext[_-]dev|flux\.1[_-]kontext[_-]dev)\.safetensors$/i.test(fileName)) {
      return { priority: 1, recommendedDtype: 'default', variant: 'kontext' };
    }
    if (/^(flux1?[_-]krea[_-]dev|flux\.1[_-]krea[_-]dev)\.safetensors$/i.test(fileName)) {
      return { priority: 1, recommendedDtype: 'default', variant: 'krea' };
    }

    // GGUF quantized models
    if (/^flux1?[_-](dev|schnell|kontext|krea)[_-].*q([2-68])(_k|_k_s|_k_m|_0|_1|)\.gguf$/i.test(fileName)) {
      return { priority: 2, recommendedDtype: 'gguf', variant: this.extractVariantFromName(fileName) };
    }

    // FP8 quantized models
    if (/^flux1?[_-](dev|schnell|kontext|krea)[_-].*fp8[_-](e4m3fn|e5m2)\.safetensors$/i.test(fileName)) {
      return { priority: 2, recommendedDtype: 'fp8', variant: this.extractVariantFromName(fileName) };
    }

    // NF4 quantized models
    if (/^flux1?[_-](dev|schnell|kontext|krea)[_-].*(bnb[_-])?nf4([_-]v2)?\.safetensors$/i.test(fileName)) {
      return { priority: 2, recommendedDtype: 'nf4', variant: this.extractVariantFromName(fileName) };
    }

    // Enterprise optimized models
    if (/^(flux\.1[_-]lite[_-]8b|flux[_-]mini).*\.safetensors$/i.test(fileName)) {
      return { priority: 2, recommendedDtype: 'default', variant: 'lite' };
    }

    // Community models
    if (/^(real_?dream|vision_?realistic|pixel_?wave|ultra_?real|acorn_?spinning).*flux.*\.safetensors$/i.test(fileName)) {
      return { priority: 3, recommendedDtype: 'default', variant: 'dev' };
    }

    // LoRA adapters
    if (/^(realism|anime|disney|scenery|art|mjv6)_lora\.safetensors$/i.test(fileName)) {
      return { priority: 3, recommendedDtype: 'default', variant: 'dev' };
    }

    // Generic FLUX model fallback - extract variant from name
    if (/flux.*\.safetensors$/i.test(fileName)) {
      return { 
        priority: 3, 
        recommendedDtype: 'default', 
        variant: this.extractVariantFromName(fileName)
      };
    }

    return null;
  }

  /**
   * RFC-128: 从文件名提取变体 / Extract variant from filename
   */
  private static extractVariantFromName(fileName: string): ModelConfig['variant'] {
    const name = fileName.toLowerCase();
    
    if (name.includes('schnell')) return 'schnell';
    if (name.includes('kontext')) return 'kontext'; 
    if (name.includes('krea')) return 'krea';
    if (name.includes('fill')) return 'fill';
    if (name.includes('redux')) return 'redux';
    if (name.includes('mini')) return 'mini';
    if (name.includes('lite')) return 'lite';
    
    return 'dev'; // Default variant
  }

  /**
   * RFC-128: 智能标准化模型名称 (启用智能映射) / Intelligent standardize model name (with intelligent mapping enabled)
   * 
   * @param modelName 输入的模型文件名 / Input model filename
   * @returns 标准化的模型信息 / Standardized model information
   * @throws {ModelNotFoundError} 当模型无法识别时 / When model cannot be recognized
   */
  public static standardizeWithIntelligentMapping(modelName: string): StandardizedModel {
    return this.standardize(modelName, true);
  }

  /**
   * 检查模型是否在验证列表中 (Enhanced RFC-128)
   *
   * @param modelName 模型文件名
   * @param enableIntelligentMapping 是否启用智能映射 (默认false保持向后兼容)
   * @returns 是否为已验证的模型
   */
  public static isValidModel(modelName: string, enableIntelligentMapping: boolean = false): boolean {
    try {
      this.standardize(modelName, enableIntelligentMapping);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * RFC-128: 检查模型是否为已验证模型 (启用智能映射) / Check if model is valid (with intelligent mapping enabled)
   * 
   * @param modelName 模型文件名 / Model filename
   * @returns 是否为已验证的模型 / Whether model is validated
   */
  public static isValidModelWithIntelligentMapping(modelName: string): boolean {
    return this.isValidModel(modelName, true);
  }

  /**
   * 获取推荐的权重数据类型
   *
   * @param modelName 模型文件名
   * @returns 推荐的权重数据类型
   * @throws {ModelNotFoundError} 当模型不在验证列表中时
   */
  public static getRecommendedDtype(modelName: string): string {
    const modelInfo = this.standardize(modelName);
    return modelInfo.recommendedDtype;
  }

  /**
   * 获取所有已验证的模型列表
   *
   * @returns 已验证模型的文件名数组
   */
  public static getAllValidModels(): string[] {
  return Object.keys(MODEL_REGISTRY);
}

  /**
   * 按来源分组获取模型
   *
   * @param source 来源名称
   * @returns 指定来源的模型列表
   */
  public static getModelsBySource(source: string): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([fileName, config]) => {
      const inferredSource = ModelNameStandardizer.getSourceFromPriority(config.priority, fileName);
      return inferredSource === source;
    })
    .map(([fileName]) => fileName);
}

  /**
   * 按变体类型获取模型
   *
   * @param variant 变体类型
   * @returns 指定变体的模型列表
   */
  public static getModelsByVariant(variant: string): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, config]) => config.variant === variant)
    .map(([fileName]) => fileName);
}

  /**
   * 按优先级获取模型列表
   *
   * @param priority 优先级 (1=官方, 2=企业, 3=社区)
   * @returns 指定优先级的模型列表
   */
  public static getModelsByPriority(priority: number): string[] {
    return Object.entries(MODEL_REGISTRY)
      .filter(([, config]) => config.priority === priority)
      .map(([fileName]) => fileName);
  }

  /**
   * 获取模型的优先级信息
   *
   * @param modelName 模型文件名
   * @returns 模型优先级信息或null
   */
  public static getModelPriority(modelName: string): {
    category: string;
    priority: number;
    subPriority: number;
  } | null {
    try {
      const standardizedModel = this.standardize(modelName);
      const priority = standardizedModel.priority;
      const subPriority = standardizedModel.subPriority;
      
      let category = '';
      switch (priority) {
        case 1: { category = '官方模型 (Black Forest Labs)'; break;
        }
        case 2: { category = '企业优化模型'; break;
        }
        case 3: { category = '社区精调模型'; break;
        }
        default: { category = '未知类别';
        }
      }

      return {
        category,
        priority,
        subPriority
      };
    } catch {
      return null;
    }
  }
}
