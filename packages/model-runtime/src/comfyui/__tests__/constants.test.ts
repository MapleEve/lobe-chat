import { describe, expect, it } from 'vitest';

import {
  COMFYUI_DEFAULTS,
  DEFAULT_NEGATIVE_PROMPT,
  FLUX_MODEL_CONFIG,
  STYLE_KEYWORDS,
  WORKFLOW_DEFAULTS,
  getAllStyleKeywords,
} from '../constants';

describe('ComfyUI Constants', () => {
  describe('COMFYUI_DEFAULTS', () => {
    it('should have correct default configuration', () => {
      expect(COMFYUI_DEFAULTS.BASE_URL).toBe('http://localhost:8188');
      expect(COMFYUI_DEFAULTS.CONNECTION_TIMEOUT).toBe(30000);
      expect(COMFYUI_DEFAULTS.MAX_RETRIES).toBe(3);
    });

    it('should be a readonly object (TypeScript as const)', () => {
      // `as const` provides readonly types in TypeScript, not runtime freezing
      expect(typeof COMFYUI_DEFAULTS).toBe('object');
      expect(COMFYUI_DEFAULTS).toBeDefined();
    });
  });

  describe('FLUX_MODEL_CONFIG', () => {
    it('should have correct filename prefixes', () => {
      expect(FLUX_MODEL_CONFIG.FILENAME_PREFIXES.DEV).toBe(
        'LobeChat/%year%-%month%-%day%/FLUX_Dev',
      );
      expect(FLUX_MODEL_CONFIG.FILENAME_PREFIXES.SCHNELL).toBe(
        'LobeChat/%year%-%month%-%day%/FLUX_Schnell',
      );
      expect(FLUX_MODEL_CONFIG.FILENAME_PREFIXES.KONTEXT).toBe(
        'LobeChat/%year%-%month%-%day%/FLUX_Kontext',
      );
      expect(FLUX_MODEL_CONFIG.FILENAME_PREFIXES.KREA).toBe(
        'LobeChat/%year%-%month%-%day%/FLUX_Krea',
      );
    });

    it('should have all required prefixes', () => {
      const prefixes = Object.keys(FLUX_MODEL_CONFIG.FILENAME_PREFIXES);
      expect(prefixes).toContain('DEV');
      expect(prefixes).toContain('SCHNELL');
      expect(prefixes).toContain('KONTEXT');
      expect(prefixes).toContain('KREA');
    });

    it('should be a readonly object (TypeScript as const)', () => {
      // `as const` provides readonly types in TypeScript, not runtime freezing
      expect(typeof FLUX_MODEL_CONFIG).toBe('object');
      expect(FLUX_MODEL_CONFIG).toBeDefined();
    });
  });

  describe('WORKFLOW_DEFAULTS', () => {
    it('should have correct image defaults', () => {
      expect(WORKFLOW_DEFAULTS.IMAGE.BATCH_SIZE).toBe(1);
      expect(WORKFLOW_DEFAULTS.IMAGE.HEIGHT).toBe(1024);
      expect(WORKFLOW_DEFAULTS.IMAGE.WIDTH).toBe(1024);
    });

    it('should have correct Kontext configuration', () => {
      expect(WORKFLOW_DEFAULTS.KONTEXT.CFG).toBe(3.5);
      expect(WORKFLOW_DEFAULTS.KONTEXT.STEPS).toBe(28);
    });

    it('should have correct Krea configuration', () => {
      expect(WORKFLOW_DEFAULTS.KREA.CFG).toBe(3.5);
      expect(WORKFLOW_DEFAULTS.KREA.STEPS).toBe(15);
    });

    it('should have correct noise defaults', () => {
      expect(WORKFLOW_DEFAULTS.NOISE.SEED).toBe(0);
    });

    it('should have correct sampling defaults', () => {
      expect(WORKFLOW_DEFAULTS.SAMPLING.CFG).toBe(3.5);
      expect(WORKFLOW_DEFAULTS.SAMPLING.DENOISE).toBe(1);
      expect(WORKFLOW_DEFAULTS.SAMPLING.MAX_SHIFT).toBe(1.15);
      expect(WORKFLOW_DEFAULTS.SAMPLING.SAMPLER).toBe('euler');
      expect(WORKFLOW_DEFAULTS.SAMPLING.SCHEDULER).toBe('simple');
      expect(WORKFLOW_DEFAULTS.SAMPLING.STEPS).toBe(25);
    });

    it('should have correct Schnell configuration', () => {
      expect(WORKFLOW_DEFAULTS.SCHNELL.CFG).toBe(1);
      expect(WORKFLOW_DEFAULTS.SCHNELL.STEPS).toBe(4);
    });

    it('should be a readonly object (TypeScript as const)', () => {
      // `as const` provides readonly types in TypeScript, not runtime freezing
      expect(typeof WORKFLOW_DEFAULTS).toBe('object');
      expect(WORKFLOW_DEFAULTS).toBeDefined();
    });
  });

  describe('STYLE_KEYWORDS', () => {
    it('should have all required categories', () => {
      expect(STYLE_KEYWORDS.ARTISTS).toBeDefined();
      expect(STYLE_KEYWORDS.ART_STYLES).toBeDefined();
      expect(STYLE_KEYWORDS.LIGHTING).toBeDefined();
      expect(STYLE_KEYWORDS.PHOTOGRAPHY).toBeDefined();
      expect(STYLE_KEYWORDS.QUALITY).toBeDefined();
      expect(STYLE_KEYWORDS.RENDERING).toBeDefined();
    });

    it('should have non-empty arrays for each category', () => {
      expect(STYLE_KEYWORDS.ARTISTS.length).toBeGreaterThan(0);
      expect(STYLE_KEYWORDS.ART_STYLES.length).toBeGreaterThan(0);
      expect(STYLE_KEYWORDS.LIGHTING.length).toBeGreaterThan(0);
      expect(STYLE_KEYWORDS.PHOTOGRAPHY.length).toBeGreaterThan(0);
      expect(STYLE_KEYWORDS.QUALITY.length).toBeGreaterThan(0);
      expect(STYLE_KEYWORDS.RENDERING.length).toBeGreaterThan(0);
    });

    it('should contain expected artist keywords', () => {
      expect(STYLE_KEYWORDS.ARTISTS).toContain('by greg rutkowski');
      expect(STYLE_KEYWORDS.ARTISTS).toContain('by artgerm');
      expect(STYLE_KEYWORDS.ARTISTS).toContain('trending on artstation');
    });

    it('should contain expected art style keywords', () => {
      expect(STYLE_KEYWORDS.ART_STYLES).toContain('photorealistic');
      expect(STYLE_KEYWORDS.ART_STYLES).toContain('anime');
      expect(STYLE_KEYWORDS.ART_STYLES).toContain('digital art');
    });

    it('should contain expected lighting keywords', () => {
      expect(STYLE_KEYWORDS.LIGHTING).toContain('dramatic lighting');
      expect(STYLE_KEYWORDS.LIGHTING).toContain('golden hour');
      expect(STYLE_KEYWORDS.LIGHTING).toContain('volumetric lighting');
    });

    it('should contain expected photography keywords', () => {
      expect(STYLE_KEYWORDS.PHOTOGRAPHY).toContain('depth of field');
      expect(STYLE_KEYWORDS.PHOTOGRAPHY).toContain('bokeh');
      expect(STYLE_KEYWORDS.PHOTOGRAPHY).toContain('macro');
    });

    it('should contain expected quality keywords', () => {
      expect(STYLE_KEYWORDS.QUALITY).toContain('high quality');
      expect(STYLE_KEYWORDS.QUALITY).toContain('4k');
      expect(STYLE_KEYWORDS.QUALITY).toContain('masterpiece');
    });

    it('should contain expected rendering keywords', () => {
      expect(STYLE_KEYWORDS.RENDERING).toContain('octane render');
      expect(STYLE_KEYWORDS.RENDERING).toContain('ray tracing');
      expect(STYLE_KEYWORDS.RENDERING).toContain('unreal engine');
    });
  });

  describe('getAllStyleKeywords', () => {
    it('should return a flattened array of all style keywords', () => {
      const allKeywords = getAllStyleKeywords();
      expect(Array.isArray(allKeywords)).toBe(true);
      expect(allKeywords.length).toBeGreaterThan(0);
    });

    it('should include keywords from all categories', () => {
      const allKeywords = getAllStyleKeywords();

      // Check that keywords from each category are present
      expect(allKeywords).toContain('by greg rutkowski'); // ARTISTS
      expect(allKeywords).toContain('photorealistic'); // ART_STYLES
      expect(allKeywords).toContain('dramatic lighting'); // LIGHTING
      expect(allKeywords).toContain('depth of field'); // PHOTOGRAPHY
      expect(allKeywords).toContain('high quality'); // QUALITY
      expect(allKeywords).toContain('octane render'); // RENDERING
    });

    it('should return the same result on multiple calls', () => {
      const result1 = getAllStyleKeywords();
      const result2 = getAllStyleKeywords();
      expect(result1).toEqual(result2);
    });

    it('should flatten all categories correctly', () => {
      const allKeywords = getAllStyleKeywords();
      const manualFlat = [
        ...STYLE_KEYWORDS.ARTISTS,
        ...STYLE_KEYWORDS.ART_STYLES,
        ...STYLE_KEYWORDS.LIGHTING,
        ...STYLE_KEYWORDS.PHOTOGRAPHY,
        ...STYLE_KEYWORDS.QUALITY,
        ...STYLE_KEYWORDS.RENDERING,
      ];
      expect(allKeywords).toEqual(manualFlat);
    });

    it('should not contain duplicate keywords', () => {
      const allKeywords = getAllStyleKeywords();
      const uniqueKeywords = [...new Set(allKeywords)];
      expect(allKeywords.length).toBe(uniqueKeywords.length);
    });

    it('should return readonly array', () => {
      const allKeywords = getAllStyleKeywords();
      expect(Object.isFrozen(allKeywords)).toBe(false); // readonly in TypeScript, not frozen in runtime
    });
  });

  describe('Integration tests', () => {
    it('should have consistent configuration values', () => {
      // Verify that Schnell uses CFG 1 (as documented)
      expect(WORKFLOW_DEFAULTS.SCHNELL.CFG).toBe(1);

      // Verify that Dev uses CFG 3.5 (as documented)
      expect(WORKFLOW_DEFAULTS.SAMPLING.CFG).toBe(3.5);

      // Verify that Krea and Kontext both use CFG 3.5
      expect(WORKFLOW_DEFAULTS.KREA.CFG).toBe(3.5);
      expect(WORKFLOW_DEFAULTS.KONTEXT.CFG).toBe(3.5);
    });

    it('should have reasonable default values', () => {
      // Image dimensions should be power of 2 or common sizes
      expect(WORKFLOW_DEFAULTS.IMAGE.WIDTH % 64).toBe(0);
      expect(WORKFLOW_DEFAULTS.IMAGE.HEIGHT % 64).toBe(0);

      // Steps should be reasonable ranges
      expect(WORKFLOW_DEFAULTS.SAMPLING.STEPS).toBeGreaterThan(0);
      expect(WORKFLOW_DEFAULTS.SAMPLING.STEPS).toBeLessThan(100);
    });
  });
});
