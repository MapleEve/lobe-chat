import { describe, expect, it } from 'vitest';

import {
  CONTROLNET_REGISTRY,
  type ControlNetConfig,
  getAllControlNetConfigs,
  getControlNetConfig,
} from './controlnetRegistry';

describe('ControlnetRegistry', () => {
  describe('CONTROLNET_REGISTRY', () => {
    it('should be a non-empty object', () => {
      expect(typeof CONTROLNET_REGISTRY).toBe('object');
      expect(Object.keys(CONTROLNET_REGISTRY).length).toBeGreaterThan(0);
    });

    it('should contain expected XLabs-AI official ControlNet models', () => {
      expect(CONTROLNET_REGISTRY['flux-controlnet-canny-v3.safetensors']).toBeDefined();
      expect(CONTROLNET_REGISTRY['flux-controlnet-depth-v3.safetensors']).toBeDefined();
      expect(CONTROLNET_REGISTRY['flux-controlnet-hed-v3.safetensors']).toBeDefined();
    });

    it('should have valid config structure for all ControlNets', () => {
      Object.entries(CONTROLNET_REGISTRY).forEach(([controlnetName, config]) => {
        expect(config).toHaveProperty('compatibleVariants');
        expect(config).toHaveProperty('modelFamily');
        expect(config).toHaveProperty('priority');
        expect(config).toHaveProperty('type');

        // Compatible variants should be an array
        expect(Array.isArray(config.compatibleVariants)).toBe(true);
        expect(config.compatibleVariants.length).toBeGreaterThan(0);

        // ModelFamily should be FLUX
        expect(config.modelFamily).toBe('FLUX');

        // Priority should be a positive number
        expect(typeof config.priority).toBe('number');
        expect(config.priority).toBeGreaterThan(0);

        // Type should be one of the allowed values
        expect(['canny', 'depth', 'hed', 'pose', 'scribble', 'normal', 'semantic']).toContain(
          config.type,
        );
      });
    });

    it('should have priority 1 for XLabs-AI official models', () => {
      expect(CONTROLNET_REGISTRY['flux-controlnet-canny-v3.safetensors'].priority).toBe(1);
      expect(CONTROLNET_REGISTRY['flux-controlnet-depth-v3.safetensors'].priority).toBe(1);
      expect(CONTROLNET_REGISTRY['flux-controlnet-hed-v3.safetensors'].priority).toBe(1);
    });

    it('should have correct ControlNet types', () => {
      expect(CONTROLNET_REGISTRY['flux-controlnet-canny-v3.safetensors'].type).toBe('canny');
      expect(CONTROLNET_REGISTRY['flux-controlnet-depth-v3.safetensors'].type).toBe('depth');
      expect(CONTROLNET_REGISTRY['flux-controlnet-hed-v3.safetensors'].type).toBe('hed');
    });

    it('should have dev compatibility for all official models', () => {
      Object.values(CONTROLNET_REGISTRY).forEach((config) => {
        expect(config.compatibleVariants).toContain('dev');
      });
    });

    it('should contain exactly 3 ControlNet models', () => {
      expect(Object.keys(CONTROLNET_REGISTRY).length).toBe(3);
    });

    it('should have consistent naming patterns', () => {
      const controlnetNames = Object.keys(CONTROLNET_REGISTRY);

      controlnetNames.forEach((name) => {
        expect(name).toMatch(/^flux-controlnet-.*-v3\.safetensors$/);
      });
    });
  });

  describe('getControlNetConfig', () => {
    it('should return correct config for known ControlNets', () => {
      const config = getControlNetConfig('flux-controlnet-canny-v3.safetensors');
      expect(config).toBeDefined();
      expect(config!.priority).toBe(1);
      expect(config!.type).toBe('canny');
      expect(config!.modelFamily).toBe('FLUX');
      expect(config!.compatibleVariants).toContain('dev');
    });

    it('should return undefined for unknown ControlNets', () => {
      const config = getControlNetConfig('unknown-controlnet.safetensors');
      expect(config).toBeUndefined();
    });

    it('should filter by type when specified', () => {
      // Should find the ControlNet when type matches
      const config1 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', {
        type: 'canny',
      });
      expect(config1).toBeDefined();

      // Should not find the ControlNet when type doesn't match
      const config2 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', {
        type: 'depth',
      });
      expect(config2).toBeUndefined();
    });

    it('should filter by priority when specified', () => {
      // Should find the ControlNet when priority matches
      const config1 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', { priority: 1 });
      expect(config1).toBeDefined();

      // Should not find the ControlNet when priority doesn't match
      const config2 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', { priority: 2 });
      expect(config2).toBeUndefined();
    });

    it('should filter by modelFamily when specified', () => {
      // Should find the ControlNet when modelFamily matches
      const config1 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', {
        modelFamily: 'FLUX',
      });
      expect(config1).toBeDefined();

      // All models are FLUX, so this test just ensures filtering works
      const config2 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', {
        modelFamily: 'FLUX',
      });
      expect(config2).toBeDefined();
    });

    it('should filter by compatibleVariant when specified', () => {
      // Should find the ControlNet when compatibleVariant matches
      const config1 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', {
        compatibleVariant: 'dev',
      });
      expect(config1).toBeDefined();

      // Should not find the ControlNet when compatibleVariant doesn't match
      const config2 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', {
        compatibleVariant: 'schnell',
      });
      expect(config2).toBeUndefined();
    });

    it('should apply multiple filters correctly', () => {
      // Should find when all filters match
      const config1 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', {
        type: 'canny',
        priority: 1,
        modelFamily: 'FLUX',
        compatibleVariant: 'dev',
      });
      expect(config1).toBeDefined();

      // Should not find when one filter doesn't match
      const config2 = getControlNetConfig('flux-controlnet-canny-v3.safetensors', {
        type: 'canny',
        priority: 2,
        modelFamily: 'FLUX',
        compatibleVariant: 'dev',
      });
      expect(config2).toBeUndefined();
    });

    it('should return config without options parameter', () => {
      const config = getControlNetConfig('flux-controlnet-depth-v3.safetensors');
      expect(config).toBeDefined();
      expect(config!.type).toBe('depth');
    });
  });

  describe('getAllControlNetConfigs', () => {
    it('should return all ControlNets when no options provided', () => {
      const allConfigs = getAllControlNetConfigs();
      expect(allConfigs.length).toBe(Object.keys(CONTROLNET_REGISTRY).length);
      expect(allConfigs.length).toBe(3);
    });

    it('should filter by type correctly', () => {
      const cannyConfigs = getAllControlNetConfigs({ type: 'canny' });
      expect(cannyConfigs.length).toBe(1);
      cannyConfigs.forEach((config) => {
        expect(config.type).toBe('canny');
      });

      const depthConfigs = getAllControlNetConfigs({ type: 'depth' });
      expect(depthConfigs.length).toBe(1);
      depthConfigs.forEach((config) => {
        expect(config.type).toBe('depth');
      });

      const hedConfigs = getAllControlNetConfigs({ type: 'hed' });
      expect(hedConfigs.length).toBe(1);
      hedConfigs.forEach((config) => {
        expect(config.type).toBe('hed');
      });
    });

    it('should filter by priority correctly', () => {
      const priority1Configs = getAllControlNetConfigs({ priority: 1 });
      expect(priority1Configs.length).toBe(3); // All are priority 1
      priority1Configs.forEach((config) => {
        expect(config.priority).toBe(1);
      });

      const priority2Configs = getAllControlNetConfigs({ priority: 2 });
      expect(priority2Configs.length).toBe(0); // None are priority 2
    });

    it('should filter by modelFamily correctly', () => {
      const fluxConfigs = getAllControlNetConfigs({ modelFamily: 'FLUX' });
      expect(fluxConfigs.length).toBe(3); // All are FLUX
      fluxConfigs.forEach((config) => {
        expect(config.modelFamily).toBe('FLUX');
      });
    });

    it('should filter by compatibleVariant correctly', () => {
      const devConfigs = getAllControlNetConfigs({ compatibleVariant: 'dev' });
      expect(devConfigs.length).toBe(3); // All are compatible with dev
      devConfigs.forEach((config) => {
        expect(config.compatibleVariants).toContain('dev');
      });

      const schnellConfigs = getAllControlNetConfigs({ compatibleVariant: 'schnell' });
      expect(schnellConfigs.length).toBe(0); // None are compatible with schnell
    });

    it('should apply multiple filters correctly', () => {
      const filteredConfigs = getAllControlNetConfigs({
        type: 'canny',
        priority: 1,
        compatibleVariant: 'dev',
      });
      expect(filteredConfigs.length).toBe(1);
      filteredConfigs.forEach((config) => {
        expect(config.type).toBe('canny');
        expect(config.priority).toBe(1);
        expect(config.compatibleVariants).toContain('dev');
      });
    });

    it('should return empty array for non-matching filters', () => {
      const result = getAllControlNetConfigs({ priority: 99 });
      expect(result).toEqual([]);
    });

    it('should return empty array for non-existent type', () => {
      const result = getAllControlNetConfigs({ type: 'pose' });
      expect(result).toEqual([]);
    });
  });

  describe('ControlNetConfig interface validation', () => {
    it('should have valid ControlNetConfig interface constraints', () => {
      // Test that the interface constraints are working
      const sampleConfig: ControlNetConfig = {
        compatibleVariants: ['dev'],
        modelFamily: 'FLUX',
        priority: 1,
        type: 'canny',
      };

      expect(sampleConfig.compatibleVariants).toEqual(['dev']);
      expect(sampleConfig.modelFamily).toBe('FLUX');
      expect(sampleConfig.priority).toBe(1);
      expect(sampleConfig.type).toBe('canny');
    });
  });

  describe('Registry data integrity', () => {
    it('should have consistent priority groupings', () => {
      const priority1Models = Object.values(CONTROLNET_REGISTRY).filter(
        (config) => config.priority === 1,
      );

      // Should have models in priority 1 group (Official XLabs-AI)
      expect(priority1Models.length).toBe(3);
    });

    it('should have valid file extensions', () => {
      const validExtensions = ['.safetensors'];

      Object.keys(CONTROLNET_REGISTRY).forEach((fileName) => {
        const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));
        expect(hasValidExtension).toBe(true);
      });
    });

    it('should have unique ControlNet types', () => {
      const types = Object.values(CONTROLNET_REGISTRY).map((config) => config.type);
      const uniqueTypes = [...new Set(types)];

      expect(types.length).toBe(uniqueTypes.length); // No duplicate types
      expect(uniqueTypes.sort()).toEqual(['canny', 'depth', 'hed']);
    });

    it('should have consistent variant compatibility', () => {
      // All current ControlNets should be compatible with dev variant
      Object.values(CONTROLNET_REGISTRY).forEach((config) => {
        expect(config.compatibleVariants).toContain('dev');
      });
    });

    it('should have valid variant values', () => {
      const validVariants = ['dev', 'schnell', 'kontext', 'krea'];

      Object.values(CONTROLNET_REGISTRY).forEach((config) => {
        config.compatibleVariants.forEach((variant) => {
          expect(validVariants).toContain(variant);
        });
      });
    });
  });
});
