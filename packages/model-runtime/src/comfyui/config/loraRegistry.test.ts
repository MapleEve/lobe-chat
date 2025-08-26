import { describe, expect, it } from 'vitest';

import { LORA_REGISTRY, type LoRAConfig, getAllLoRAConfigs, getLoRAConfig } from './loraRegistry';

describe('LoraRegistry', () => {
  describe('LORA_REGISTRY', () => {
    it('should be a non-empty object', () => {
      expect(typeof LORA_REGISTRY).toBe('object');
      expect(Object.keys(LORA_REGISTRY).length).toBeGreaterThan(0);
    });

    it('should contain expected XLabs-AI official LoRA models', () => {
      expect(LORA_REGISTRY['realism_lora.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['anime_lora.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['disney_lora.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['scenery_lora.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['art_lora.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['mjv6_lora.safetensors']).toBeDefined();
    });

    it('should contain expected RFC-128 expanded LoRA models', () => {
      expect(LORA_REGISTRY['flux-realism-lora.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['flux-lora-collection-8-styles.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['disney-anime-art-lora.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['flux-kodak-grain-lora.safetensors']).toBeDefined();
    });

    it('should contain expected community and experimental models', () => {
      expect(LORA_REGISTRY['watercolor_painting_schnell_lora.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['juggernaut_lora_flux.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['chinese-style-flux-lora-collection.safetensors']).toBeDefined();
      expect(LORA_REGISTRY['flux-medical-environment-lora.safetensors']).toBeDefined();
    });

    it('should have valid config structure for all LoRAs', () => {
      Object.entries(LORA_REGISTRY).forEach(([loraName, config]) => {
        expect(config).toHaveProperty('compatibleVariants');
        expect(config).toHaveProperty('modelFamily');
        expect(config).toHaveProperty('priority');

        // Compatible variants should be an array
        expect(Array.isArray(config.compatibleVariants)).toBe(true);
        expect(config.compatibleVariants.length).toBeGreaterThan(0);

        // ModelFamily should be FLUX
        expect(config.modelFamily).toBe('FLUX');

        // Priority should be a positive number
        expect(typeof config.priority).toBe('number');
        expect(config.priority).toBeGreaterThan(0);
        expect(config.priority).toBeLessThanOrEqual(3);
      });
    });

    it('should have priority 1 for XLabs-AI official models', () => {
      const officialModels = [
        'realism_lora.safetensors',
        'anime_lora.safetensors',
        'disney_lora.safetensors',
        'scenery_lora.safetensors',
        'art_lora.safetensors',
        'mjv6_lora.safetensors',
        'flux-realism-lora.safetensors',
        'flux-lora-collection-8-styles.safetensors',
        'disney-anime-art-lora.safetensors',
      ];

      officialModels.forEach((modelName) => {
        expect(LORA_REGISTRY[modelName].priority).toBe(1);
      });
    });

    it('should have priority 2 for professional community models', () => {
      const professionalModels = [
        'flux-kodak-grain-lora.safetensors',
        'flux-first-person-selfie-lora.safetensors',
        'flux-anime-rainbow-light-lora.safetensors',
        'flux-detailer-enhancement-lora.safetensors',
        'Envy_Flux_Reanimated_lora.safetensors',
        'Photon_Construct_Flux_V1_0_lora.safetensors',
        'flux-ultimate-lora-collection.safetensors',
        'artaug-flux-enhancement-lora.safetensors',
        'flux-canny-dev-lora.safetensors',
      ];

      professionalModels.forEach((modelName) => {
        expect(LORA_REGISTRY[modelName].priority).toBe(2);
      });
    });

    it('should have priority 3 for community and experimental models', () => {
      const communityModels = [
        'watercolor_painting_schnell_lora.safetensors',
        'juggernaut_lora_flux.safetensors',
        'chinese-style-flux-lora-collection.safetensors',
        'flux-medical-environment-lora.safetensors',
        'flux-fill-object-removal.safetensors',
      ];

      communityModels.forEach((modelName) => {
        expect(LORA_REGISTRY[modelName].priority).toBe(3);
      });
    });

    it('should have appropriate variant compatibility', () => {
      // Most models should be compatible with dev
      const devCompatibleCount = Object.values(LORA_REGISTRY).filter((config) =>
        config.compatibleVariants.includes('dev'),
      ).length;
      expect(devCompatibleCount).toBeGreaterThan(15);

      // Some models should be compatible with schnell
      const schnellCompatibleCount = Object.values(LORA_REGISTRY).filter((config) =>
        config.compatibleVariants.includes('schnell'),
      ).length;
      expect(schnellCompatibleCount).toBeGreaterThan(0);

      // Some models should be compatible with kontext
      const kontextCompatibleCount = Object.values(LORA_REGISTRY).filter((config) =>
        config.compatibleVariants.includes('kontext'),
      ).length;
      expect(kontextCompatibleCount).toBeGreaterThan(0);
    });

    it('should contain exactly 23 LoRA models', () => {
      expect(Object.keys(LORA_REGISTRY).length).toBe(23);
    });

    it('should have consistent naming patterns', () => {
      const loraNames = Object.keys(LORA_REGISTRY);

      loraNames.forEach((name) => {
        expect(name).toMatch(/\.safetensors$/);
      });
    });
  });

  describe('getLoRAConfig', () => {
    it('should return correct config for known LoRAs', () => {
      const config = getLoRAConfig('realism_lora.safetensors');
      expect(config).toBeDefined();
      expect(config!.priority).toBe(1);
      expect(config!.modelFamily).toBe('FLUX');
      expect(config!.compatibleVariants).toContain('dev');
    });

    it('should return undefined for unknown LoRAs', () => {
      const config = getLoRAConfig('unknown-lora.safetensors');
      expect(config).toBeUndefined();
    });

    it('should filter by priority when specified', () => {
      // Should find the LoRA when priority matches
      const config1 = getLoRAConfig('realism_lora.safetensors', { priority: 1 });
      expect(config1).toBeDefined();

      // Should not find the LoRA when priority doesn't match
      const config2 = getLoRAConfig('realism_lora.safetensors', { priority: 2 });
      expect(config2).toBeUndefined();
    });

    it('should filter by modelFamily when specified', () => {
      // Should find the LoRA when modelFamily matches
      const config1 = getLoRAConfig('realism_lora.safetensors', { modelFamily: 'FLUX' });
      expect(config1).toBeDefined();

      // All models are FLUX, so this test just ensures filtering works
      const config2 = getLoRAConfig('realism_lora.safetensors', { modelFamily: 'FLUX' });
      expect(config2).toBeDefined();
    });

    it('should filter by compatibleVariant when specified', () => {
      // Should find the LoRA when compatibleVariant matches
      const config1 = getLoRAConfig('realism_lora.safetensors', { compatibleVariant: 'dev' });
      expect(config1).toBeDefined();

      // Should not find the LoRA when compatibleVariant doesn't match
      const config2 = getLoRAConfig('realism_lora.safetensors', { compatibleVariant: 'schnell' });
      expect(config2).toBeUndefined();
    });

    it('should apply multiple filters correctly', () => {
      // Should find when all filters match
      const config1 = getLoRAConfig('realism_lora.safetensors', {
        priority: 1,
        modelFamily: 'FLUX',
        compatibleVariant: 'dev',
      });
      expect(config1).toBeDefined();

      // Should not find when one filter doesn't match
      const config2 = getLoRAConfig('realism_lora.safetensors', {
        priority: 2,
        modelFamily: 'FLUX',
        compatibleVariant: 'dev',
      });
      expect(config2).toBeUndefined();
    });

    it('should return config without options parameter', () => {
      const config = getLoRAConfig('anime_lora.safetensors');
      expect(config).toBeDefined();
      expect(config!.modelFamily).toBe('FLUX');
    });

    it('should handle schnell-specific models', () => {
      const config = getLoRAConfig('watercolor_painting_schnell_lora.safetensors', {
        compatibleVariant: 'schnell',
      });
      expect(config).toBeDefined();
      expect(config!.compatibleVariants).toContain('schnell');
    });

    it('should handle kontext-specific models', () => {
      const config = getLoRAConfig('flux-medical-environment-lora.safetensors', {
        compatibleVariant: 'kontext',
      });
      expect(config).toBeDefined();
      expect(config!.compatibleVariants).toContain('kontext');
    });
  });

  describe('getAllLoRAConfigs', () => {
    it('should return all LoRAs when no options provided', () => {
      const allConfigs = getAllLoRAConfigs();
      expect(allConfigs.length).toBe(Object.keys(LORA_REGISTRY).length);
      expect(allConfigs.length).toBe(23);
    });

    it('should filter by priority correctly', () => {
      const priority1Configs = getAllLoRAConfigs({ priority: 1 });
      expect(priority1Configs.length).toBe(9); // 9 official models
      priority1Configs.forEach((config) => {
        expect(config.priority).toBe(1);
      });

      const priority2Configs = getAllLoRAConfigs({ priority: 2 });
      expect(priority2Configs.length).toBe(9); // 9 professional models
      priority2Configs.forEach((config) => {
        expect(config.priority).toBe(2);
      });

      const priority3Configs = getAllLoRAConfigs({ priority: 3 });
      expect(priority3Configs.length).toBe(5); // 5 community models
      priority3Configs.forEach((config) => {
        expect(config.priority).toBe(3);
      });
    });

    it('should filter by modelFamily correctly', () => {
      const fluxConfigs = getAllLoRAConfigs({ modelFamily: 'FLUX' });
      expect(fluxConfigs.length).toBe(23); // All are FLUX
      fluxConfigs.forEach((config) => {
        expect(config.modelFamily).toBe('FLUX');
      });
    });

    it('should filter by compatibleVariant correctly', () => {
      const devConfigs = getAllLoRAConfigs({ compatibleVariant: 'dev' });
      expect(devConfigs.length).toBeGreaterThan(15); // Most are compatible with dev
      devConfigs.forEach((config) => {
        expect(config.compatibleVariants).toContain('dev');
      });

      const schnellConfigs = getAllLoRAConfigs({ compatibleVariant: 'schnell' });
      expect(schnellConfigs.length).toBe(1); // Only watercolor painting
      schnellConfigs.forEach((config) => {
        expect(config.compatibleVariants).toContain('schnell');
      });

      const kontextConfigs = getAllLoRAConfigs({ compatibleVariant: 'kontext' });
      expect(kontextConfigs.length).toBe(2); // medical and fill models
      kontextConfigs.forEach((config) => {
        expect(config.compatibleVariants).toContain('kontext');
      });
    });

    it('should apply multiple filters correctly', () => {
      const filteredConfigs = getAllLoRAConfigs({
        priority: 1,
        compatibleVariant: 'dev',
      });
      expect(filteredConfigs.length).toBe(9); // All priority 1 models are dev compatible
      filteredConfigs.forEach((config) => {
        expect(config.priority).toBe(1);
        expect(config.compatibleVariants).toContain('dev');
      });
    });

    it('should return empty array for non-matching filters', () => {
      const result = getAllLoRAConfigs({ priority: 99 });
      expect(result).toEqual([]);
    });

    it('should return empty array for non-existent variant', () => {
      const result = getAllLoRAConfigs({ compatibleVariant: 'nonexistent' as any });
      expect(result).toEqual([]);
    });
  });

  describe('LoRAConfig interface validation', () => {
    it('should have valid LoRAConfig interface constraints', () => {
      // Test that the interface constraints are working
      const sampleConfig: LoRAConfig = {
        compatibleVariants: ['dev'],
        modelFamily: 'FLUX',
        priority: 1,
      };

      expect(sampleConfig.compatibleVariants).toEqual(['dev']);
      expect(sampleConfig.modelFamily).toBe('FLUX');
      expect(sampleConfig.priority).toBe(1);
    });
  });

  describe('Registry data integrity', () => {
    it('should have consistent priority distribution', () => {
      const priority1Models = Object.values(LORA_REGISTRY).filter(
        (config) => config.priority === 1,
      );
      const priority2Models = Object.values(LORA_REGISTRY).filter(
        (config) => config.priority === 2,
      );
      const priority3Models = Object.values(LORA_REGISTRY).filter(
        (config) => config.priority === 3,
      );

      // Should have models in each priority group
      expect(priority1Models.length).toBe(9); // Official XLabs-AI
      expect(priority2Models.length).toBe(9); // Professional community
      expect(priority3Models.length).toBe(5); // Community/experimental
    });

    it('should have valid file extensions', () => {
      const validExtensions = ['.safetensors'];

      Object.keys(LORA_REGISTRY).forEach((fileName) => {
        const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));
        expect(hasValidExtension).toBe(true);
      });
    });

    it('should have consistent variant compatibility', () => {
      // Most models should be compatible with dev
      const devCompatibleModels = Object.values(LORA_REGISTRY).filter((config) =>
        config.compatibleVariants.includes('dev'),
      );
      expect(devCompatibleModels.length).toBeGreaterThan(15);
    });

    it('should have valid variant values', () => {
      const validVariants = ['dev', 'schnell', 'kontext', 'krea'];

      Object.values(LORA_REGISTRY).forEach((config) => {
        config.compatibleVariants.forEach((variant) => {
          expect(validVariants).toContain(variant);
        });
      });
    });

    it('should have diverse LoRA purposes', () => {
      const loraNames = Object.keys(LORA_REGISTRY);

      // Should have style-specific LoRAs
      const styleLoRAs = loraNames.filter(
        (name) =>
          name.includes('anime') ||
          name.includes('disney') ||
          name.includes('art') ||
          name.includes('realism'),
      );
      expect(styleLoRAs.length).toBeGreaterThan(5);

      // Should have functional LoRAs
      const functionalLoRAs = loraNames.filter(
        (name) =>
          name.includes('enhancement') || name.includes('detailer') || name.includes('kodak'),
      );
      expect(functionalLoRAs.length).toBeGreaterThan(2);

      // Should have specialized LoRAs
      const specializedLoRAs = loraNames.filter(
        (name) =>
          name.includes('medical') || name.includes('chinese') || name.includes('watercolor'),
      );
      expect(specializedLoRAs.length).toBeGreaterThan(2);
    });

    it('should maintain RFC-128 expansion integrity', () => {
      // Should have exactly 17 new models from RFC-128 (23 total - 6 original)
      const totalModels = Object.keys(LORA_REGISTRY).length;
      const originalModels = 6; // Original XLabs-AI models
      const expandedModels = totalModels - originalModels;

      expect(expandedModels).toBe(17);
    });
  });
});
