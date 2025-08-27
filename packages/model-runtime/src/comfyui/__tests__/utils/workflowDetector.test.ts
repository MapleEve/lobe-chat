import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelConfig } from '../../config/modelRegistry';
import { resolveModel } from '../../utils/modelResolver';
import { type FluxVariant, type SD3Variant, WorkflowDetector } from '../../utils/workflowDetector';

// Mock the modelResolver module
vi.mock('../../utils/modelResolver', () => ({
  resolveModel: vi.fn(),
}));

describe('WorkflowDetector', () => {
  const mockedResolveModel = resolveModel as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectModelType', () => {
    describe('Input Processing', () => {
      it('should remove "comfyui/" prefix from modelId', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'dev',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('comfyui/flux-dev');

        expect(mockedResolveModel).toHaveBeenCalledWith('flux-dev');
        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'dev',
        });
      });

      it('should handle modelId without comfyui prefix', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'schnell',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('flux-schnell');

        expect(mockedResolveModel).toHaveBeenCalledWith('flux-schnell');
        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'schnell',
        });
      });

      it('should handle multiple comfyui prefixes correctly', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'SD3',
          variant: 'sd35',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        // Only the first "comfyui/" should be removed
        const result = WorkflowDetector.detectModelType('comfyui/comfyui/model');

        expect(mockedResolveModel).toHaveBeenCalledWith('comfyui/model');
        expect(result).toEqual({
          architecture: 'SD3',
          isSupported: true,
          variant: 'sd35',
        });
      });
    });

    describe('FLUX Model Detection', () => {
      it('should detect FLUX dev variant', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'dev',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('flux-dev');

        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'dev',
        });
      });

      it('should detect FLUX schnell variant', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'schnell',
          priority: 2,
          recommendedDtype: 'fp8_e4m3fn',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('flux-schnell-fp8');

        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'schnell',
        });
      });

      it('should detect FLUX kontext variant', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'kontext',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('flux-kontext-dev');

        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'kontext',
        });
      });

      it('should detect FLUX krea variant', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'krea',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('flux-krea-dev');

        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'krea',
        });
      });

      it('should handle FLUX model with comfyui prefix', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'dev',
          priority: 2,
          recommendedDtype: 'fp8_e5m2',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('comfyui/custom-flux-model');

        expect(mockedResolveModel).toHaveBeenCalledWith('custom-flux-model');
        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'dev',
        });
      });
    });

    describe('SD3 Model Detection', () => {
      it('should detect SD3 sd35 variant', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'SD3',
          variant: 'sd35',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('sd3.5_large');

        expect(result).toEqual({
          architecture: 'SD3',
          isSupported: true,
          variant: 'sd35',
        });
      });

      it('should handle SD3 model with comfyui prefix', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'SD3',
          variant: 'sd35',
          priority: 2,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('comfyui/sd3.5_medium');

        expect(mockedResolveModel).toHaveBeenCalledWith('sd3.5_medium');
        expect(result).toEqual({
          architecture: 'SD3',
          isSupported: true,
          variant: 'sd35',
        });
      });
    });

    describe('Unknown/Unsupported Model Detection', () => {
      it('should return unknown architecture when model is not found', () => {
        mockedResolveModel.mockReturnValue(null);

        const result = WorkflowDetector.detectModelType('unknown-model');

        expect(result).toEqual({
          architecture: 'unknown',
          isSupported: false,
        });
      });

      it('should return unknown architecture for unsupported model family', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'SDXL' as any,
          variant: 'dev',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('sdxl-base');

        expect(result).toEqual({
          architecture: 'unknown',
          isSupported: false,
        });
      });

      it('should return unknown architecture for SD1 model family', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'SD1' as any,
          variant: 'schnell',
          priority: 3,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('stable-diffusion-v1-5');

        expect(result).toEqual({
          architecture: 'unknown',
          isSupported: false,
        });
      });

      it('should handle null modelId by causing runtime error (expected behavior)', () => {
        // According to the function signature, modelId is expected to be a string
        // Passing null/undefined would cause a runtime error, which is expected behavior
        expect(() => {
          WorkflowDetector.detectModelType(null as any);
        }).toThrow('Cannot read properties of null');
      });

      it('should handle undefined modelId by causing runtime error (expected behavior)', () => {
        // According to the function signature, modelId is expected to be a string
        // Passing null/undefined would cause a runtime error, which is expected behavior
        expect(() => {
          WorkflowDetector.detectModelType(undefined as any);
        }).toThrow('Cannot read properties of undefined');
      });

      it('should handle empty string modelId', () => {
        mockedResolveModel.mockReturnValue(null);

        const result = WorkflowDetector.detectModelType('');

        expect(mockedResolveModel).toHaveBeenCalledWith('');
        expect(result).toEqual({
          architecture: 'unknown',
          isSupported: false,
        });
      });

      it('should handle whitespace-only modelId', () => {
        mockedResolveModel.mockReturnValue(null);

        const result = WorkflowDetector.detectModelType('   ');

        expect(mockedResolveModel).toHaveBeenCalledWith('   ');
        expect(result).toEqual({
          architecture: 'unknown',
          isSupported: false,
        });
      });
    });

    describe('Type Casting', () => {
      it('should properly cast FLUX variant to FluxVariant type', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'dev',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('flux-model');

        expect(result.variant).toBe('dev');
        expect(typeof result.variant).toBe('string');
        
        // Test with krea variant
        const mockKreaConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'krea',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockKreaConfig);
        
        const kreaResult = WorkflowDetector.detectModelType('flux-krea-model');
        expect(kreaResult.variant).toBe('krea');
      });

      it('should properly cast SD3 variant to SD3Variant type', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'SD3',
          variant: 'sd35',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('sd3-model');

        expect(result.variant).toBe('sd35');
        expect(typeof result.variant).toBe('string');

        // Verify it matches SD3Variant type expectations
        const sd3Variants: SD3Variant[] = ['sd35'];
        expect(sd3Variants).toContain(result.variant as SD3Variant);
      });
    });

    describe('Edge Cases', () => {
      it('should handle special characters in modelId', () => {
        mockedResolveModel.mockReturnValue(null);

        const result = WorkflowDetector.detectModelType('model-with-special!@#$%^&*()_+');

        expect(mockedResolveModel).toHaveBeenCalledWith('model-with-special!@#$%^&*()_+');
        expect(result).toEqual({
          architecture: 'unknown',
          isSupported: false,
        });
      });

      it('should handle modelId with path separators', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'dev',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('path/to/model.safetensors');

        expect(mockedResolveModel).toHaveBeenCalledWith('path/to/model.safetensors');
        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'dev',
        });
      });

      it('should handle very long modelId', () => {
        const longModelId = 'a'.repeat(1000);
        mockedResolveModel.mockReturnValue(null);

        const result = WorkflowDetector.detectModelType(longModelId);

        expect(mockedResolveModel).toHaveBeenCalledWith(longModelId);
        expect(result).toEqual({
          architecture: 'unknown',
          isSupported: false,
        });
      });

      it('should handle modelId that is only "comfyui/"', () => {
        mockedResolveModel.mockReturnValue(null);

        const result = WorkflowDetector.detectModelType('comfyui/');

        expect(mockedResolveModel).toHaveBeenCalledWith('');
        expect(result).toEqual({
          architecture: 'unknown',
          isSupported: false,
        });
      });

      it('should handle case sensitivity in modelId', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          variant: 'dev',
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('COMFYUI/FLUX-DEV');

        // Should not match the prefix replacement since it's case sensitive
        expect(mockedResolveModel).toHaveBeenCalledWith('COMFYUI/FLUX-DEV');
        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: 'dev',
        });
      });
    });

    describe('Configuration Edge Cases', () => {
      it('should handle config with missing variant property', () => {
        const mockConfig: Partial<ModelConfig> = {
          modelFamily: 'FLUX',
          priority: 1,
          recommendedDtype: 'default',
          // variant is missing
        };
        mockedResolveModel.mockReturnValue(mockConfig as ModelConfig);

        const result = WorkflowDetector.detectModelType('flux-model');

        expect(result).toEqual({
          architecture: 'FLUX',
          isSupported: true,
          variant: undefined, // Will be cast to FluxVariant but is undefined
        });
      });

      it('should handle config with null variant', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'SD3',
          variant: null as any,
          priority: 1,
          recommendedDtype: 'default',
        };
        mockedResolveModel.mockReturnValue(mockConfig);

        const result = WorkflowDetector.detectModelType('sd3-model');

        expect(result).toEqual({
          architecture: 'SD3',
          isSupported: true,
          variant: null, // Will be cast to SD3Variant but is null
        });
      });
    });
  });
});
