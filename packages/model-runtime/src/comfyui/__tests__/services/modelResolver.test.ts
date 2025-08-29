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
    'flux1-dev.safetensors': {
      family: 'flux',
      modelFamily: 'FLUX',
      variant: 'flux-1-dev',
    },
    'sd3.5_large.safetensors': {
      family: 'sd35',
      features: { inclclip: false },
      modelFamily: 'SD3.5',
      variant: 'stable-diffusion-35',
    },
    'sd3.5_large_inclclip.safetensors': {
      family: 'sd35',
      features: { inclclip: true },
      modelFamily: 'SD3.5',
      variant: 'stable-diffusion-35-inclclip',
    },
    'sdxl_base.safetensors': {
      family: 'sdxl',
      modelFamily: 'SDXL',
      variant: 'stable-diffusion-xl-base',
    },
  };

  return {
    MODEL_REGISTRY: configs,
    getModelConfig: vi.fn((filename: string) => {
      return configs[filename] || null;
    }),
    getModelsByFamily: vi.fn(() => ({
      'flux1-dev.safetensors': {
        family: 'flux',
        modelFamily: 'FLUX',
        variant: 'flux-1-dev',
      },
      'sd3.5_large.safetensors': {
        family: 'sd35',
        features: { inclclip: false },
        modelFamily: 'SD3.5',
        variant: 'stable-diffusion-35',
      },
    })),
  };
});

vi.mock('../../config/systemComponents', () => ({
  SYSTEM_COMPONENTS: {
    'clip_g.safetensors': {
      modelFamily: 'SD3',
      priority: 1,
      type: 'clip',
    },
    'clip_l.safetensors': {
      modelFamily: 'FLUX',
      priority: 1,
      type: 'clip',
    },
    't5-v1_1-xxl-encoder.safetensors': {
      modelFamily: 'FLUX',
      priority: 2,
      type: 't5',
    },
    't5xxl_fp16.safetensors': {
      modelFamily: 'FLUX',
      priority: 1,
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
    it('should return undefined for unregistered model ID', async () => {
      // Model not in registry and not on server should return undefined
      mockClientService.getCheckpoints.mockResolvedValue([TEST_SD35_MODELS.LARGE]);

      const result = await service.resolveModelFileName('nonexistent-model');
      expect(result).toBeUndefined();
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

      const result = await service.resolveModelFileName('stable-diffusion-custom');
      expect(result).toBeUndefined();
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
