import { describe, expect, it } from 'vitest';
import { WorkflowTypeDetector } from './WorkflowTypeDetector';

describe('WorkflowTypeDetector', () => {

  describe('Basic FLUX Detection', () => {
    it('should detect FLUX dev models', () => {
      const result = WorkflowTypeDetector.detectModelType('flux.1-dev');
      
      expect(result.architecture).toBe('flux');
      expect(result.variant).toBe('dev');
      expect(result.isSupported).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect FLUX schnell models', () => {
      const result = WorkflowTypeDetector.detectModelType('flux.1-schnell');
      
      expect(result.architecture).toBe('flux');
      expect(result.variant).toBe('schnell');
      expect(result.isSupported).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect FLUX kontext models', () => {
      const result = WorkflowTypeDetector.detectModelType('flux-kontext-dev');
      
      expect(result.architecture).toBe('flux');
      expect(result.variant).toBe('kontext');
      expect(result.isSupported).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect FLUX krea models', () => {
      const result = WorkflowTypeDetector.detectModelType('flux-krea-dev');
      
      expect(result.architecture).toBe('flux');
      expect(result.variant).toBe('krea');
      expect(result.isSupported).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Exact Match Detection', () => {
    it('should detect exact FLUX model matches with high confidence', () => {
      const exactModels = ['flux-dev', 'flux-schnell', 'flux-kontext-dev', 'flux-krea-dev'];
      
      exactModels.forEach(modelId => {
        const result = WorkflowTypeDetector.detectModelType(modelId);
        
        expect(result.architecture).toBe('flux');
        expect(result.isSupported).toBe(true);
        expect(result.confidence).toBe(1);
        expect(result.detectionMethod).toBe('exact');
      });
    });
  });

  describe('Non-FLUX Models', () => {
    it('should detect non-FLUX models as unknown', () => {
      const nonFluxModels = ['stable-diffusion-v1-5', 'sdxl-base-1.0', 'some-random-model'];
      
      nonFluxModels.forEach(modelId => {
        const result = WorkflowTypeDetector.detectModelType(modelId);
        
        expect(result.architecture).toBe('unknown');
        expect(result.isSupported).toBe(false);
        expect(result.confidence).toBe(0);
      });
    });
  });

  describe('File Extensions', () => {
    it('should ignore file extensions in detection', () => {
      const extensions = ['.safetensors', '.ckpt', '.pt'];
      const baseModel = 'flux-dev';
      
      extensions.forEach(ext => {
        const result = WorkflowTypeDetector.detectModelType(baseModel + ext);
        
        expect(result.architecture).toBe('flux');
        expect(result.variant).toBe('dev');
        expect(result.isSupported).toBe(true);
        expect(result.confidence).toBe(1);
      });
    });
  });

  describe('ComfyUI Prefix Handling', () => {
    it('should handle comfyui/ prefix correctly', () => {
      const result = WorkflowTypeDetector.detectModelType('comfyui/flux-dev');
      
      expect(result.architecture).toBe('flux');
      expect(result.variant).toBe('dev');
      expect(result.isSupported).toBe(true);
    });
  });

  describe('Static Utility Methods', () => {
    it('should correctly identify FLUX models', () => {
      expect(WorkflowTypeDetector.isFluxModel('flux-dev')).toBe(true);
      expect(WorkflowTypeDetector.isFluxModel('stable-diffusion')).toBe(false);
    });

    it('should validate architecture compatibility', () => {
      expect(WorkflowTypeDetector.validateArchitectureCompatibility('flux')).toBe(true);
      expect(WorkflowTypeDetector.validateArchitectureCompatibility('sd')).toBe(false);
      expect(WorkflowTypeDetector.validateArchitectureCompatibility('unknown')).toBe(false);
    });

    it('should return supported architectures', () => {
      const supported = WorkflowTypeDetector.getSupportedArchitectures();
      expect(supported).toContain('flux');
      expect(supported.length).toBeGreaterThan(0);
    });

    it('should return supported FLUX variants', () => {
      const variants = WorkflowTypeDetector.getSupportedFluxVariants();
      expect(variants).toContain('dev');
      expect(variants).toContain('schnell');
      expect(variants).toContain('kontext');
      expect(variants).toContain('krea');
    });
  });

  describe('Detection Statistics', () => {
    it('should provide detection statistics', () => {
      const testModels = [
        'flux-dev',
        'flux-schnell',
        'comfyui/flux-community-model',
        'stable-diffusion-v1-5',
        'unknown-model'
      ];
      
      const stats = WorkflowTypeDetector.getDetectionStats(testModels);
      
      expect(stats.totalModels).toBe(5);
      expect(stats.fluxModels).toBeGreaterThan(0);
      expect(stats.supportedModels).toBeGreaterThan(0);
      expect(stats.unknownModels).toBeGreaterThan(0);
      expect(typeof stats.exactMatches).toBe('number');
      expect(typeof stats.variantMatches).toBe('number');
      expect(typeof stats.keywordMatches).toBe('number');
    });
  });

  describe('Case Sensitivity', () => {
    it('should be case insensitive for FLUX detection', () => {
      const testCases = ['FLUX.1-DEV', 'flux.1-dev', 'Flux.1-Dev'];
      
      testCases.forEach(modelId => {
        const result = WorkflowTypeDetector.detectModelType(modelId);
        expect(result.architecture).toBe('flux');
        expect(result.isSupported).toBe(true);
      });
    });
  });

  describe('Variant Detection Priority', () => {
    it('should detect specific variants correctly', () => {
      const variantTests = [
        { expected: 'schnell', model: 'flux-schnell-v1' },
        { expected: 'kontext', model: 'flux-kontext-model' },
        { expected: 'krea', model: 'flux-krea-custom' },
        { expected: 'dev', model: 'flux-dev-community' }
      ];

      variantTests.forEach(({ model, expected }) => {
        const result = WorkflowTypeDetector.detectModelType(model);
        expect(result.variant).toBe(expected);
        expect(result.architecture).toBe('flux');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = WorkflowTypeDetector.detectModelType('');
      
      expect(result.architecture).toBe('unknown');
      expect(result.isSupported).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should handle models with multiple variant keywords', () => {
      // This model contains both 'dev' and 'schnell' - should pick one deterministically
      const result = WorkflowTypeDetector.detectModelType('flux-dev-schnell-mixed');
      
      expect(result.architecture).toBe('flux');
      expect(result.isSupported).toBe(true);
      expect(['dev', 'schnell']).toContain(result.variant);
    });
  });
});