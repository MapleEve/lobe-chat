import { describe, expect, it } from 'vitest';

import {
  MODEL_REGISTRY,
  type ModelConfig,
  getAllModelNames,
  getModelConfig,
  getModelsByVariant,
} from './modelRegistry';

describe('ModelRegistry', () => {
  describe('MODEL_REGISTRY', () => {
    it('should be a non-empty object', () => {
      expect(typeof MODEL_REGISTRY).toBe('object');
      expect(Object.keys(MODEL_REGISTRY).length).toBeGreaterThan(0);
    });

    it('should contain expected official FLUX models', () => {
      expect(MODEL_REGISTRY['flux1-dev.safetensors']).toBeDefined();
      expect(MODEL_REGISTRY['flux1-schnell.safetensors']).toBeDefined();
      expect(MODEL_REGISTRY['flux1-kontext-dev.safetensors']).toBeDefined();
      expect(MODEL_REGISTRY['flux1-krea-dev.safetensors']).toBeDefined();
    });

    it('should have valid config structure for all models', () => {
      Object.entries(MODEL_REGISTRY).forEach(([modelName, config]) => {
        expect(config).toHaveProperty('priority');
        expect(config).toHaveProperty('variant');
        expect(config).toHaveProperty('modelFamily');
        expect(config).toHaveProperty('recommendedDtype');

        // Priority should be a positive number
        expect(typeof config.priority).toBe('number');
        expect(config.priority).toBeGreaterThan(0);

        // Variant should be one of the allowed values
        expect([
          'dev',
          'schnell',
          'kontext',
          'krea',
          'fill',
          'redux',
          'sd35',
          'sd35-no-clip',
        ]).toContain(config.variant);

        // Model family should be supported
        expect(['FLUX', 'SD1', 'SDXL', 'SD3']).toContain(config.modelFamily);

        // Recommended dtype should be valid
        expect(['default', 'fp8_e4m3fn', 'fp8_e4m3fn_fast', 'fp8_e5m2']).toContain(
          config.recommendedDtype,
        );
      });
    });

    it('should have priority 1 for official models', () => {
      expect(MODEL_REGISTRY['flux1-dev.safetensors'].priority).toBe(1);
      expect(MODEL_REGISTRY['flux1-schnell.safetensors'].priority).toBe(1);
      expect(MODEL_REGISTRY['flux1-kontext-dev.safetensors'].priority).toBe(1);
      expect(MODEL_REGISTRY['flux1-krea-dev.safetensors'].priority).toBe(1);
    });

    it('should contain GGUF models with correct configuration', () => {
      const ggufModels = Object.entries(MODEL_REGISTRY).filter(([name]) => name.endsWith('.gguf'));
      expect(ggufModels.length).toBeGreaterThan(0);

      ggufModels.forEach(([name, config]) => {
        expect(config.priority).toBeGreaterThanOrEqual(2);
        expect(config.recommendedDtype).toBe('default');
        expect(config.modelFamily).toBe('FLUX');
      });
    });

    it('should contain FP8 models with correct dtype configuration', () => {
      const fp8Models = Object.entries(MODEL_REGISTRY).filter(([name]) =>
        name.includes('fp8-e4m3fn'),
      );
      expect(fp8Models.length).toBeGreaterThan(0);

      fp8Models.forEach(([name, config]) => {
        expect(config.recommendedDtype).toBe('fp8_e4m3fn');
        expect(config.modelFamily).toBe('FLUX');
      });
    });

    it('should contain SD3.5 models', () => {
      expect(MODEL_REGISTRY['sd3.5_large.safetensors']).toBeDefined();
      expect(MODEL_REGISTRY['sd3.5_large.safetensors'].modelFamily).toBe('SD3');
      expect(MODEL_REGISTRY['sd3.5_large.safetensors'].variant).toBe('sd35');
      expect(MODEL_REGISTRY['sd3.5_large.safetensors'].priority).toBe(1);
    });
  });

  describe('getModelsByVariant', () => {
    it('should return models sorted by priority for dev variant', () => {
      const devModels = getModelsByVariant('dev');
      expect(devModels.length).toBeGreaterThan(0);

      // Check that they are sorted by priority (lower numbers first)
      const priorities = devModels.map((model) => MODEL_REGISTRY[model].priority);
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
      }
    });

    it('should return models sorted by priority for schnell variant', () => {
      const schnellModels = getModelsByVariant('schnell');
      expect(schnellModels.length).toBeGreaterThan(0);

      // Check that they are sorted by priority
      const priorities = schnellModels.map((model) => MODEL_REGISTRY[model].priority);
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
      }
    });

    it('should return models for kontext variant', () => {
      const kontextModels = getModelsByVariant('kontext');
      expect(kontextModels.length).toBeGreaterThan(0);
      kontextModels.forEach((modelName) => {
        expect(MODEL_REGISTRY[modelName].variant).toBe('kontext');
      });
    });

    it('should return models for krea variant', () => {
      const kreaModels = getModelsByVariant('krea');
      expect(kreaModels.length).toBeGreaterThan(0);
      kreaModels.forEach((modelName) => {
        expect(MODEL_REGISTRY[modelName].variant).toBe('krea');
      });
    });

    it('should return models for sd35 variant', () => {
      const sd35Models = getModelsByVariant('sd35');
      expect(sd35Models.length).toBeGreaterThan(0);
      sd35Models.forEach((modelName) => {
        expect(MODEL_REGISTRY[modelName].variant).toBe('sd35');
        expect(MODEL_REGISTRY[modelName].modelFamily).toBe('SD3');
      });
    });

    it('should return empty array for non-existent variant', () => {
      const result = getModelsByVariant('non-existent' as any);
      expect(result).toEqual([]);
    });

    it('should handle fill variant', () => {
      const fillModels = getModelsByVariant('fill');
      // May be empty if no fill models exist, but should not throw
      expect(Array.isArray(fillModels)).toBe(true);
    });

    it('should handle redux variant', () => {
      const reduxModels = getModelsByVariant('redux');
      // May be empty if no redux models exist, but should not throw
      expect(Array.isArray(reduxModels)).toBe(true);
    });
  });

  describe('getModelConfig', () => {
    it('should return correct config for known models', () => {
      const config = getModelConfig('flux1-dev.safetensors');
      expect(config).toBeDefined();
      expect(config!.priority).toBe(1);
      expect(config!.variant).toBe('dev');
      expect(config!.modelFamily).toBe('FLUX');
      expect(config!.recommendedDtype).toBe('default');
    });

    it('should return undefined for unknown models', () => {
      const config = getModelConfig('unknown-model.safetensors');
      expect(config).toBeUndefined();
    });

    it('should support case-insensitive search when requested', () => {
      const config = getModelConfig('FLUX1-DEV.SAFETENSORS', { caseInsensitive: true });
      expect(config).toBeDefined();
      expect(config!.variant).toBe('dev');
    });

    it('should return undefined for case-insensitive search when not found', () => {
      const config = getModelConfig('UNKNOWN-MODEL.SAFETENSORS', { caseInsensitive: true });
      expect(config).toBeUndefined();
    });

    it('should filter by variant when specified', () => {
      // Should find the model when variant matches
      const config1 = getModelConfig('flux1-dev.safetensors', { variant: 'dev' });
      expect(config1).toBeDefined();

      // Should not find the model when variant doesn't match
      const config2 = getModelConfig('flux1-dev.safetensors', { variant: 'schnell' });
      expect(config2).toBeUndefined();
    });

    it('should filter by priority when specified', () => {
      // Should find the model when priority matches
      const config1 = getModelConfig('flux1-dev.safetensors', { priority: 1 });
      expect(config1).toBeDefined();

      // Should not find the model when priority doesn't match
      const config2 = getModelConfig('flux1-dev.safetensors', { priority: 2 });
      expect(config2).toBeUndefined();
    });

    it('should filter by modelFamily when specified', () => {
      // Should find the model when modelFamily matches
      const config1 = getModelConfig('flux1-dev.safetensors', { modelFamily: 'FLUX' });
      expect(config1).toBeDefined();

      // Should not find the model when modelFamily doesn't match
      const config2 = getModelConfig('flux1-dev.safetensors', { modelFamily: 'SD1' });
      expect(config2).toBeUndefined();
    });

    it('should filter by recommendedDtype when specified', () => {
      // Should find the model when dtype matches
      const config1 = getModelConfig('flux1-dev.safetensors', { recommendedDtype: 'default' });
      expect(config1).toBeDefined();

      // Should not find the model when dtype doesn't match
      const config2 = getModelConfig('flux1-dev.safetensors', { recommendedDtype: 'fp8_e4m3fn' });
      expect(config2).toBeUndefined();
    });

    it('should apply multiple filters correctly', () => {
      // Should find when all filters match
      const config1 = getModelConfig('flux1-dev.safetensors', {
        variant: 'dev',
        priority: 1,
        modelFamily: 'FLUX',
      });
      expect(config1).toBeDefined();

      // Should not find when one filter doesn't match
      const config2 = getModelConfig('flux1-dev.safetensors', {
        variant: 'dev',
        priority: 2,
        modelFamily: 'FLUX',
      });
      expect(config2).toBeUndefined();
    });

    it('should handle case-insensitive search with filters', () => {
      const config = getModelConfig('FLUX1-DEV.SAFETENSORS', {
        caseInsensitive: true,
        variant: 'dev',
      });
      expect(config).toBeDefined();
      expect(config!.variant).toBe('dev');
    });
  });

  describe('getAllModelNames', () => {
    it('should return all model names from registry', () => {
      const allNames = getAllModelNames();
      const registryKeys = Object.keys(MODEL_REGISTRY);

      expect(allNames).toEqual(registryKeys);
      expect(allNames.length).toBe(registryKeys.length);
    });

    it('should return non-empty array', () => {
      const allNames = getAllModelNames();
      expect(allNames.length).toBeGreaterThan(0);
    });

    it('should include official models', () => {
      const allNames = getAllModelNames();
      expect(allNames).toContain('flux1-dev.safetensors');
      expect(allNames).toContain('flux1-schnell.safetensors');
      expect(allNames).toContain('flux1-kontext-dev.safetensors');
      expect(allNames).toContain('flux1-krea-dev.safetensors');
    });

    it('should include SD3.5 models', () => {
      const allNames = getAllModelNames();
      expect(allNames).toContain('sd3.5_large.safetensors');
    });
  });

  describe('ModelConfig interface validation', () => {
    it('should have valid ModelConfig interface constraints', () => {
      // Test that the interface constraints are working
      const sampleConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };

      expect(sampleConfig.modelFamily).toBe('FLUX');
      expect(sampleConfig.priority).toBe(1);
      expect(sampleConfig.recommendedDtype).toBe('default');
      expect(sampleConfig.variant).toBe('dev');
    });
  });

  describe('Registry data integrity', () => {
    it('should have consistent naming patterns for official GGUF files', () => {
      const officialGgufFiles = Object.keys(MODEL_REGISTRY).filter(
        (name) => name.endsWith('.gguf') && name.startsWith('flux1-'),
      );

      officialGgufFiles.forEach((fileName) => {
        expect(fileName).toMatch(/^flux1-(dev|schnell|kontext-dev|krea-dev)-.*\.gguf$/);
      });

      // Should have official GGUF files
      expect(officialGgufFiles.length).toBeGreaterThan(0);
    });

    it('should have consistent priority groupings', () => {
      const priority1Models = Object.values(MODEL_REGISTRY).filter(
        (config) => config.priority === 1,
      );
      const priority2Models = Object.values(MODEL_REGISTRY).filter(
        (config) => config.priority === 2,
      );
      const priority3Models = Object.values(MODEL_REGISTRY).filter(
        (config) => config.priority === 3,
      );

      // Should have models in each priority group
      expect(priority1Models.length).toBeGreaterThan(0);
      expect(priority2Models.length).toBeGreaterThan(0);
      expect(priority3Models.length).toBeGreaterThan(0);

      // Priority 1 should be official models
      expect(priority1Models.length).toBe(7); // Actual count based on current registry
    });

    it('should have valid file extensions', () => {
      const validExtensions = ['.safetensors', '.gguf'];

      Object.keys(MODEL_REGISTRY).forEach((fileName) => {
        const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));
        expect(hasValidExtension).toBe(true);
      });
    });

    it('should have FP8 models with correct dtype configuration', () => {
      const fp8E4M3FNModels = Object.entries(MODEL_REGISTRY).filter(
        ([name, config]) => config.recommendedDtype === 'fp8_e4m3fn',
      );
      const fp8E5M2Models = Object.entries(MODEL_REGISTRY).filter(
        ([name, config]) => config.recommendedDtype === 'fp8_e5m2',
      );

      expect(fp8E4M3FNModels.length).toBeGreaterThan(0);
      expect(fp8E5M2Models.length).toBeGreaterThan(0);

      // Check naming patterns (allow flexible naming for community models)
      fp8E4M3FNModels.forEach(([name]) => {
        expect(name).toMatch(/fp8[-_]e4m3fn|fp8/i);
      });

      fp8E5M2Models.forEach(([name]) => {
        expect(name).toMatch(/fp8-e5m2|fp8_e5m2/);
      });
    });
  });
});
