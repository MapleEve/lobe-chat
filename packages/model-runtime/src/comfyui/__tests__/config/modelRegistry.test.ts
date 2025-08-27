import { describe, expect, it } from 'vitest';

import {
  MODEL_REGISTRY,
  getAllModelNames,
  getModelConfig,
  getModelsByVariant,
} from '../../config/modelRegistry';

describe('ModelRegistry', () => {
  describe('MODEL_REGISTRY', () => {
    it('should be a non-empty object with valid structure', () => {
      expect(typeof MODEL_REGISTRY).toBe('object');
      expect(Object.keys(MODEL_REGISTRY).length).toBeGreaterThan(0);

      // Check that all models have required fields
      Object.entries(MODEL_REGISTRY).forEach(([_name, config]) => {
        expect(config).toBeDefined();
        expect(config.modelFamily).toBeDefined();
        expect(config.priority).toBeTypeOf('number');
        if (config.recommendedDtype) {
          expect(['default', 'fp8_e4m3fn', 'fp8_e4m3fn_fast', 'fp8_e5m2'].includes(config.recommendedDtype)).toBe(true);
        }
      });
    });

    it('should contain essential model families', () => {
      const modelFamilies = Object.values(MODEL_REGISTRY).map((c) => c.modelFamily);
      const uniqueFamilies = [...new Set(modelFamilies)];

      expect(uniqueFamilies).toContain('FLUX');
    });

    it('should have valid priority ranges', () => {
      Object.entries(MODEL_REGISTRY).forEach(([_name, config]) => {
        // Priorities should be positive numbers
        expect(config.priority).toBeGreaterThan(0);
        expect(config.priority).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('getModelConfig', () => {
    it('should return model config for valid name', () => {
      const config = getModelConfig('flux1-dev.safetensors');
      expect(config).toBeDefined();
      expect(config?.modelFamily).toBe('FLUX');
    });

    it('should return undefined for invalid name', () => {
      const config = getModelConfig('nonexistent.safetensors');
      expect(config).toBeUndefined();
    });
  });

  describe('getAllModelNames', () => {
    it('should return all model names', () => {
      const names = getAllModelNames();
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('flux1-dev.safetensors');
    });

    it('should return unique names', () => {
      const names = getAllModelNames();
      const uniqueNames = [...new Set(names)];
      expect(uniqueNames.length).toBe(names.length);
    });
  });

  describe('getModelsByVariant', () => {
    it('should return model names for valid variant', () => {
      const modelNames = getModelsByVariant('dev');
      expect(modelNames.length).toBeGreaterThan(0);
      expect(Array.isArray(modelNames)).toBe(true);
      
      // Verify all returned names are strings and correspond to dev variant models
      modelNames.forEach((name) => {
        expect(typeof name).toBe('string');
        const config = getModelConfig(name);
        expect(config).toBeDefined();
        expect(config?.variant).toBe('dev');
      });
    });

    it('should return models sorted by priority', () => {
      const modelNames = getModelsByVariant('dev');
      expect(modelNames.length).toBeGreaterThan(1);
      
      // Verify priority sorting (lower priority number = higher priority)
      for (let i = 0; i < modelNames.length - 1; i++) {
        const config1 = getModelConfig(modelNames[i]);
        const config2 = getModelConfig(modelNames[i + 1]);
        expect(config1?.priority).toBeLessThanOrEqual(config2?.priority || 0);
      }
    });

    it('should return empty array for invalid variant', () => {
      const models = getModelsByVariant('nonexistent' as any);
      expect(models).toEqual([]);
    });
  });
});