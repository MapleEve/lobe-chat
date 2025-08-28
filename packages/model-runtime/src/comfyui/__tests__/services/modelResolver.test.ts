import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelResolverError } from '../../errors/modelResolverError';
import { ComfyUIClientService } from '../../services/comfyuiClient';
import { ModelResolverService } from '../../services/modelResolver';
import { TEST_FLUX_MODELS, TEST_SD35_MODELS, TEST_CUSTOM_SD, TEST_MODEL_SETS } from '../constants/testModels';

// Mock the client service
vi.mock('../../services/comfyuiClient');

// Mock the config module
vi.mock('../../config/modelRegistry', () => {
  const configs: Record<string, any> = {
    'sd3.5_large.safetensors': {
      family: 'sd35',
      variant: 'stable-diffusion-35',
      modelFamily: 'SD3.5',
      features: { inclclip: false },
    },
    'sd3.5_large_inclclip.safetensors': {
      family: 'sd35',
      variant: 'stable-diffusion-35-inclclip',
      modelFamily: 'SD3.5',
      features: { inclclip: true },
    },
    'sdxl_base.safetensors': {
      family: 'sdxl',
      variant: 'stable-diffusion-xl-base',
      modelFamily: 'SDXL',
    },
    'flux1-dev.safetensors': {
      family: 'flux',
      variant: 'flux-1-dev',
      modelFamily: 'FLUX',
    },
  };

  return {
    MODEL_REGISTRY: configs,
    getModelConfig: vi.fn((filename: string) => {
      return configs[filename] || null;
    }),
    getModelsByFamily: vi.fn(() => ({
      'sd3.5_large.safetensors': {
        family: 'sd35',
        variant: 'stable-diffusion-35',
        modelFamily: 'SD3.5',
        features: { inclclip: false },
      },
      'flux1-dev.safetensors': {
        family: 'flux',
        variant: 'flux-1-dev',
        modelFamily: 'FLUX',
      },
    })),
  };
});

vi.mock('../../config/systemComponents', () => ({
  SYSTEM_COMPONENTS: {
    't5xxl_fp16.safetensors': {
      modelFamily: 'FLUX',
      priority: 1,
      type: 't5',
    },
    'clip_l.safetensors': {
      modelFamily: 'FLUX',
      priority: 1,
      type: 'clip',
    },
    'clip_g.safetensors': {
      modelFamily: 'SD3',
      priority: 1,
      type: 'clip',
    },
    't5-v1_1-xxl-encoder.safetensors': {
      modelFamily: 'FLUX',
      priority: 2,
      type: 't5',
    },
  },
  getSystemComponents: vi.fn(() => ({
    flux: {
      clip: ['t5xxl_fp16.safetensors', 'clip_l.safetensors'],
      t5: 't5-v1_1-xxl-encoder',
    },
    sd35: {
      clip: ['clip_g.safetensors', 'clip_l.safetensors', 't5xxl_fp16.safetensors'],
    },
  })),
}));

