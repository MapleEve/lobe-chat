// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { ModelNameStandardizer, ModelNotFoundError } from './model-name-standardizer';

describe('ModelNameStandardizer', () => {
  describe('精确模型匹配', () => {
    it('should standardize Black Forest Labs official models', () => {
      const devModel = ModelNameStandardizer.standardize('flux1-dev.safetensors');
      expect(devModel.standardName).toBe('FLUX.1-dev');
      expect(devModel.variant).toBe('dev');
      expect(devModel.recommendedDtype).toBe('default');
      expect(devModel.source).toBe('black-forest-labs');

      const schnellModel = ModelNameStandardizer.standardize('flux1-schnell.safetensors');
      expect(schnellModel.standardName).toBe('FLUX.1-schnell');
      expect(schnellModel.variant).toBe('schnell');
      expect(schnellModel.recommendedDtype).toBe('fp8_e4m3fn');
    });

    it('should standardize enterprise distilled models', () => {
      const liteModel = ModelNameStandardizer.standardize('flux.1-lite-8B.safetensors');
      expect(liteModel.standardName).toBe('Freepik FLUX.1-lite-8B');
      expect(liteModel.variant).toBe('lite');
      expect(liteModel.fileSizeGB).toBe(16.3);
      expect(liteModel.source).toBe('Freepik');

      const miniModel = ModelNameStandardizer.standardize('flux-mini.safetensors');
      expect(miniModel.standardName).toBe('TencentARC flux-mini');
      expect(miniModel.variant).toBe('mini');
      expect(miniModel.fileSizeGB).toBe(6.36);
    });

    it('should standardize GGUF quantized models', () => {
      const q4Model = ModelNameStandardizer.standardize('flux1-dev-Q4_K_S.gguf');
      expect(q4Model.standardName).toBe('FLUX.1-dev-Q4_K_S');
      expect(q4Model.quantization).toBe('gguf');
      expect(q4Model.recommendedDtype).toBe('default');
      expect(q4Model.fileSizeGB).toBe(6.81);

      const q8Model = ModelNameStandardizer.standardize('flux1-schnell-Q8_0.gguf');
      expect(q8Model.quantization).toBe('gguf');
      expect(q8Model.fileSizeGB).toBe(12.7);
    });

    it('should standardize FP8/NF4 quantized models', () => {
      const fp8Model = ModelNameStandardizer.standardize('flux1-dev-fp8.safetensors');
      expect(fp8Model.quantization).toBe('fp8_e4m3fn');
      expect(fp8Model.recommendedDtype).toBe('fp8_e4m3fn');
      expect(fp8Model.source).toBe('Kijai');

      const nf4Model = ModelNameStandardizer.standardize('flux1-dev-bnb-nf4.safetensors');
      expect(nf4Model.quantization).toBe('bnb_nf4');
      expect(nf4Model.recommendedDtype).toBe('nf4');
      expect(nf4Model.source).toBe('lllyasviel');
    });

    it('should standardize CivitAI community models', () => {
      // Jib Mix Flux 系列
      const jibV11 = ModelNameStandardizer.standardize('Jib_mix_Flux_V11_Krea_b_00001_.safetensors');
      expect(jibV11.standardName).toBe('Jib Mix Flux V11 Krea NSFW');
      expect(jibV11.variant).toBe('krea');
      expect(jibV11.source).toBe('CivitAI-JibMix');

      // Vision Realistic 系列 - using intelligent mapping since not in registry
      const visionReal = ModelNameStandardizer.standardizeWithIntelligentMapping('vision_realistic_flux_dev_fp8_no_clip_v2.safetensors');
      expect(visionReal.priority).toBe(3); // Community model
      expect(visionReal.variant).toBe('dev');

      // UltraReal Fine-Tune 系列
      const ultraReal = ModelNameStandardizer.standardize('UltraRealistic_FineTune_Project_v4.safetensors');
      expect(ultraReal.standardName).toBe('UltraRealistic FineTune Project V4');
      expect(ultraReal.source).toBe('CivitAI-UltraReal');
    });

    it('should standardize text encoders and VAE', () => {
      const vae = ModelNameStandardizer.standardize('ae.safetensors');
      expect(vae.standardName).toBe('FLUX VAE AutoEncoder');
      expect(vae.fileSizeGB).toBe(0.335);

      const clipL = ModelNameStandardizer.standardize('clip_l.safetensors');
      expect(clipL.standardName).toBe('CLIP-L Text Encoder');
      expect(clipL.fileSizeGB).toBe(0.246);

      const t5xxl = ModelNameStandardizer.standardize('t5xxl_fp16.safetensors');
      expect(t5xxl.standardName).toBe('T5-XXL Text Encoder FP16');
      expect(t5xxl.quantization).toBe('fp16');
      expect(t5xxl.fileSizeGB).toBe(9.79);
    });

    it('should standardize LoRA adapters', () => {
      const realismLora = ModelNameStandardizer.standardize('realism_lora.safetensors');
      expect(realismLora.standardName).toBe('XLabs Realism LoRA');
      expect(realismLora.source).toBe('XLabs-AI');
      expect(realismLora.fileSizeGB).toBe(0.05);

      const animeLora = ModelNameStandardizer.standardize('anime_lora.safetensors');
      expect(animeLora.standardName).toBe('XLabs Anime LoRA');
    });
  });

  describe('大小写不敏感匹配', () => {
    it('should handle case-insensitive matching', () => {
      const upperCase = ModelNameStandardizer.standardize('FLUX1-DEV.SAFETENSORS');
      expect(upperCase.standardName).toBe('FLUX.1-dev');
      expect(upperCase.variant).toBe('dev');

      const mixedCase = ModelNameStandardizer.standardize('Flux1-Schnell.SafeTensors');
      expect(mixedCase.standardName).toBe('FLUX.1-schnell');
      expect(mixedCase.variant).toBe('schnell');
    });
  });

  describe('路径处理', () => {
    it('should extract filename from full path', () => {
      const withPath = ModelNameStandardizer.standardize('/path/to/models/flux1-dev.safetensors');
      expect(withPath.standardName).toBe('FLUX.1-dev');

      const windowsPath = ModelNameStandardizer.standardize('C:/Models/flux1-schnell.safetensors');
      expect(windowsPath.standardName).toBe('FLUX.1-schnell');
    });
  });

  describe('严格模式 - 无回退逻辑', () => {
    it('should throw ModelNotFoundError for unknown models', () => {
      expect(() => {
        ModelNameStandardizer.standardize('unknown_model.safetensors');
      }).toThrow(ModelNotFoundError);

      expect(() => {
        ModelNameStandardizer.standardize('flux_fake_model.safetensors');
      }).toThrow(ModelNotFoundError);

      expect(() => {
        ModelNameStandardizer.standardize('not_a_flux_model.ckpt');
      }).toThrow(ModelNotFoundError);
    });

    it('should include model name in error message', () => {
      try {
        ModelNameStandardizer.standardize('unknown_model.safetensors');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelNotFoundError);
        expect((error as Error).message).toContain('unknown_model.safetensors');
        expect((error as Error).message).toContain('Only verified FLUX models are supported');
      }
    });
  });

  describe('验证方法', () => {
    it('should validate known models correctly', () => {
      expect(ModelNameStandardizer.isValidModel('flux1-dev.safetensors')).toBe(true);
      expect(ModelNameStandardizer.isValidModel('flux1-schnell.safetensors')).toBe(true);
      expect(ModelNameStandardizer.isValidModel('unknown_model.safetensors')).toBe(false);
    });

    it('should get recommended dtype for valid models', () => {
      expect(ModelNameStandardizer.getRecommendedDtype('flux1-dev.safetensors')).toBe('default');
      expect(ModelNameStandardizer.getRecommendedDtype('flux1-schnell.safetensors')).toBe('fp8_e4m3fn');
      expect(ModelNameStandardizer.getRecommendedDtype('flux1-dev-fp8.safetensors')).toBe('fp8_e4m3fn');

      expect(() => {
        ModelNameStandardizer.getRecommendedDtype('unknown_model.safetensors');
      }).toThrow(ModelNotFoundError);
    });
  });

  describe('模型查询方法', () => {
    it('should get all valid models', () => {
      const allModels = ModelNameStandardizer.getAllValidModels();
      expect(allModels).toContain('flux1-dev.safetensors');
      expect(allModels).toContain('flux1-schnell.safetensors');
      expect(allModels).toContain('flux.1-lite-8B.safetensors');
      expect(allModels.length).toBeGreaterThan(50); // 应该有105个模型
    });

    it('should get models by source', () => {
      const blackForestModels = ModelNameStandardizer.getModelsBySource('black-forest-labs');
      expect(blackForestModels).toContain('flux1-dev.safetensors');
      expect(blackForestModels).toContain('flux1-schnell.safetensors');

      const freepikModels = ModelNameStandardizer.getModelsBySource('Freepik');
      expect(freepikModels).toContain('flux.1-lite-8B.safetensors');

      const kivitaiJibMixModels = ModelNameStandardizer.getModelsBySource('CivitAI-JibMix');
      expect(kivitaiJibMixModels).toContain('Jib_mix_Flux_V11_Krea_b_00001_.safetensors');
    });

    it('should get models by variant', () => {
      const devModels = ModelNameStandardizer.getModelsByVariant('dev');
      expect(devModels).toContain('flux1-dev.safetensors');
      expect(devModels.length).toBeGreaterThan(1); // 应该有多个dev模型

      const schnellModels = ModelNameStandardizer.getModelsByVariant('schnell');
      expect(schnellModels).toContain('flux1-schnell.safetensors');

      const liteModels = ModelNameStandardizer.getModelsByVariant('lite');
      expect(liteModels).toContain('flux.1-lite-8B.safetensors');

      const fillModels = ModelNameStandardizer.getModelsByVariant('fill');
      expect(fillModels).toContain('flux1-fill-dev.safetensors');

      const reduxModels = ModelNameStandardizer.getModelsByVariant('redux');
      expect(reduxModels).toContain('flux1-redux-dev.safetensors');

      const kontextModels = ModelNameStandardizer.getModelsByVariant('kontext');
      expect(kontextModels).toContain('flux1-kontext-dev.safetensors');
    });
  });

  describe('三级优先级系统', () => {
    it('should have priority and subPriority fields in all models', () => {
      const allModels = ModelNameStandardizer.getAllValidModels();
      
      allModels.forEach(modelName => {
        const model = ModelNameStandardizer.standardize(modelName);
        expect(model.priority).toBeDefined();
        expect(model.subPriority).toBeDefined();
        expect([1, 2, 3]).toContain(model.priority);
        expect(typeof model.subPriority).toBe('number');
        expect(model.subPriority).toBeGreaterThanOrEqual(0);
      });
    });

    it('should return official models with priority 1', () => {
      const officialModels = [
        'flux1-dev.safetensors',
        'flux1-schnell.safetensors',
        'flux1-fill-dev.safetensors',
        'flux1-kontext-dev.safetensors',
        'flux1-redux-dev.safetensors',
        'ae.safetensors'
      ];

      officialModels.forEach(modelName => {
        const model = ModelNameStandardizer.standardize(modelName);
        expect(model.priority).toBe(1);
        expect(model.source).toBe('black-forest-labs');
      });
    });

    it('should return enterprise models with priority 2', () => {
      const enterpriseModels = [
        'flux.1-lite-8B.safetensors',
        'flux-mini.safetensors',
        'flux1-dev-fp8.safetensors',
        'clip_l.safetensors',
        't5xxl_fp16.safetensors'
      ];

      enterpriseModels.forEach(modelName => {
        const model = ModelNameStandardizer.standardize(modelName);
        expect(model.priority).toBe(2);
        expect(['Freepik', 'TencentARC', 'Kijai', 'lllyasviel', 'city96', 'comfyanonymous']).toContain(model.source);
      });
    });

    it('should return community models with priority 3', () => {
      const communityModels = [
        'Jib_mix_Flux_V11_Krea_b_00001_.safetensors',
        'UltraRealistic_FineTune_Project_v4.safetensors',
        'realism_lora.safetensors'
      ];

      communityModels.forEach(modelName => {
        const model = ModelNameStandardizer.standardize(modelName);
        expect(model.priority).toBe(3);
        expect(model.source.startsWith('CivitAI-') || model.source === 'XLabs-AI' || model.source === 'drbaph' || model.source === 'ashen0209').toBe(true);
      });
    });

    it('should sort official models by subPriority correctly', () => {
      const officialModels = ModelNameStandardizer.getModelsByPriority(1);
      expect(officialModels.length).toBeGreaterThan(0);

      // 验证 dev 模型的 subPriority 为 1 (最高优先级)
      const devModel = ModelNameStandardizer.standardize('flux1-dev.safetensors');
      expect(devModel.subPriority).toBe(1);

      // 验证 schnell 模型的 subPriority 为 2
      const schnellModel = ModelNameStandardizer.standardize('flux1-schnell.safetensors');
      expect(schnellModel.subPriority).toBe(2);
    });
  });

  describe('智能优先级查询方法', () => {
    it('should implement getModelsByPriority method', () => {
      const priority1Models = ModelNameStandardizer.getModelsByPriority(1);
      const priority2Models = ModelNameStandardizer.getModelsByPriority(2);
      const priority3Models = ModelNameStandardizer.getModelsByPriority(3);

      expect(priority1Models.length).toBeGreaterThan(0);
      expect(priority2Models.length).toBeGreaterThan(0);
      expect(priority3Models.length).toBeGreaterThan(0);

      // 验证官方模型在 priority 1 中
      expect(priority1Models).toContain('flux1-dev.safetensors');
      expect(priority1Models).toContain('flux1-schnell.safetensors');
    });

    // Removed getPriorityModels test - this method was removed as part of smart selection removal

    it('should implement getModelPriority method', () => {
      const devPriority = ModelNameStandardizer.getModelPriority('flux1-dev.safetensors');
      expect(devPriority).not.toBeNull();
      expect(devPriority!.priority).toBe(1);
      expect(devPriority!.subPriority).toBe(1);
      expect(devPriority!.category).toContain('官方模型');

      const litePriority = ModelNameStandardizer.getModelPriority('flux.1-lite-8B.safetensors');
      expect(litePriority).not.toBeNull();
      expect(litePriority!.priority).toBe(2);
      expect(litePriority!.category).toContain('企业');
    });
  });

  describe('RFC-128 完整的130+个模型验证', () => {
    it('should have at least 130 verified models (RFC-128 requirement)', () => {
      const allModels = ModelNameStandardizer.getAllValidModels();
      
      // RFC-128 分支要求：确保至少支持130个验证过的模型
      // 从95模型扩展到130+模型，支持200+智能映射
      expect(allModels.length).toBeGreaterThanOrEqual(130);
      
      // 验证关键模型都存在
      const keyModels = [
        'flux1-dev.safetensors',
        'flux1-schnell.safetensors',
        'flux.1-lite-8B.safetensors',
        'flux-mini.safetensors',
        'ae.safetensors',
        'clip_l.safetensors',
        't5xxl_fp16.safetensors'
      ];
      
      keyModels.forEach(model => {
        expect(allModels).toContain(model);
      });
    });

    it('should provide correct weight dtype recommendations for all models', () => {
      const allModels = ModelNameStandardizer.getAllValidModels();
      
      allModels.forEach(modelName => {
        const dtype = ModelNameStandardizer.getRecommendedDtype(modelName);
        expect(typeof dtype).toBe('string');
        expect(dtype.length).toBeGreaterThan(0);
        
        // 验证推荐的 dtype 是有效的
        const validDtypes = ['default', 'fp8_e4m3fn', 'fp8_e5m2', 'fp16', 'fp32', 'nf4', 'int4', 'int8'];
        expect(validDtypes).toContain(dtype);
      });
    });
  });

  describe('RFC-128 智能映射系统 (Intelligent Mapping System)', () => {
    describe('别名映射 (Alias Mapping)', () => {
      it('should handle model name variations through aliases', () => {
        // Test different naming variations
        const variations = [
          { input: 'flux-dev.safetensors', expectedVariant: 'dev' },
          { input: 'FLUX.1-dev.safetensors', expectedVariant: 'dev' },
          { input: 'flux_1_dev.safetensors', expectedVariant: 'dev' },
          { input: 'flux-schnell.safetensors', expectedVariant: 'schnell' },
          { input: 'FLUX.1-schnell.safetensors', expectedVariant: 'schnell' }
        ];

        variations.forEach(({ input, expectedVariant }) => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(input);
          expect(result.variant).toBe(expectedVariant);
          expect(result.priority).toBe(1); // Should be official models
        });
      });
    });

    describe('模式识别 (Pattern Recognition)', () => {
      it('should recognize GGUF quantized models', () => {
        const testCases = [
          'flux1-dev-Q4_K_S.gguf',
          'flux1-schnell-Q2_K.gguf',
          'flux1-kontext-Q8_0.gguf',
          'flux1-krea-F16.gguf'
        ];

        testCases.forEach(modelName => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(modelName);
          expect(result.quantization).toBe('gguf');
          expect(result.priority).toBe(2); // Enterprise priority
          expect(result.recommendedDtype).toBe('default');
        });
      });

      it('should recognize FP8 quantized models', () => {
        const testCases = [
          'flux1-dev-fp8-e4m3fn.safetensors',
          'flux1-schnell-fp8-e5m2.safetensors'
        ];

        testCases.forEach(modelName => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(modelName);
          expect(result.priority).toBe(2);
          expect(result.recommendedDtype).toBe('fp8_e4m3fn');
        });
      });

      it('should recognize NF4 quantized models', () => {
        const testCases = [
          'flux1-dev-nf4.safetensors',
          'flux1-schnell-bnb-nf4.safetensors',
          'flux1-krea-nf4-v2.safetensors'
        ];

        testCases.forEach(modelName => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(modelName);
          expect(result.priority).toBe(2);
          expect(result.recommendedDtype).toBe('nf4');
        });
      });

      it('should recognize enterprise models', () => {
        const testCases = [
          { name: 'flux.1-lite-8B-new.safetensors', expectedVariant: 'lite' },
          { name: 'flux-mini-v2.safetensors', expectedVariant: 'mini' }
        ];

        testCases.forEach(({ name, expectedVariant }) => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(name);
          expect(result.priority).toBe(2);
          expect(result.variant).toBe(expectedVariant);
        });
      });

      it('should recognize community models', () => {
        const testCases = [
          'real_dream_flux_v3.safetensors',
          'vision_realistic_flux_enhanced.safetensors',
          'ultra_real_photo_flux.safetensors'
        ];

        testCases.forEach(modelName => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(modelName);
          expect(result.priority).toBe(3);
          expect(result.variant).toBe('dev');
        });
      });

      it('should recognize LoRA adapters', () => {
        const testCases = [
          'realism_lora.safetensors',
          'anime_lora.safetensors',
          'art_lora.safetensors'
        ];

        testCases.forEach(modelName => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(modelName);
          expect(result.priority).toBe(3);
          expect(result.variant).toBe('dev');
        });
      });
    });

    describe('模糊匹配 (Fuzzy Matching)', () => {
      it('should handle slight typos in model names', () => {
        // Note: This will only work for models that exist in registry
        // Since fuzzy matching checks against existing models first
        const typoTests = [
          { input: 'flux1dev.safetensors', shouldMatch: true }, // Missing hyphen
          { input: 'flux1_dev.safetensors', shouldMatch: true }, // Underscore instead of hyphen
        ];

        typoTests.forEach(({ input, shouldMatch }) => {
          if (shouldMatch) {
            const result = ModelNameStandardizer.standardizeWithIntelligentMapping(input);
            expect(result).toBeDefined();
            expect(result.variant).toBe('dev');
          }
        });
      });
    });

    describe('通用FLUX模型回退 (Generic FLUX Fallback)', () => {
      it('should provide fallback for any FLUX model', () => {
        const unknownFluxModels = [
          'flux_custom_model_v1.safetensors',
          'flux-experimental-123.safetensors',
          'flux_unknown_variant.safetensors'
        ];

        unknownFluxModels.forEach(modelName => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(modelName);
          expect(result.priority).toBe(3); // Community fallback
          expect(result.variant).toBe('dev'); // Default variant
          expect(result.recommendedDtype).toBe('default');
        });
      });
    });

    describe('向后兼容性 (Backward Compatibility)', () => {
      it('should maintain backward compatibility with strict mode by default', () => {
        // Without intelligent mapping, unknown models should throw
        expect(() => {
          ModelNameStandardizer.standardize('unknown_flux_model.safetensors');
        }).toThrow(ModelNotFoundError);

        expect(() => {
          ModelNameStandardizer.standardize('unknown_flux_model.safetensors', false);
        }).toThrow(ModelNotFoundError);
      });

      it('should enable intelligent mapping when requested', () => {
        // With intelligent mapping, unknown FLUX models should work
        const result = ModelNameStandardizer.standardize('unknown_flux_model.safetensors', true);
        expect(result).toBeDefined();
        expect(result.priority).toBe(3);
        expect(result.variant).toBe('dev');
      });

      it('should support convenience methods', () => {
        // Test convenience methods
        expect(ModelNameStandardizer.isValidModelWithIntelligentMapping('unknown_flux_model.safetensors')).toBe(true);
        expect(ModelNameStandardizer.isValidModel('unknown_flux_model.safetensors')).toBe(false);
        expect(ModelNameStandardizer.isValidModel('unknown_flux_model.safetensors', true)).toBe(true);

        const result = ModelNameStandardizer.standardizeWithIntelligentMapping('unknown_flux_model.safetensors');
        expect(result).toBeDefined();
        expect(result.priority).toBe(3);
      });
    });

    describe('变体提取 (Variant Extraction)', () => {
      it('should correctly extract variants from filenames', () => {
        const variantTests = [
          { input: 'flux1-schnell-custom.safetensors', expected: 'schnell' },
          { input: 'flux1-kontext-experimental.safetensors', expected: 'kontext' },
          { input: 'flux1-krea-modified.safetensors', expected: 'krea' },
          { input: 'flux1-fill-custom.safetensors', expected: 'fill' },
          { input: 'flux1-redux-test.safetensors', expected: 'redux' },
          { input: 'flux-lite-custom.safetensors', expected: 'lite' },
          { input: 'flux-mini-test.safetensors', expected: 'mini' },
          { input: 'flux-custom.safetensors', expected: 'dev' } // Default
        ];

        variantTests.forEach(({ input, expected }) => {
          const result = ModelNameStandardizer.standardizeWithIntelligentMapping(input);
          expect(result.variant).toBe(expected);
        });
      });
    });
  });
});