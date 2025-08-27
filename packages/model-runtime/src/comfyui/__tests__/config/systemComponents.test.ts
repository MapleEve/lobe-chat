import { describe, expect, it } from 'vitest';

import {
  SYSTEM_COMPONENTS,
  getAllComponentConfigs,
  getAllComponentsWithNames,
  getComponentConfig,
  getOptimalComponent,
} from '../../config/systemComponents';

describe('SystemComponents', () => {
  describe('SYSTEM_COMPONENTS', () => {
    it('should be a non-empty object with valid structure', () => {
      expect(typeof SYSTEM_COMPONENTS).toBe('object');
      expect(Object.keys(SYSTEM_COMPONENTS).length).toBeGreaterThan(0);

      // Check that all components have required fields
      Object.entries(SYSTEM_COMPONENTS).forEach(([_name, config]) => {
        expect(config).toBeDefined();
        expect(config.type).toBeDefined();
        expect(config.priority).toBeTypeOf('number');
        expect(config.modelFamily).toBeDefined();
      });
    });

    it('should contain essential component types', () => {
      const types = Object.values(SYSTEM_COMPONENTS).map((c) => c.type);
      const uniqueTypes = [...new Set(types)];

      expect(uniqueTypes).toContain('vae');
      expect(uniqueTypes).toContain('clip');
      expect(uniqueTypes).toContain('t5');
    });
  });

  describe('getComponentConfig', () => {
    it('should return component config for valid name', () => {
      const config = getComponentConfig('ae.safetensors');
      expect(config).toBeDefined();
      expect(config?.type).toBe('vae');
    });

    it('should return undefined for invalid name', () => {
      const config = getComponentConfig('nonexistent.safetensors');
      expect(config).toBeUndefined();
    });
  });

  describe('getAllComponentConfigs', () => {
    it('should return all configs for valid type', () => {
      const configs = getAllComponentConfigs({ type: 'vae' });
      expect(configs.length).toBeGreaterThan(0);
      configs.forEach((config) => {
        expect(config.type).toBe('vae');
      });
    });
  });

  describe('getAllComponentsWithNames', () => {
    it('should return components with names for valid type', () => {
      const result = getAllComponentsWithNames({ type: 'vae' });
      expect(result.length).toBeGreaterThan(0);
      result.forEach(({ config }) => {
        expect(name).toBeTypeOf('string');
        expect(config.type).toBe('vae');
      });
    });

    it('should filter by modelFamily when specified', () => {
      const result = getAllComponentsWithNames({ modelFamily: 'FLUX', type: 'vae' });
      expect(result.length).toBeGreaterThan(0);
      result.forEach(({ config }) => {
        expect(config.modelFamily).toBe('FLUX');
      });
    });
  });

  describe('getOptimalComponent', () => {
    it('should return component with highest priority for type', () => {
      const component = getOptimalComponent('vae', 'FLUX');
      expect(component).toBeDefined();
    });
  });
});