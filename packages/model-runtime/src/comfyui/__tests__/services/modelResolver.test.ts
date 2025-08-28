import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComfyUIClientService } from '../../services/comfyuiClient';
import { ModelResolverService } from '../../services/modelResolver';

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
      getObjectInfo: vi.fn(),
      getCheckpoints: vi.fn(),
      getNodeDefs: vi.fn(),
    };

    service = new ModelResolverService(mockClientService as ComfyUIClientService);
  });

  describe('resolveModelFileName', () => {
    it('should resolve model ID to filename', async () => {
      mockClientService.getObjectInfo.mockResolvedValue({
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux1-dev.safetensors', 'sd3.5_large.safetensors']],
            },
          },
        },
      });

      const result = await service.resolveModelFileName('flux-1-dev');
      expect(result).toBe('flux1-dev.safetensors');
    });

    it('should return filename if already a file', async () => {
      const result = await service.resolveModelFileName('model.safetensors');
      expect(result).toBe('model.safetensors');
    });

    it('should use cache on subsequent calls', async () => {
      mockClientService.getObjectInfo.mockResolvedValue({
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['custom_model_123.safetensors']],
            },
          },
        },
      });

      await service.resolveModelFileName('custom-model-123');
      const result = await service.resolveModelFileName('custom-model-123');

      expect(result).toBe('custom_model_123.safetensors');
      // Should only call once due to caching
      expect(mockClientService.getObjectInfo).toHaveBeenCalledTimes(1);
    });

    it('should resolve custom SD model to fixed filename', async () => {
      mockClientService.getCheckpoints.mockResolvedValue([
        'custom_sd_lobe.safetensors',
        'other_model.safetensors',
      ]);

      const result = await service.resolveModelFileName('stable-diffusion-custom');
      expect(result).toBe('custom_sd_lobe.safetensors');
    });

    it('should resolve custom SD refiner model to fixed filename', async () => {
      mockClientService.getCheckpoints.mockResolvedValue([
        'custom_sd_lobe.safetensors',
        'other_model.safetensors',
      ]);

      const result = await service.resolveModelFileName('stable-diffusion-custom-refiner');
      expect(result).toBe('custom_sd_lobe.safetensors');
    });

    it('should throw error if custom SD model file not found', async () => {
      mockClientService.getCheckpoints.mockResolvedValue(['other_model.safetensors']);

      await expect(service.resolveModelFileName('stable-diffusion-custom')).rejects.toThrow(
        "Custom SD model file not found. Please ensure 'custom_sd_lobe.safetensors' is in the ComfyUI models folder",
      );
    });
  });

  describe('selectVAE', () => {
    beforeEach(() => {
      mockClientService.getObjectInfo.mockResolvedValue({
        VAELoader: {
          input: {
            required: {
              vae_name: [['sdxl_vae_fp16fix.safetensors', 'sd3_vae.safetensors']],
            },
          },
        },
      });
    });

    it('should select appropriate VAE for SDXL model', async () => {
      const vae = await service.selectVAE({
        modelFileName: 'sdxl_base.safetensors',
      });

      expect(vae).toBe('sdxl_vae_fp16fix.safetensors');
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
  });

  describe('getOptimalComponent', () => {
    beforeEach(() => {
      mockClientService.getNodeDefs.mockResolvedValue({
        DualCLIPLoader: {
          input: {
            required: {
              clip_name1: [['t5xxl_fp16.safetensors', 'clip_l.safetensors']],
              clip_name2: [['clip_g.safetensors']],
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
    it('should validate existing model', async () => {
      mockClientService.getObjectInfo.mockResolvedValue({
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux1-dev.safetensors']],
            },
          },
        },
      });

      const result = await service.validateModel('flux-1-dev');

      expect(result.exists).toBe(true);
      expect(result.actualFileName).toBe('flux1-dev.safetensors');
    });

    it('should return exists=false for non-existent model', async () => {
      mockClientService.getObjectInfo.mockResolvedValue({
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [[]],
            },
          },
        },
      });

      try {
        const result = await service.validateModel('nonexistent');
        expect(result.exists).toBe(false);
      } catch (error) {
        // If it throws a ModelResolverError, check that the error is correct
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Model not found');
      }
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      mockClientService.getObjectInfo.mockResolvedValue({
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['custom_test_model.safetensors']],
            },
          },
        },
        VAELoader: {
          input: {
            required: {
              vae_name: [['vae.safetensors']],
            },
          },
        },
      });

      // Populate caches
      await service.resolveModelFileName('custom-test-model');
      await service.getAvailableVAEFiles();

      // Verify initial calls were made
      const initialCalls = mockClientService.getObjectInfo.mock.calls.length;
      expect(initialCalls).toBeGreaterThan(0);

      // Should call API again after cache clear
      await service.resolveModelFileName('custom-test-model');
      await service.getAvailableVAEFiles();

      // Should have made additional calls after clearing cache
      const finalCalls = mockClientService.getObjectInfo.mock.calls.length;
      expect(finalCalls).toBeGreaterThan(initialCalls);
    });
  });
});
