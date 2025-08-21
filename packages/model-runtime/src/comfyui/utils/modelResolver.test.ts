// @vitest-environment node
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentRuntimeErrorType } from '@/libs/model-runtime';

import { ComfyUIModelResolver } from './modelResolver';

// Mock fetch globally
global.fetch = vi.fn();

describe('ComfyUIModelResolver', () => {
  let resolver: ComfyUIModelResolver;
  const mockBaseURL = 'http://localhost:8188';

  beforeEach(() => {
    resolver = new ComfyUIModelResolver(mockBaseURL);
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided baseURL', () => {
      const customResolver = new ComfyUIModelResolver('http://custom:8189');
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

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await resolver.getAvailableModelFiles();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8188/object_info', {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET',
      });
      expect(result).toEqual(['flux_dev.safetensors', 'flux_schnell.safetensors']);
    });

    it('should return empty array when no checkpoint loader available', async () => {
      const mockObjectInfo = {};

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await resolver.getAvailableModelFiles();
      expect(result).toEqual([]);
    });

    it('should return empty array when ckpt_name is not available', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {},
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await resolver.getAvailableModelFiles();
      expect(result).toEqual([]);
    });

    it('should return empty array when fetch fails', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const result = await resolver.getAvailableModelFiles();
      expect(result).toEqual([]);
    });

    it('should handle malformed checkpoint loader structure', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: null,
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await resolver.getAvailableModelFiles();
      expect(result).toEqual([]);
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

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
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

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
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

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      await expect(resolver.resolveModelFileName('comfyui/unknown-model')).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
        error: {
          model: 'comfyui/unknown-model',
        },
      });
    });

    it('should throw ModelNotFound error when fetch fails', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      await expect(resolver.resolveModelFileName('comfyui/flux-dev')).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
        error: {
          model: 'comfyui/flux-dev',
        },
      });
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

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
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

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await resolver.resolveModelFileName('comfyui/flux-10-dev-v2-final');
      expect(result).toBe('FLUX_1.0_DEV_v2_final.safetensors');
    });
  });

  describe('error handling edge cases', () => {
    it('should handle malformed JSON response', async () => {
      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await resolver.getAvailableModelFiles();
      expect(result).toEqual([]);
    });

    it('should handle undefined checkpoint loader input', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: undefined,
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await resolver.getAvailableModelFiles();
      expect(result).toEqual([]);
    });
  });
});
