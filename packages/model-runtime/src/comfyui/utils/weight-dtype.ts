/**
 * FLUX 模型动态weight_dtype选择工具
 * 根据模型文件名和用户配置智能选择最优精度
 */
export function selectOptimalWeightDtype(modelName: string, params: any): string {
  // User explicit setting takes precedence
  if (params?.weightDtype) {
    return params.weightDtype;
  }

  const modelLower = modelName.toLowerCase();

  // Specific precision detection (most specific first)
  if (modelLower.includes('fp8_e5m2') || modelLower.includes('fp8-e5m2')) return 'fp8_e5m2';
  if (modelLower.includes('fp8_e4m3fn') || modelLower.includes('fp8-e4m3fn')) return 'fp8_e4m3fn';
  if (modelLower.includes('fp32')) return 'fp32';
  if (modelLower.includes('fp16')) return 'fp16';

  // Quantization detection
  if (modelLower.includes('int4')) return 'int4';
  if (modelLower.includes('int8')) return 'int8';
  if (modelLower.includes('nf4') || modelLower.includes('bnb')) return 'nf4';

  // Generic fp8 defaults to e4m3fn (faster variant)
  if (modelLower.includes('fp8')) return 'fp8_e4m3fn';

  // GGUF format should use default (ComfyUI doesn't accept 'auto')
  if (modelLower.endsWith('.gguf')) return 'default';

  // Model-type based optimization
  if (modelLower.includes('schnell')) return 'fp8_e4m3fn'; // Speed-optimized

  // Default: default for quality models (dev, krea, kontext) - ComfyUI doesn't accept 'auto'
  return 'default';
}
