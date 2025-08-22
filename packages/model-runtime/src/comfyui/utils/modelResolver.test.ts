// @vitest-environment node
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentRuntimeErrorType } from '@/libs/model-runtime';

import { ComfyUIModelResolver } from './modelResolver';

// Mock ComfyApi
const mockComfyApi = {
  fetchApi: vi.fn(),
};

describe('ComfyUIModelResolver', () => {
  let resolver: ComfyUIModelResolver;
  beforeEach(() => {
    resolver = new ComfyUIModelResolver(mockComfyApi as any);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided client', () => {
      const customClient = { fetchApi: vi.fn() };
      const customResolver = new ComfyUIModelResolver(customClient as any);
      expect(customResolver).toBeDefined();
    });
  });

  describe('normalizeModelName()', () => {
    it('should convert spaces to hyphens', () => {
      expect(resolver.normalizeModelName('Flux Dev Model')).toBe('flux-dev-model');
    });

    it('should convert underscores to hyphens', () => {
      expect(resolver.normalizeModelName('flux_dev_model')).toBe('flux-dev-model');
    });

    it('should remove special characters', () => {
      expect(resolver.normalizeModelName('flux@dev#model!')).toBe('fluxdevmodel');
    });

    it('should remove leading and trailing hyphens', () => {
      expect(resolver.normalizeModelName('-flux-dev-model-')).toBe('flux-dev-model');
    });

    it('should handle mixed case and multiple spaces', () => {
      expect(resolver.normalizeModelName('  FLUX    Dev    MODEL  ')).toBe('flux-dev-model');
    });

    it('should handle empty string', () => {
      expect(resolver.normalizeModelName('')).toBe('');
    });

    it('should handle numbers correctly', () => {
      expect(resolver.normalizeModelName('FLUX v1.2 Model')).toBe('flux-v12-model');
    });
  });

  describe('getAvailableModelFiles()', () => {
    it('should return model files from ComfyUI server', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_dev.safetensors', 'flux_schnell.safetensors']],
            },
          },
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const result = await resolver.getAvailableModelFiles();

      expect(mockComfyApi.fetchApi).toHaveBeenCalledWith('/object_info', {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      });
      expect(result).toEqual(['flux_dev.safetensors', 'flux_schnell.safetensors']);
    });

    it('should throw error when no checkpoint loader available', async () => {
      const mockObjectInfo = {};

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
    });

    it('should throw error when ckpt_name is not available', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {},
          },
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
    });

    it('should throw error when fetch fails', async () => {
      (mockComfyApi.fetchApi as Mock).mockRejectedValue(new Error('Network error'));

      // Network errors should be re-thrown as-is, not wrapped as ModelNotFound
      await expect(resolver.getAvailableModelFiles()).rejects.toThrow('Network error');
    });

    it('should throw error for malformed checkpoint loader structure', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: null,
            },
          },
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
    });
  });

  describe('transformModelFilesToList()', () => {
    it('should transform model files to standard format', () => {
      const modelFiles = ['flux_dev.safetensors', 'flux_schnell.ckpt', 'sd_xl.pt'];

      const result = resolver.transformModelFilesToList(modelFiles);

      expect(result).toEqual([
        { enabled: true, id: 'flux-dev' },
        { enabled: true, id: 'flux-schnell' },
        { enabled: true, id: 'sd-xl' },
      ]);
    });

    it('should handle empty array', () => {
      const result = resolver.transformModelFilesToList([]);
      expect(result).toEqual([]);
    });

    it('should handle complex model names', () => {
      const modelFiles = ['FLUX_1.0_DEV_v2.safetensors', 'SD-XL_Base_1.0.ckpt'];

      const result = resolver.transformModelFilesToList(modelFiles);

      expect(result).toEqual([
        { enabled: true, id: 'flux-10-dev-v2' },
        { enabled: true, id: 'sd-xl-base-10' },
      ]);
    });
  });

  describe('resolveModelFileName()', () => {
    beforeEach(() => {
      // Mock successful response for model resolution tests
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_dev.safetensors', 'flux_schnell.safetensors', 'sd_xl_base.ckpt']],
            },
          },
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });
    });

    it('should resolve exact model match', async () => {
      const result = await resolver.resolveModelFileName('comfyui/flux-dev');
      expect(result).toBe('flux_dev.safetensors');
    });

    it('should resolve fuzzy model match with keywords', async () => {
      const result = await resolver.resolveModelFileName('comfyui/flux-schnell');
      expect(result).toBe('flux_schnell.safetensors');
    });

    it('should fallback to FLUX model when no exact match found', async () => {
      const result = await resolver.resolveModelFileName('comfyui/unknown-model');
      // Should return the first FLUX model found
      expect(result).toBe('flux_dev.safetensors');
    });

    it('should fallback to first available model when no FLUX found', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['sd_xl_base.ckpt', 'stable_diffusion.safetensors']],
            },
          },
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const result = await resolver.resolveModelFileName('comfyui/unknown-model');
      expect(result).toBe('sd_xl_base.ckpt');
    });

    it('should handle model ID without comfyui prefix', async () => {
      const result = await resolver.resolveModelFileName('flux-dev');
      expect(result).toBe('flux_dev.safetensors');
    });

    it('should handle fuzzy matching with partial keywords', async () => {
      const result = await resolver.resolveModelFileName('comfyui/flux');
      // Should match any model containing 'flux'
      expect(['flux_dev.safetensors', 'flux_schnell.safetensors']).toContain(result);
    });

    it('should throw ModelNotFound error when no models available', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [[]],
            },
          },
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await expect(resolver.resolveModelFileName('comfyui/unknown-model')).rejects.toMatchObject({
        error: {
          model: 'comfyui/unknown-model',
        },
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
    });

    it('should throw ModelNotFound error when fetch fails', async () => {
      (mockComfyApi.fetchApi as Mock).mockRejectedValue(new Error('Network error'));

      // Network errors should be re-thrown as-is, not wrapped as ModelNotFound
      await expect(resolver.resolveModelFileName('comfyui/flux-dev')).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle different file extensions correctly', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['model.safetensors', 'model.ckpt', 'model.pt']],
            },
          },
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const result = await resolver.resolveModelFileName('comfyui/model');
      // Should match any of the three file extensions
      expect(['model.safetensors', 'model.ckpt', 'model.pt']).toContain(result);
    });

    it('should handle complex model name normalization in matching', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['FLUX_1.0_DEV_v2_final.safetensors']],
            },
          },
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      const result = await resolver.resolveModelFileName('comfyui/flux-10-dev-v2-final');
      expect(result).toBe('FLUX_1.0_DEV_v2_final.safetensors');
    });
  });

  describe('error handling edge cases', () => {
    it('should throw error for malformed JSON response', async () => {
      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.reject(new Error('Invalid JSON')),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow('Invalid JSON');
    });

    it('should throw error for undefined checkpoint loader input', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: undefined,
        },
      };

      (mockComfyApi.fetchApi as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
        ok: true,
        status: 200,
        statusText: 'OK',
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
    });
  });
});