describe('ModelResolverService', () => {
  let service: ModelResolverService;
  let mockClientService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClientService = {
      getCheckpoints: vi.fn(),
      getNodeDefs: vi.fn(),
    };

    service = new ModelResolverService(mockClientService as ComfyUIClientService);
  });

  describe('resolveModelFileName', () => {
    it('should throw error for unregistered model ID', async () => {
      // Model not in registry and not on server should throw
      mockClientService.getCheckpoints.mockResolvedValue([TEST_SD35_MODELS.LARGE]);
      
      await expect(service.resolveModelFileName('nonexistent-model')).rejects.toThrow(
        'Model not found: nonexistent-model'
      );
    });

    it('should return filename if already a file', async () => {
      // Mock getCheckpoints to include the file
      mockClientService.getCheckpoints.mockResolvedValue([TEST_FLUX_MODELS.DEV, TEST_FLUX_MODELS.SCHNELL]);
      
      const result = await service.resolveModelFileName(TEST_FLUX_MODELS.DEV);
      expect(result).toBe(TEST_FLUX_MODELS.DEV);
    });

    it('should use cache on subsequent calls', async () => {
      // Use a non-registry model that requires server check
      const customModel = 'custom_test_model.safetensors';
      mockClientService.getCheckpoints.mockResolvedValue([customModel]);

      // First call
      await service.resolveModelFileName(customModel);
      // Second call should use cache
      const result = await service.resolveModelFileName(customModel);

      expect(result).toBe(customModel);
      // Should only call once due to caching
      expect(mockClientService.getCheckpoints).toHaveBeenCalledTimes(1);
    });

    it('should resolve custom SD model to fixed filename', async () => {
      mockClientService.getCheckpoints.mockResolvedValue([
        TEST_CUSTOM_SD,
        TEST_SD35_MODELS.LARGE,
      ]);

      const result = await service.resolveModelFileName('stable-diffusion-custom');
      expect(result).toBe(TEST_CUSTOM_SD);
    });

    it('should resolve custom SD refiner model to same fixed filename', async () => {
      mockClientService.getCheckpoints.mockResolvedValue([
        TEST_CUSTOM_SD,
        TEST_SD35_MODELS.LARGE,
      ]);

      const result = await service.resolveModelFileName('stable-diffusion-custom-refiner');
      expect(result).toBe(TEST_CUSTOM_SD);
    });

    it('should throw error if custom SD model file not found', async () => {
      mockClientService.getCheckpoints.mockResolvedValue([TEST_SD35_MODELS.LARGE]);

      await expect(service.resolveModelFileName('stable-diffusion-custom')).rejects.toThrow(
        `Custom SD model file not found. Please ensure '${TEST_CUSTOM_SD}' is in the ComfyUI models folder`,
      );
    });
  });

  describe('selectVAE', () => {
    beforeEach(() => {
      // Mock for getAvailableVAEFiles which calls getNodeDefs
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['sdxl_vae_fp16fix.safetensors', 'sd3_vae.safetensors']],
            },
          },
        },
      });
    });

    it('should return undefined for SDXL model without model config', async () => {
      const vae = await service.selectVAE({
        modelFileName: 'sdxl_base.safetensors',
      });

      // Without model config in registry, service cannot determine model family
      expect(vae).toBeUndefined();
    });

    it('should return undefined for models that do not need external VAE', async () => {
      const vae = await service.selectVAE({
        modelFileName: 'flux1-dev.safetensors',
      });

      expect(vae).toBeUndefined();
    });

    it('should use fixed VAE for custom SD model if available', async () => {
      // Mock getNodeDefs for VAE files
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['custom_sd_vae_lobe.safetensors', 'other_vae.safetensors']],
            },
          },
        },
      });

      const vae = await service.selectVAE({
        modelFileName: 'custom_sd_lobe.safetensors',
        isCustomSD: true,
      });

      expect(vae).toBe('custom_sd_vae_lobe.safetensors');
    });

    it('should allow custom VAE override for custom SD model', async () => {
      // Mock getNodeDefs for VAE files - includes both the fixed and custom VAE
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [
                ['custom_sd_vae_lobe.safetensors', 'sd3_vae.safetensors', 'other_vae.safetensors'],
              ],
            },
          },
        },
      });

      const vae = await service.selectVAE({
        modelFileName: 'custom_sd_lobe.safetensors',
        isCustomSD: true,
        customVAE: 'sd3_vae.safetensors',
      });

      expect(vae).toBe('sd3_vae.safetensors');
    });

    it('should fallback to built-in VAE if fixed VAE not available for custom SD', async () => {
      // Mock getNodeDefs for VAE files - does not include the fixed VAE
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['other_vae.safetensors']],
            },
          },
        },
      });

      const vae = await service.selectVAE({
        modelFileName: 'custom_sd_lobe.safetensors',
        isCustomSD: true,
      });

      expect(vae).toBeUndefined();
    });

    it('should handle SDXL models with available VAE', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['sdxl_vae_fp16.safetensors', 'other.safetensors']],
            },
          },
        },
      });

      const vae = await service.selectVAE({
        modelFileName: 'sdxl-base-1.0.safetensors',
      });

      // Without model config in registry, service cannot determine model family
      expect(vae).toBeUndefined();
    });

    it('should handle SDXL models without available VAE', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['regular_vae.safetensors']],
            },
          },
        },
      });

      const vae = await service.selectVAE({
        modelFileName: 'sdxl-turbo.safetensors',
      });

      // No SDXL VAE available, should return undefined
      expect(vae).toBeUndefined();
    });

    it('should return undefined when model config is not found', async () => {
      // Use a model filename that has no config
      const vae = await service.selectVAE({
        modelFileName: 'unknown-model.safetensors',
      });

      expect(vae).toBeUndefined();
    });

    it('should return undefined when getOptimalComponent fails', async () => {
      // Mock getOptimalComponent to throw error
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [[]],  // Empty VAE list
            },
          },
        },
      });

      const vae = await service.selectVAE({
        modelFileName: 'flux1-dev.safetensors',
      });

      // Should catch error and return undefined
      expect(vae).toBeUndefined();
    });

    it('should handle custom VAE that does not exist', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['existing_vae.safetensors']],
            },
          },
        },
      });

      const vae = await service.selectVAE({
        customVAE: 'non_existent_vae.safetensors',
        modelFileName: 'some-model.safetensors',
      });

      // Custom VAE not found, should continue to other logic
      expect(vae).toBeUndefined();
    });
  });

  describe('getOptimalComponent', () => {
    beforeEach(() => {
      mockClientService.getNodeDefs.mockResolvedValue({
        CLIPLoader: {
          input: {
            required: {
              clip_name: [['t5xxl_fp16.safetensors', 'clip_l.safetensors', 'clip_g.safetensors']],
            },
          },
        },
      });
    });

    it('should get optimal component for FLUX model', async () => {
      const component = await service.getOptimalComponent('t5', 'FLUX');
      expect(component).toBe('t5xxl_fp16.safetensors');
    });

    it('should throw error for unknown component type', async () => {
      await expect(service.getOptimalComponent('unknown', 'FLUX')).rejects.toThrow(
        'Unknown component type: unknown',
      );
    });

    it('should throw error when no component is available', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({});

      await expect(service.getOptimalComponent('vae', 'FLUX')).rejects.toThrow(
        'No vae component available for FLUX',
      );
    });
  });

  describe('validateModel', () => {
    it('should validate existing model file on server', async () => {
      mockClientService.getCheckpoints.mockResolvedValue([TEST_FLUX_MODELS.DEV, TEST_FLUX_MODELS.SCHNELL]);

      const result = await service.validateModel(TEST_FLUX_MODELS.DEV);

      expect(result.exists).toBe(true);
      expect(result.actualFileName).toBe(TEST_FLUX_MODELS.DEV);
    });

    it('should throw error for non-existent model', async () => {
      mockClientService.getCheckpoints.mockResolvedValue([TEST_SD35_MODELS.LARGE]);

      await expect(service.validateModel(TEST_MODEL_SETS.NON_EXISTENT[0])).rejects.toThrow(
        `Model not found: ${TEST_MODEL_SETS.NON_EXISTENT[0]}`
      );
    });

    it('should re-throw ModelResolverError from network errors', async () => {
      // Network error in getCheckpoints leads to CONNECTION_ERROR in handleApiError
      // But then resolveModelFileName catches it and throws MODEL_NOT_FOUND
      mockClientService.getCheckpoints.mockRejectedValue(new TypeError('Failed to fetch'));

      try {
        await service.validateModel('test-model');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        // The error gets re-thrown as MODEL_NOT_FOUND by resolveModelFileName
        expect((error as any).reason).toBe('MODEL_NOT_FOUND');
      }
    });


  });

  describe('cache management', () => {
    it('should use cached VAE data when available', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['vae1.safetensors', 'vae2.safetensors']],
            },
          },
        },
      });

      // First call - populates cache
      const result1 = await service.getAvailableVAEFiles();
      expect(result1).toEqual(['vae1.safetensors', 'vae2.safetensors']);
      expect(mockClientService.getNodeDefs).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      const result2 = await service.getAvailableVAEFiles();
      expect(result2).toEqual(['vae1.safetensors', 'vae2.safetensors']);
      expect(mockClientService.getNodeDefs).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should use cached component data when available', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['model1.safetensors', 'model2.safetensors']],
            },
          },
        },
      });

      // First call - populates cache
      const result1 = await service.getAvailableComponentFiles('CheckpointLoaderSimple', 'ckpt_name');
      expect(result1).toEqual(['model1.safetensors', 'model2.safetensors']);
      expect(mockClientService.getNodeDefs).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      const result2 = await service.getAvailableComponentFiles('CheckpointLoaderSimple', 'ckpt_name');
      expect(result2).toEqual(['model1.safetensors', 'model2.safetensors']);
      expect(mockClientService.getNodeDefs).toHaveBeenCalledTimes(1); // No additional call
    });
    it('should clear all caches', async () => {
      // Use a non-registry model that requires server check
      const customModel = 'custom_unregistered_model.safetensors';
      mockClientService.getCheckpoints.mockResolvedValue([customModel]);
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['ae.safetensors']],
            },
          },
        },
      });

      // Populate caches
      await service.resolveModelFileName(customModel);
      await service.getAvailableVAEFiles();

      // Verify initial calls were made
      expect(mockClientService.getCheckpoints).toHaveBeenCalledTimes(1);
      expect(mockClientService.getNodeDefs).toHaveBeenCalledTimes(1);

      // Clear all caches
      service.clearCaches();

      // Should call API again after cache clear
      await service.resolveModelFileName(customModel);
      await service.getAvailableVAEFiles();

      // Should have made additional calls after clearing cache
      expect(mockClientService.getCheckpoints).toHaveBeenCalledTimes(2);
      expect(mockClientService.getNodeDefs).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAvailableVAEFiles edge cases', () => {
    it('should handle non-array VAE list from getNodeDefs', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [{}], // Object instead of array
            },
          },
        },
      });

      const result = await service.getAvailableVAEFiles();
      expect(result).toEqual([]);
    });

    it('should handle missing VAELoader node', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({});

      const result = await service.getAvailableVAEFiles();
      expect(result).toEqual([]);
    });

    it('should handle missing input in VAELoader', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {}
      });

      const result = await service.getAvailableVAEFiles();
      expect(result).toEqual([]);
    });

    it('should handle missing required in VAELoader input', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {}
        }
      });

      const result = await service.getAvailableVAEFiles();
      expect(result).toEqual([]);
    });

    it('should handle missing vae_name in required', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {}
          }
        }
      });

      const result = await service.getAvailableVAEFiles();
      expect(result).toEqual([]);
    });
  });

  describe('getAvailableComponentFiles edge cases', () => {
    it('should handle non-array component list', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [{}], // Object instead of array
            },
          },
        },
      });

      const result = await service.getAvailableComponentFiles('VAELoader', 'vae_name');
      expect(result).toEqual([]);
    });

    it('should handle string component list', async () => {
      mockClientService.getNodeDefs.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: ['not-an-array'], // String instead of array
            },
          },
        },
      });

      const result = await service.getAvailableComponentFiles('VAELoader', 'vae_name');
      expect(result).toEqual([]);
    });
  });

  describe('validateModel edge cases', () => {
    it('should return false for non-ModelResolverError errors', async () => {
      // Mock to throw a regular error instead of ModelResolverError
      mockClientService.getCheckpoints.mockRejectedValue(new Error('Network error'));

      const result = await service.validateModel('test-model.safetensors');
      expect(result).toEqual({ exists: false });
    });

    it('should re-throw ModelResolverError', async () => {
      // Mock to throw ModelResolverError
      const modelError = new ModelResolverError(
        'Test error',
        'TEST_ERROR'
      );
      mockClientService.getCheckpoints.mockRejectedValue(modelError);

      await expect(service.validateModel('test-model.safetensors'))
        .rejects.toThrow(ModelResolverError);
    });
  });
});
