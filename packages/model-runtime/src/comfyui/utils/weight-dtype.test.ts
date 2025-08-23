// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { selectOptimalWeightDtype, type WeightDtypeParams } from './weight-dtype';
import { ModelNotFoundError } from './model-name-standardizer';

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

  it('should return default for GGUF format', () => {
    expect(selectOptimalWeightDtype('flux_model.gguf', {})).toBe('default');
    expect(selectOptimalWeightDtype('FLUX_MODEL.GGUF', {})).toBe('default');
    expect(selectOptimalWeightDtype('flux_dev_q4_0.gguf', {})).toBe('default');
  });

  it('should optimize Schnell models for speed with fp8_e4m3fn', () => {
    expect(selectOptimalWeightDtype('flux_schnell.safetensors', {})).toBe('fp8_e4m3fn');
    expect(selectOptimalWeightDtype('FLUX_SCHNELL_MODEL.safetensors', {})).toBe('fp8_e4m3fn');
  });

  it('should use default for Dev models for quality', () => {
    expect(selectOptimalWeightDtype('flux_dev.safetensors', {})).toBe('default');
    expect(selectOptimalWeightDtype('FLUX_DEV_MODEL.safetensors', {})).toBe('default');
  });

  it('should use default for Krea models for quality', () => {
    expect(selectOptimalWeightDtype('flux_krea.safetensors', {})).toBe('default');
    expect(selectOptimalWeightDtype('FLUX_KREA_MODEL.safetensors', {})).toBe('default');
  });

  it('should use default for Kontext models for quality', () => {
    expect(selectOptimalWeightDtype('flux_kontext.safetensors', {})).toBe('default');
    expect(selectOptimalWeightDtype('FLUX_KONTEXT_MODEL.safetensors', {})).toBe('default');
  });

  it('should throw ModelNotFoundError for unknown models', () => {
    expect(() => {
      selectOptimalWeightDtype('unknown_model.safetensors', {});
    }).toThrow(ModelNotFoundError);
    expect(() => {
      selectOptimalWeightDtype('custom_flux.bin', {});
    }).toThrow(ModelNotFoundError);
    expect(() => {
      selectOptimalWeightDtype('model.pt', {});
    }).toThrow(ModelNotFoundError);
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
    expect(selectOptimalWeightDtype('flux_model.safetensors', {})).toBe('default');
  });

  it('should handle null/undefined params', () => {
    expect(selectOptimalWeightDtype('flux_model.safetensors', null as any)).toBe('default');
    expect(selectOptimalWeightDtype('flux_model.safetensors', undefined)).toBe('default');
  });

  it('should be case-insensitive for all detections', () => {
    expect(selectOptimalWeightDtype('FLUX_SCHNELL_FP8_E4M3FN.SAFETENSORS', {})).toBe('fp8_e4m3fn');
    expect(selectOptimalWeightDtype('flux_dev_INT4.SAFETENSORS', {})).toBe('int4');
    expect(selectOptimalWeightDtype('FLUX_KREA_NF4.safetensors', {})).toBe('nf4');
  });

  it('should handle edge cases with file extensions', () => {
    expect(() => {
      selectOptimalWeightDtype('flux_model', {});
    }).toThrow(ModelNotFoundError);
    expect(() => {
      selectOptimalWeightDtype('flux_model.', {});
    }).toThrow(ModelNotFoundError);
    expect(() => {
      selectOptimalWeightDtype('.gguf', {});
    }).toThrow(ModelNotFoundError);
  });

  // 增强功能测试用例
  describe('Enhanced Weight Type Selection', () => {
    it('should optimize enterprise models correctly', () => {
      // Freepik lite-8B 应该使用 fp8_e4m3fn 优化
      expect(selectOptimalWeightDtype('flux.1-lite-8B.safetensors', {})).toBe('fp8_e4m3fn');
      
      // TencentARC mini 应该使用 fp8_e4m3fn 优化  
      expect(selectOptimalWeightDtype('flux-mini.safetensors', {})).toBe('fp8_e4m3fn');
    });

    it('should respect prioritizeSpeed parameter', () => {
      const speedParams: WeightDtypeParams = { prioritizeSpeed: true };
      const qualityParams: WeightDtypeParams = { prioritizeSpeed: false };
      
      // 使用会触发fallback逻辑的模型名称（包含特殊字符，避免被标准化器识别）
      expect(selectOptimalWeightDtype('my-custom@flux#model.safetensors', speedParams)).toBe('fp8_e4m3fn');
      expect(selectOptimalWeightDtype('my-custom@flux#model.safetensors', qualityParams)).toBe('default');
      
      // 企业模型的速度/质量权衡 - 使用实际的企业模型名称
      expect(selectOptimalWeightDtype('flux.1-lite-8B.safetensors', speedParams)).toBe('fp8_e4m3fn');
      expect(selectOptimalWeightDtype('flux.1-lite-8B.safetensors', qualityParams)).toBe('fp8_e4m3fn'); // 企业模型本身已优化
    });

    it('should handle memory limitations intelligently', () => {
      const lowMemParams: WeightDtypeParams = { memoryLimitGB: 6 };
      const midMemParams: WeightDtypeParams = { memoryLimitGB: 10 };
      const highMemParams: WeightDtypeParams = { memoryLimitGB: 16 };
      
      // 使用会触发fallback逻辑的模型名称来测试内存驱动的选择
      expect(selectOptimalWeightDtype('weird@model&name.safetensors', lowMemParams)).toBe('fp8_e4m3fn');
      
      // 中等内存设备的权衡选择
      expect(selectOptimalWeightDtype('weird@model&name.safetensors', { ...midMemParams, prioritizeSpeed: true })).toBe('fp8_e4m3fn');
      expect(selectOptimalWeightDtype('weird@model&name.safetensors', { ...midMemParams, prioritizeSpeed: false })).toBe('default');
      
      // 高内存设备可以使用默认策略
      expect(selectOptimalWeightDtype('weird@model&name.safetensors', highMemParams)).toBe('default');
    });

    it('should handle 105 official models correctly', () => {
      // Black Forest Labs 官方模型
      expect(selectOptimalWeightDtype('flux1-dev.safetensors', {})).toBe('default');
      expect(selectOptimalWeightDtype('flux1-schnell.safetensors', {})).toBe('fp8_e4m3fn');
      expect(selectOptimalWeightDtype('flux1-fill-dev.safetensors', {})).toBe('default');
      expect(selectOptimalWeightDtype('flux1-redux-dev.safetensors', {})).toBe('default');
      expect(selectOptimalWeightDtype('flux1-kontext-dev.safetensors', {})).toBe('default');
      
      // GGUF 量化版本 - city96
      expect(selectOptimalWeightDtype('flux1-dev-Q4_K_S.gguf', {})).toBe('default');
      expect(selectOptimalWeightDtype('flux1-schnell-Q6_K.gguf', {})).toBe('default');
      
      // FP8/NF4 量化版本 - Kijai & lllyasviel  
      expect(selectOptimalWeightDtype('flux1-dev-fp8.safetensors', {})).toBe('fp8_e4m3fn');
      expect(selectOptimalWeightDtype('flux1-dev-bnb-nf4.safetensors', {})).toBe('nf4');
    });

    it('should handle community models from CivitAI', () => {
      // Jib Mix Flux 系列
      expect(selectOptimalWeightDtype('Jib_mix_Flux_V11_Krea_b_00001_.safetensors', {})).toBe('default');
      expect(selectOptimalWeightDtype('Jib_Mix_Flux_Krea_b_fp8_00001_.safetensors', {})).toBe('fp8_e4m3fn');
      
      // RealFlux 系列
      expect(selectOptimalWeightDtype('RealFlux_1.0b_Dev_Transformer.safetensors', {})).toBe('default');
      expect(selectOptimalWeightDtype('RealFlux_1.0b_Schnell_Transformer.safetensors', {})).toBe('fp8_e4m3fn');
      
      // Vision Realistic 系列
      expect(selectOptimalWeightDtype('vision_realistic_flux_dev_fp8_no_clip_v2.safetensors', {})).toBe('fp8_e4m3fn');
    });

    it('should throw ModelNotFoundError for unknown models', () => {
      // 测试严格模式：无法匹配时必须抛出错误，不允许回退
      expect(() => {
        selectOptimalWeightDtype('unknown_flux_schnell_fp8.safetensors', {});
      }).toThrow();

      expect(() => {
        selectOptimalWeightDtype('unknown_flux_dev.safetensors', {});
      }).toThrow();

      expect(() => {
        selectOptimalWeightDtype('unknown_model.gguf', {});
      }).toThrow();

      expect(() => {
        selectOptimalWeightDtype('not_a_flux_model.ckpt', {});
      }).toThrow();
    });
  });
});
