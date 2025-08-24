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
        { enabled: true, id: 'flux1-dev' },  // flux_dev.safetensors has standardName 'FLUX.1-dev'
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

  describe('resolveModelFileName() - Strict Validation', () => {
    let mockValidationManager: any;
    
    beforeEach(() => {
      // Mock ModelValidationManager
      mockValidationManager = {
        validateModelExistence: vi.fn(),
      };
      
      // Replace the validation manager in resolver
      (resolver as any).modelValidator = mockValidationManager;
    });

    it('should resolve model through strict validation', async () => {
      // Mock successful validation
      mockValidationManager.validateModelExistence.mockResolvedValue({
        actualFileName: 'flux1-dev.safetensors',
        exists: true,
        timestamp: Date.now(),
      });

      const result = await resolver.resolveModelFileName('comfyui/flux-dev');
      
      expect(mockValidationManager.validateModelExistence).toHaveBeenCalledWith('comfyui/flux-dev');
      expect(result).toBe('flux1-dev.safetensors');
    });

    it('should resolve different model variants through validation', async () => {
      mockValidationManager.validateModelExistence.mockResolvedValue({
        actualFileName: 'flux1-schnell.safetensors',
        exists: true,
        timestamp: Date.now(),
      });

      const result = await resolver.resolveModelFileName('comfyui/flux-schnell');
      
      expect(mockValidationManager.validateModelExistence).toHaveBeenCalledWith('comfyui/flux-schnell');
      expect(result).toBe('flux1-schnell.safetensors');
    });

    it('should handle model ID without comfyui prefix', async () => {
      mockValidationManager.validateModelExistence.mockResolvedValue({
        actualFileName: 'flux1-dev.safetensors',
        exists: true,
        timestamp: Date.now(),
      });

      const result = await resolver.resolveModelFileName('flux-dev');
      
      expect(mockValidationManager.validateModelExistence).toHaveBeenCalledWith('flux-dev');
      expect(result).toBe('flux1-dev.safetensors');
    });

    it('should throw ModelNotFound error when model does not exist', async () => {
      // Mock validation failure
      const mockError = {
        error: { model: 'comfyui/unknown-model' },
        errorType: AgentRuntimeErrorType.ModelNotFound,
      };
      
      mockValidationManager.validateModelExistence.mockRejectedValue(mockError);

      await expect(resolver.resolveModelFileName('comfyui/unknown-model')).rejects.toMatchObject({
        error: {
          model: 'comfyui/unknown-model',
        },
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
      
      expect(mockValidationManager.validateModelExistence).toHaveBeenCalledWith('comfyui/unknown-model');
    });

    it('should handle validation errors properly', async () => {
      // Mock network/validation error
      mockValidationManager.validateModelExistence.mockRejectedValue(new Error('Network error'));

      await expect(resolver.resolveModelFileName('comfyui/flux-dev')).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
      
      expect(mockValidationManager.validateModelExistence).toHaveBeenCalledWith('comfyui/flux-dev');
    });

    it('should handle different file extensions through validation', async () => {
      mockValidationManager.validateModelExistence.mockResolvedValue({
        actualFileName: 'model.safetensors',
        exists: true,
        timestamp: Date.now(),
      });

      const result = await resolver.resolveModelFileName('comfyui/model');
      
      expect(mockValidationManager.validateModelExistence).toHaveBeenCalledWith('comfyui/model');
      expect(result).toBe('model.safetensors');
    });

    it('should handle complex model names through standardization', async () => {
      mockValidationManager.validateModelExistence.mockResolvedValue({
        actualFileName: 'FLUX_1.0_DEV_v2_final.safetensors',
        exists: true,
        timestamp: Date.now(),
      });

      const result = await resolver.resolveModelFileName('comfyui/flux-10-dev-v2-final');
      
      expect(mockValidationManager.validateModelExistence).toHaveBeenCalledWith('comfyui/flux-10-dev-v2-final');
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
