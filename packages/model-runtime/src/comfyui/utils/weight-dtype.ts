import { ModelNameStandardizer } from './model-name-standardizer';

/**
 * FLUX 模型权重类型参数接口 / FLUX Model Weight Dtype Parameters Interface
 * 
 * @description 权重类型选择的参数接口
 * Parameter interface for weight type selection
 */
export interface WeightDtypeParams {
  /** 用户显式指定的权重类型 / User explicitly specified weight type */
  weightDtype?: string;
}

/**
 * Weight type mapping table - mapping based on quantization type detection / 权重类型映射表 - 基于量化类型检测的映射
 */
const QUANTIZATION_TO_WEIGHT_DTYPE: Record<string, string> = {
  
  
'bnb_nf4': 'nf4', 
  

// Precision types / 精度类型
'fp16': 'fp16',
  


'fp32': 'fp32',
  
  
  
// FP8 quantization types / FP8 量化类型
'fp8': 'fp8_e4m3fn',
  // Generic fp8 defaults to e4m3fn (speed optimization) / 通用fp8默认使用e4m3fn（速度优化）
'fp8_e4m3fn': 'fp8_e4m3fn',
  
  
  'fp8_e5m2': 'fp8_e5m2',
  
// GGUF format - ComfyUI compatibility, unified use of default / GGUF 格式 - ComfyUI 兼容性，统一使用 default
'gguf_q2_k': 'default',
  

'gguf_q3_k_s': 'default',
  

'gguf_q4_k_s': 'default',
  
  
  
'gguf_q5_k_s': 'default',
  
'gguf_q6_k': 'default',
  
'gguf_q8_0': 'default',
  // 量化类型
'int4': 'int4',
  'int8': 'int8',
  'nf4': 'nf4',
};

/**
 * 企业蒸馏模型的特殊优化策略
 */
const ENTERPRISE_MODEL_OPTIMIZATION: Record<string, string> = {
  'flux-lite-8b': 'fp8_e4m3fn', // Freepik lite-8B: 16.3GB -> fp8优化
  'flux-mini': 'fp8_e4m3fn', // TencentARC mini: 6.36GB -> fp8适合
};

/**
 * 直接模式匹配检测 - 优先处理明确的量化标识符
 * 确保向后兼容性和精确匹配
 * 
 * @param modelName 模型文件名
 * @returns 检测到的权重类型或null
 */
function detectDirectPatterns(modelName: string): string | null {
  const modelLower = modelName.toLowerCase();

  // 特定精度检测（最具体的优先）
  if (modelLower.includes('fp8_e5m2') || modelLower.includes('fp8-e5m2')) return 'fp8_e5m2';
  if (modelLower.includes('fp8_e4m3fn') || modelLower.includes('fp8-e4m3fn')) return 'fp8_e4m3fn';
  if (modelLower.includes('fp32')) return 'fp32';
  if (modelLower.includes('fp16')) return 'fp16';

  // 量化检测
  if (modelLower.includes('int4')) return 'int4';
  if (modelLower.includes('int8')) return 'int8';
  if (modelLower.includes('nf4') || modelLower.includes('bnb')) return 'nf4';

  // 通用fp8默认为e4m3fn（更快的变体）
  if (modelLower.includes('fp8')) return 'fp8_e4m3fn';

  // GGUF格式应该使用default（ComfyUI兼容性）
  if (modelLower.endsWith('.gguf')) return 'default';

  return null; // 没有检测到明确的模式
}

/**
 * FLUX 模型权重类型选择工具 / FLUX Model Weight Dtype Selection Tool
 * 
 * @description 简单的权重类型选择：用户显式设置优先，否则使用ModelNameStandardizer推荐值
 * Simple weight type selection: user explicit settings take priority, otherwise use ModelNameStandardizer recommendations
 * 
 * @param {string} modelName - 模型文件名或路径 / Model filename or path
 * @param {WeightDtypeParams} params - 权重选择参数 / Weight selection parameters
 * @returns {string} 权重类型字符串 / Weight type string
 */
export function selectOptimalWeightDtype(modelName: string, params: WeightDtypeParams = {}): string {
  // 处理null/undefined参数
  const safeParams = params || {};
  
  // 1. 用户显式设置具有最高优先级
  if (safeParams.weightDtype) {
    return safeParams.weightDtype;
  }

  // 2. 使用 ModelNameStandardizer 进行精确匹配
  // 这会在无法匹配时抛出 ModelNotFoundError，确保没有回退逻辑
  const standardizedModel = ModelNameStandardizer.standardize(modelName);
  
  // 3. 直接返回推荐的权重类型
  return standardizedModel.recommendedDtype;
}


