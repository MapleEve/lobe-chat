// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { selectOptimalWeightDtype } from './weight-dtype';

describe('selectOptimalWeightDtype', () => {
  it('should return user-specified weightDtype when provided', () => {
    const params = { weightDtype: 'fp32' };
    expect(selectOptimalWeightDtype('any_model.safetensors', params)).toBe('fp32');

    const params2 = { weightDtype: 'int8' };
    expect(selectOptimalWeightDtype('flux_dev.safetensors', params2)).toBe('int8');
  });

  it('should detect fp32 precision from model name', () => {
    expect(selectOptimalWeightDtype('flux_model_fp32.safetensors', {})).toBe('fp32');
    expect(selectOptimalWeightDtype('FLUX_FP32_MODEL.safetensors', {})).toBe('fp32');
  });

  it('should detect fp16 precision from model name', () => {
    expect(selectOptimalWeightDtype('flux_model_fp16.safetensors', {})).toBe('fp16');
    expect(selectOptimalWeightDtype('FLUX_FP16_MODEL.safetensors', {})).toBe('fp16');
  });

  it('should detect fp8_e4m3fn precision from model name', () => {
    expect(selectOptimalWeightDtype('flux_model_fp8_e4m3fn.safetensors', {})).toBe('fp8_e4m3fn');
    expect(selectOptimalWeightDtype('flux_model_fp8-e4m3fn.safetensors', {})).toBe('fp8_e4m3fn');
    expect(selectOptimalWeightDtype('FLUX_FP8_E4M3FN_MODEL.safetensors', {})).toBe('fp8_e4m3fn');
  });

  it('should detect fp8_e5m2 precision from model name', () => {
    expect(selectOptimalWeightDtype('flux_model_fp8_e5m2.safetensors', {})).toBe('fp8_e5m2');
    expect(selectOptimalWeightDtype('flux_model_fp8-e5m2.safetensors', {})).toBe('fp8_e5m2');
    expect(selectOptimalWeightDtype('FLUX_FP8_E5M2_MODEL.safetensors', {})).toBe('fp8_e5m2');
  });

  it('should default to fp8_e4m3fn for generic fp8', () => {
    expect(selectOptimalWeightDtype('flux_model_fp8.safetensors', {})).toBe('fp8_e4m3fn');
    expect(selectOptimalWeightDtype('FLUX_FP8_MODEL.safetensors', {})).toBe('fp8_e4m3fn');
  });

  it('should detect nf4 quantization', () => {
    expect(selectOptimalWeightDtype('flux_model_nf4.safetensors', {})).toBe('nf4');
    expect(selectOptimalWeightDtype('flux_model_bnb.safetensors', {})).toBe('nf4');
    expect(selectOptimalWeightDtype('FLUX_NF4_MODEL.safetensors', {})).toBe('nf4');
    expect(selectOptimalWeightDtype('FLUX_BNB_MODEL.safetensors', {})).toBe('nf4');
  });

  it('should detect int8 quantization', () => {
    expect(selectOptimalWeightDtype('flux_model_int8.safetensors', {})).toBe('int8');
    expect(selectOptimalWeightDtype('FLUX_INT8_MODEL.safetensors', {})).toBe('int8');
  });

  it('should detect int4 quantization', () => {
    expect(selectOptimalWeightDtype('flux_model_int4.safetensors', {})).toBe('int4');
    expect(selectOptimalWeightDtype('FLUX_INT4_MODEL.safetensors', {})).toBe('int4');
  });

  it('should return auto for GGUF format', () => {
    expect(selectOptimalWeightDtype('flux_model.gguf', {})).toBe('auto');
    expect(selectOptimalWeightDtype('FLUX_MODEL.GGUF', {})).toBe('auto');
    expect(selectOptimalWeightDtype('flux_dev_q4_0.gguf', {})).toBe('auto');
  });

  it('should optimize Schnell models for speed with fp8_e4m3fn', () => {
    expect(selectOptimalWeightDtype('flux_schnell.safetensors', {})).toBe('fp8_e4m3fn');
    expect(selectOptimalWeightDtype('FLUX_SCHNELL_MODEL.safetensors', {})).toBe('fp8_e4m3fn');
  });

  it('should use auto for Dev models for quality', () => {
    expect(selectOptimalWeightDtype('flux_dev.safetensors', {})).toBe('auto');
    expect(selectOptimalWeightDtype('FLUX_DEV_MODEL.safetensors', {})).toBe('auto');
  });

  it('should use auto for Krea models for quality', () => {
    expect(selectOptimalWeightDtype('flux_krea.safetensors', {})).toBe('auto');
    expect(selectOptimalWeightDtype('FLUX_KREA_MODEL.safetensors', {})).toBe('auto');
  });

  it('should use auto for Kontext models for quality', () => {
    expect(selectOptimalWeightDtype('flux_kontext.safetensors', {})).toBe('auto');
    expect(selectOptimalWeightDtype('FLUX_KONTEXT_MODEL.safetensors', {})).toBe('auto');
  });

  it('should return auto as default for unknown models', () => {
    expect(selectOptimalWeightDtype('unknown_model.safetensors', {})).toBe('auto');
    expect(selectOptimalWeightDtype('custom_flux.bin', {})).toBe('auto');
    expect(selectOptimalWeightDtype('model.pt', {})).toBe('auto');
  });

  it('should prioritize user specification over model-based detection', () => {
    const params = { weightDtype: 'fp16' };
    expect(selectOptimalWeightDtype('flux_schnell_fp8.safetensors', params)).toBe('fp16');
    expect(selectOptimalWeightDtype('flux_dev_fp32.safetensors', params)).toBe('fp16');
  });

  it('should prioritize specific precision over model type optimization', () => {
    // fp32 in filename should override Schnell optimization
    expect(selectOptimalWeightDtype('flux_schnell_fp32.safetensors', {})).toBe('fp32');

    // fp16 in filename should override Dev auto selection
    expect(selectOptimalWeightDtype('flux_dev_fp16.safetensors', {})).toBe('fp16');
  });

  it('should handle complex model names with multiple keywords', () => {
    expect(selectOptimalWeightDtype('flux_dev_schnell_hybrid_fp8_e4m3fn.safetensors', {})).toBe(
      'fp8_e4m3fn',
    );
    expect(selectOptimalWeightDtype('flux_krea_kontext_fusion_int8.safetensors', {})).toBe('int8');
  });

  it('should handle empty params object', () => {
    expect(selectOptimalWeightDtype('flux_model.safetensors', {})).toBe('auto');
  });

  it('should handle null/undefined params', () => {
    expect(selectOptimalWeightDtype('flux_model.safetensors', null)).toBe('auto');
    expect(selectOptimalWeightDtype('flux_model.safetensors', undefined)).toBe('auto');
  });

  it('should be case-insensitive for all detections', () => {
    expect(selectOptimalWeightDtype('FLUX_SCHNELL_FP8_E4M3FN.SAFETENSORS', {})).toBe('fp8_e4m3fn');
    expect(selectOptimalWeightDtype('flux_dev_INT4.SAFETENSORS', {})).toBe('int4');
    expect(selectOptimalWeightDtype('FLUX_KREA_NF4.safetensors', {})).toBe('nf4');
  });

  it('should handle edge cases with file extensions', () => {
    expect(selectOptimalWeightDtype('flux_model', {})).toBe('auto');
    expect(selectOptimalWeightDtype('flux_model.', {})).toBe('auto');
    expect(selectOptimalWeightDtype('.gguf', {})).toBe('auto');
  });
});
