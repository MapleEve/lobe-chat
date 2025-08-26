import { describe, expect, it } from 'vitest';

import {
  type ComponentConfig,
  SYSTEM_COMPONENTS,
  getAllComponentConfigs,
  getAllComponentsWithNames,
  getComponentConfig,
  getOptimalComponent,
} from './systemComponents';

describe('SystemComponents', () => {
  describe('SYSTEM_COMPONENTS', () => {
    it('should be a non-empty object', () => {
      expect(typeof SYSTEM_COMPONENTS).toBe('object');
      expect(Object.keys(SYSTEM_COMPONENTS).length).toBeGreaterThan(0);
    });

    it('should contain expected essential components', () => {
      expect(SYSTEM_COMPONENTS['ae.safetensors']).toBeDefined();
      expect(SYSTEM_COMPONENTS['clip_l.safetensors']).toBeDefined();
      expect(SYSTEM_COMPONENTS['t5xxl_fp16.safetensors']).toBeDefined();
    });

    it('should contain expected optional components', () => {
      expect(SYSTEM_COMPONENTS['t5xxl_fp8_e4m3fn.safetensors']).toBeDefined();
      expect(SYSTEM_COMPONENTS['t5xxl_fp8_e5m2.safetensors']).toBeDefined();
      expect(SYSTEM_COMPONENTS['google_t5-v1_1-xxl_encoderonly-fp16.safetensors']).toBeDefined();
    });

    it('should have valid config structure for all components', () => {
      Object.entries(SYSTEM_COMPONENTS).forEach(([componentName, config]) => {
        expect(config).toHaveProperty('modelFamily');
        expect(config).toHaveProperty('priority');
        expect(config).toHaveProperty('type');

        // ModelFamily should be FLUX
        expect(config.modelFamily).toBe('FLUX');

        // Priority should be a positive number
        expect(typeof config.priority).toBe('number');
        expect(config.priority).toBeGreaterThan(0);

        // Type should be one of the allowed values
        expect(['vae', 'clip', 't5']).toContain(config.type);
      });
    });

    it('should have correct priority levels', () => {
      // Essential components should have priority 1
      expect(SYSTEM_COMPONENTS['ae.safetensors'].priority).toBe(1);
      expect(SYSTEM_COMPONENTS['clip_l.safetensors'].priority).toBe(1);
      expect(SYSTEM_COMPONENTS['t5xxl_fp16.safetensors'].priority).toBe(1);

      // Optional components should have priority 2 or 3
      expect(SYSTEM_COMPONENTS['t5xxl_fp8_e4m3fn.safetensors'].priority).toBe(2);
      expect(SYSTEM_COMPONENTS['t5xxl_fp8_e5m2.safetensors'].priority).toBe(2);
      expect(SYSTEM_COMPONENTS['google_t5-v1_1-xxl_encoderonly-fp16.safetensors'].priority).toBe(3);
    });

    it('should have correct component types', () => {
      expect(SYSTEM_COMPONENTS['ae.safetensors'].type).toBe('vae');
      expect(SYSTEM_COMPONENTS['clip_l.safetensors'].type).toBe('clip');
      expect(SYSTEM_COMPONENTS['t5xxl_fp16.safetensors'].type).toBe('t5');
      expect(SYSTEM_COMPONENTS['t5xxl_fp8_e4m3fn.safetensors'].type).toBe('t5');
      expect(SYSTEM_COMPONENTS['t5xxl_fp8_e5m2.safetensors'].type).toBe('t5');
      expect(SYSTEM_COMPONENTS['google_t5-v1_1-xxl_encoderonly-fp16.safetensors'].type).toBe('t5');
    });

    it('should contain at least one component of each type', () => {
      const configs = Object.values(SYSTEM_COMPONENTS);
      const types = configs.map((config) => config.type);

      expect(types).toContain('vae');
      expect(types).toContain('clip');
      expect(types).toContain('t5');
    });

    it('should have exactly 6 components', () => {
      expect(Object.keys(SYSTEM_COMPONENTS).length).toBe(6);
    });
  });

  describe('getComponentConfig', () => {
    it('should return correct config for known components', () => {
      const config = getComponentConfig('ae.safetensors');
      expect(config).toBeDefined();
      expect(config!.priority).toBe(1);
      expect(config!.type).toBe('vae');
      expect(config!.modelFamily).toBe('FLUX');
    });

    it('should return undefined for unknown components', () => {
      const config = getComponentConfig('unknown-component.safetensors');
      expect(config).toBeUndefined();
    });

    it('should filter by type when specified', () => {
      // Should find the component when type matches
      const config1 = getComponentConfig('ae.safetensors', { type: 'vae' });
      expect(config1).toBeDefined();

      // Should not find the component when type doesn't match
      const config2 = getComponentConfig('ae.safetensors', { type: 'clip' });
      expect(config2).toBeUndefined();
    });

    it('should filter by priority when specified', () => {
      // Should find the component when priority matches
      const config1 = getComponentConfig('ae.safetensors', { priority: 1 });
      expect(config1).toBeDefined();

      // Should not find the component when priority doesn't match
      const config2 = getComponentConfig('ae.safetensors', { priority: 2 });
      expect(config2).toBeUndefined();
    });

    it('should filter by modelFamily when specified', () => {
      // Should find the component when modelFamily matches
      const config1 = getComponentConfig('ae.safetensors', { modelFamily: 'FLUX' });
      expect(config1).toBeDefined();

      // Should not find the component when modelFamily doesn't match (though only FLUX exists)
      const config2 = getComponentConfig('ae.safetensors', { modelFamily: 'FLUX' });
      expect(config2).toBeDefined(); // All components are FLUX
    });

    it('should apply multiple filters correctly', () => {
      // Should find when all filters match
      const config1 = getComponentConfig('ae.safetensors', {
        type: 'vae',
        priority: 1,
        modelFamily: 'FLUX',
      });
      expect(config1).toBeDefined();

      // Should not find when one filter doesn't match
      const config2 = getComponentConfig('ae.safetensors', {
        type: 'vae',
        priority: 2,
        modelFamily: 'FLUX',
      });
      expect(config2).toBeUndefined();
    });

    it('should return config without options parameter', () => {
      const config = getComponentConfig('clip_l.safetensors');
      expect(config).toBeDefined();
      expect(config!.type).toBe('clip');
    });
  });

  describe('getAllComponentConfigs', () => {
    it('should return all components when no options provided', () => {
      const allConfigs = getAllComponentConfigs();
      expect(allConfigs.length).toBe(Object.keys(SYSTEM_COMPONENTS).length);
      expect(allConfigs.length).toBe(6);
    });

    it('should filter by type correctly', () => {
      const vaeConfigs = getAllComponentConfigs({ type: 'vae' });
      expect(vaeConfigs.length).toBe(1);
      vaeConfigs.forEach((config) => {
        expect(config.type).toBe('vae');
      });

      const t5Configs = getAllComponentConfigs({ type: 't5' });
      expect(t5Configs.length).toBe(4); // 4 t5 components
      t5Configs.forEach((config) => {
        expect(config.type).toBe('t5');
      });

      const clipConfigs = getAllComponentConfigs({ type: 'clip' });
      expect(clipConfigs.length).toBe(1);
      clipConfigs.forEach((config) => {
        expect(config.type).toBe('clip');
      });
    });

    it('should filter by priority correctly', () => {
      const priority1Configs = getAllComponentConfigs({ priority: 1 });
      expect(priority1Configs.length).toBe(3); // 3 priority 1 components
      priority1Configs.forEach((config) => {
        expect(config.priority).toBe(1);
      });

      const priority2Configs = getAllComponentConfigs({ priority: 2 });
      expect(priority2Configs.length).toBe(2); // 2 priority 2 components
      priority2Configs.forEach((config) => {
        expect(config.priority).toBe(2);
      });

      const priority3Configs = getAllComponentConfigs({ priority: 3 });
      expect(priority3Configs.length).toBe(1); // 1 priority 3 component
      priority3Configs.forEach((config) => {
        expect(config.priority).toBe(3);
      });
    });

    it('should filter by modelFamily correctly', () => {
      const fluxConfigs = getAllComponentConfigs({ modelFamily: 'FLUX' });
      expect(fluxConfigs.length).toBe(6); // All components are FLUX
      fluxConfigs.forEach((config) => {
        expect(config.modelFamily).toBe('FLUX');
      });
    });

    it('should apply multiple filters correctly', () => {
      const filteredConfigs = getAllComponentConfigs({
        type: 't5',
        priority: 2,
      });
      expect(filteredConfigs.length).toBe(2); // 2 t5 components with priority 2
      filteredConfigs.forEach((config) => {
        expect(config.type).toBe('t5');
        expect(config.priority).toBe(2);
      });
    });

    it('should return empty array for non-matching filters', () => {
      const result = getAllComponentConfigs({ priority: 99 });
      expect(result).toEqual([]);
    });
  });

  describe('getAllComponentsWithNames', () => {
    it('should return all components with names when no options provided', () => {
      const allWithNames = getAllComponentsWithNames();
      expect(allWithNames.length).toBe(6);

      allWithNames.forEach((item) => {
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('config');
        expect(typeof item.name).toBe('string');
        expect(item.config).toHaveProperty('modelFamily');
        expect(item.config).toHaveProperty('priority');
        expect(item.config).toHaveProperty('type');
      });
    });

    it('should filter by type correctly', () => {
      const vaeWithNames = getAllComponentsWithNames({ type: 'vae' });
      expect(vaeWithNames.length).toBe(1);
      expect(vaeWithNames[0].name).toBe('ae.safetensors');
      expect(vaeWithNames[0].config.type).toBe('vae');
    });

    it('should filter by priority correctly', () => {
      const priority1WithNames = getAllComponentsWithNames({ priority: 1 });
      expect(priority1WithNames.length).toBe(3);

      const names = priority1WithNames.map((item) => item.name);
      expect(names).toContain('ae.safetensors');
      expect(names).toContain('clip_l.safetensors');
      expect(names).toContain('t5xxl_fp16.safetensors');
    });

    it('should apply multiple filters correctly', () => {
      const filteredWithNames = getAllComponentsWithNames({
        type: 't5',
        priority: 1,
      });
      expect(filteredWithNames.length).toBe(1);
      expect(filteredWithNames[0].name).toBe('t5xxl_fp16.safetensors');
      expect(filteredWithNames[0].config.type).toBe('t5');
      expect(filteredWithNames[0].config.priority).toBe(1);
    });

    it('should return empty array for non-matching filters', () => {
      const result = getAllComponentsWithNames({ type: 'vae', priority: 3 });
      expect(result).toEqual([]);
    });
  });

  describe('getOptimalComponent', () => {
    it('should return optimal vae component', () => {
      const optimal = getOptimalComponent('vae');
      expect(optimal).toBe('ae.safetensors');
    });

    it('should return optimal clip component', () => {
      const optimal = getOptimalComponent('clip');
      expect(optimal).toBe('clip_l.safetensors');
    });

    it('should return optimal t5 component (lowest priority)', () => {
      const optimal = getOptimalComponent('t5');
      expect(optimal).toBe('t5xxl_fp16.safetensors'); // Priority 1, should be first
    });

    it('should throw error for non-existent component type', () => {
      expect(() => {
        getOptimalComponent('nonexistent' as any);
      }).toThrow();
    });

    it('should return components sorted by priority', () => {
      // Test that t5 returns the priority 1 component, not priority 2 or 3
      const optimal = getOptimalComponent('t5');
      const config = getComponentConfig(optimal);
      expect(config!.priority).toBe(1);
    });
  });

  describe('ComponentConfig interface validation', () => {
    it('should have valid ComponentConfig interface constraints', () => {
      // Test that the interface constraints are working
      const sampleConfig: ComponentConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        type: 'vae',
      };

      expect(sampleConfig.modelFamily).toBe('FLUX');
      expect(sampleConfig.priority).toBe(1);
      expect(sampleConfig.type).toBe('vae');
    });
  });

  describe('Registry data integrity', () => {
    it('should have consistent naming patterns', () => {
      const componentNames = Object.keys(SYSTEM_COMPONENTS);

      componentNames.forEach((name) => {
        expect(name).toMatch(/\.safetensors$/);
      });
    });

    it('should have consistent priority distribution', () => {
      const priority1Components = Object.values(SYSTEM_COMPONENTS).filter(
        (config) => config.priority === 1,
      );
      const priority2Components = Object.values(SYSTEM_COMPONENTS).filter(
        (config) => config.priority === 2,
      );
      const priority3Components = Object.values(SYSTEM_COMPONENTS).filter(
        (config) => config.priority === 3,
      );

      // Should have components in each priority group
      expect(priority1Components.length).toBe(3);
      expect(priority2Components.length).toBe(2);
      expect(priority3Components.length).toBe(1);
    });

    it('should have at least one component for each essential type', () => {
      const configs = Object.values(SYSTEM_COMPONENTS);
      const hasVAE = configs.some((config) => config.type === 'vae');
      const hasCLIP = configs.some((config) => config.type === 'clip');
      const hasT5 = configs.some((config) => config.type === 't5');

      expect(hasVAE).toBe(true);
      expect(hasCLIP).toBe(true);
      expect(hasT5).toBe(true);
    });

    it('should have exactly one VAE and one CLIP component', () => {
      const configs = Object.values(SYSTEM_COMPONENTS);
      const vaeCount = configs.filter((config) => config.type === 'vae').length;
      const clipCount = configs.filter((config) => config.type === 'clip').length;

      expect(vaeCount).toBe(1);
      expect(clipCount).toBe(1);
    });

    it('should have multiple T5 encoder options', () => {
      const configs = Object.values(SYSTEM_COMPONENTS);
      const t5Count = configs.filter((config) => config.type === 't5').length;

      expect(t5Count).toBeGreaterThan(1);
      expect(t5Count).toBe(4);
    });
  });

  describe('getAllComponentsWithNames with modelFamily filter', () => {
    it('should filter components by modelFamily', () => {
      // This test covers line 121 in systemComponents.ts - the modelFamily filter condition
      const fluxComponents = getAllComponentsWithNames({ modelFamily: 'FLUX' });
      const nonExistentComponents = getAllComponentsWithNames({
        modelFamily: 'NON_EXISTENT' as any,
      });
      const allComponents = getAllComponentsWithNames();

      // All returned components should have the specified modelFamily
      fluxComponents.forEach(({ config }) => {
        expect(config.modelFamily).toBe('FLUX');
      });

      // FLUX components should exist (since all system components are FLUX)
      expect(fluxComponents.length).toBeGreaterThan(0);

      // Non-existent model family should return empty array
      expect(nonExistentComponents.length).toBe(0);

      // All components should equal FLUX components (since all are FLUX)
      expect(allComponents.length).toBe(fluxComponents.length);
    });

    it('should return empty array for non-existent modelFamily', () => {
      const result = getAllComponentsWithNames({ modelFamily: 'NON_EXISTENT' as any });
      expect(result).toEqual([]);
    });

    it('should combine modelFamily filter with other filters', () => {
      // Test combining modelFamily with type filter
      const fluxClipComponents = getAllComponentsWithNames({
        modelFamily: 'FLUX',
        type: 'clip',
      });

      fluxClipComponents.forEach(({ config }) => {
        expect(config.modelFamily).toBe('FLUX');
        expect(config.type).toBe('clip');
      });
    });
  });
});
