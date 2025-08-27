import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { getModelsByVariant } from '../../config/modelRegistry';
import { ModelResolver, ModelResolverError } from '../../utils/modelResolver';

// Mock the ComfyUI SDK
vi.mock('@saintno/comfyui-sdk', () => ({
  ComfyApi: vi.fn().mockImplementation(() => ({
    fetchApi: vi.fn(),
  })),
}));

// Mock the modelRegistry module
vi.mock('../../config/modelRegistry', () => ({
  getAllModelNames: vi.fn(),
  getModelConfig: vi.fn(),
  getModelsByVariant: vi.fn(),
}));

// Mock the debug module
vi.mock('debug', () => ({
  __esModule: true,
  default: vi.fn(() => vi.fn()),
}));

const mockGetModelsByVariant = getModelsByVariant as MockedFunction<typeof getModelsByVariant>;

describe('ModelResolver - SD3.5 Mapping Logic', () => {
  let mockComfyApi: any;
  let resolver: ModelResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    mockComfyApi = {
      fetchApi: vi.fn(),
    };
    resolver = new ModelResolver(mockComfyApi);
    mockGetModelsByVariant.mockReturnValue([]);
  });

  describe('SD3.5 Model Resolution', () => {
    it('should map stable-diffusion-35 to sd35 variant', async () => {
      // Mock server response with SD3.5 models
      const mockServerModels = [
        'sd3.5_large.safetensors',
        'sd3.5_medium.safetensors',
        'flux1-dev.safetensors',
      ];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      // Mock getModelsByVariant to return SD3.5 models
      const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockSd35Models);

      const result = await resolver.resolveModelFileName('stable-diffusion-35');

      expect(result).toBe('sd3.5_large.safetensors');
      expect(mockGetModelsByVariant).toHaveBeenCalledWith('sd35');
    });

    it('should map stable-diffusion-35-inclclip to custom-sd variant', async () => {
      // Mock server response with incl-clip SD3.5 model
      const mockServerModels = [
        'sd3.5_medium_incl_clips_t5xxlfp8scaled.safetensors',
        'flux1-dev.safetensors',
      ];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      // Mock getModelsByVariant for custom-sd variant
      mockGetModelsByVariant.mockReturnValue([
        'sd3.5_medium_incl_clips_t5xxlfp8scaled.safetensors',
      ]);

      const result = await resolver.resolveModelFileName('stable-diffusion-35-inclclip');

      expect(result).toBe('sd3.5_medium_incl_clips_t5xxlfp8scaled.safetensors');
      expect(mockGetModelsByVariant).toHaveBeenCalledWith('sd-t2i');
    });

    it('should handle direct sd35 variant name', async () => {
      const mockServerModels = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockSd35Models);

      const result = await resolver.resolveModelFileName('sd35');

      expect(result).toBe('sd3.5_large.safetensors');
      expect(mockGetModelsByVariant).toHaveBeenCalledWith('sd35');
    });

    it('should prioritize sd3.5_large.safetensors over sd3.5_medium.safetensors', async () => {
      const mockServerModels = [
        'sd3.5_medium.safetensors',
        'sd3.5_large.safetensors', // Available on server but not first in list
      ];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      // getModelsByVariant should return models sorted by priority (large has higher priority)
      const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockSd35Models);

      const result = await resolver.resolveModelFileName('stable-diffusion-35');

      expect(result).toBe('sd3.5_large.safetensors'); // Should choose large model due to higher priority
    });

    it('should select available sd3.5_medium.safetensors when large is not available', async () => {
      const mockServerModels = [
        'sd3.5_medium.safetensors', // Only medium model available
        'flux1-dev.safetensors',
      ];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockSd35Models);

      const result = await resolver.resolveModelFileName('stable-diffusion-35');

      expect(result).toBe('sd3.5_medium.safetensors');
    });

    it('should throw ModelNotFound error when no SD3.5 models are available on server', async () => {
      const mockServerModels = [
        'flux1-dev.safetensors', // No SD3.5 models available
        'flux1-schnell.safetensors',
      ];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockSd35Models);

      await expect(resolver.resolveModelFileName('stable-diffusion-35')).rejects.toThrow(
        ModelResolverError,
      );

      try {
        await resolver.resolveModelFileName('stable-diffusion-35');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.MODEL_NOT_FOUND,
        );
      }
    });
  });

  describe('Other Model Variants', () => {
    it('should handle other FLUX model variants correctly', async () => {
      const mockServerModels = ['flux1-dev.safetensors', 'flux1-schnell.safetensors'];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      const mockDevModels = ['flux1-dev.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockDevModels);

      const result = await resolver.resolveModelFileName('flux-dev');

      expect(result).toBe('flux1-dev.safetensors');
      expect(mockGetModelsByVariant).toHaveBeenCalledWith('dev');
    });

    it('should handle FLUX schnell variant', async () => {
      const mockServerModels = ['flux1-dev.safetensors', 'flux1-schnell.safetensors'];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      const mockSchnellModels = ['flux1-schnell.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockSchnellModels);

      const result = await resolver.resolveModelFileName('flux-schnell');

      expect(result).toBe('flux1-schnell.safetensors');
      expect(mockGetModelsByVariant).toHaveBeenCalledWith('schnell');
    });

    it('should handle kontext variant mapping', async () => {
      const mockServerModels = ['flux1-kontext-dev.safetensors'];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      const mockKontextModels = ['flux1-kontext-dev.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockKontextModels);

      const result = await resolver.resolveModelFileName('flux-kontext-dev');

      expect(result).toBe('flux1-kontext-dev.safetensors');
      expect(mockGetModelsByVariant).toHaveBeenCalledWith('kontext');
    });

    it('should handle krea variant mapping', async () => {
      const mockServerModels = ['flux1-krea-dev.safetensors'];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      const mockKreaModels = ['flux1-krea-dev.safetensors'];
      mockGetModelsByVariant.mockReturnValue(mockKreaModels);

      const result = await resolver.resolveModelFileName('flux-krea-dev');

      expect(result).toBe('flux1-krea-dev.safetensors');
      expect(mockGetModelsByVariant).toHaveBeenCalledWith('dev');
    });
  });

  describe('Edge Cases and Fallbacks', () => {
    it('should throw error when no models match variant', async () => {
      const mockServerModels = ['some-other-model.safetensors'];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      mockGetModelsByVariant.mockReturnValue(['flux1-dev.safetensors']); // Not available on server

      await expect(resolver.resolveModelFileName('flux-dev')).rejects.toThrow(ModelResolverError);

      try {
        await resolver.resolveModelFileName('flux-dev');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.MODEL_NOT_FOUND,
        );
      }
    });

    it('should handle empty variant models gracefully', async () => {
      const mockServerModels = ['flux1-dev.safetensors'];

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockServerModels],
                },
              },
            },
          }),
        ok: true,
      });

      mockGetModelsByVariant.mockReturnValue([]); // No models in variant

      await expect(resolver.resolveModelFileName('flux-dev')).rejects.toThrow(ModelResolverError);

      try {
        await resolver.resolveModelFileName('flux-dev');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.MODEL_NOT_FOUND,
        );
      }
    });
  });
});