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

describe('ModelResolver - Validation and Error Handling', () => {
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

  describe('getAvailableModelFiles - Success Cases', () => {
    it('should fetch and cache model files from server', async () => {
      const mockModels = ['flux1-dev.safetensors', 'flux1-schnell.safetensors'];
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockModels],
                },
              },
            },
          }),
        ok: true,
      });

      const result = await resolver.getAvailableModelFiles();

      expect(result).toEqual(mockModels);
      expect(mockComfyApi.fetchApi).toHaveBeenCalledWith('/object_info');
    });

    it('should return cached models on subsequent calls', async () => {
      const mockModels = ['flux1-dev.safetensors'];
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [mockModels],
                },
              },
            },
          }),
        ok: true,
      });

      // First call
      const result1 = await resolver.getAvailableModelFiles();
      expect(result1).toEqual(mockModels);
      expect(mockComfyApi.fetchApi).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await resolver.getAvailableModelFiles();
      expect(result2).toEqual(mockModels);
      expect(mockComfyApi.fetchApi).toHaveBeenCalledTimes(1); // Still only called once
    });
  });

  describe('getAvailableModelFiles - Error Handling', () => {
    it('should handle 401 unauthorized error', async () => {
      mockComfyApi.fetchApi.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.INVALID_API_KEY,
        );
      }
    });

    it('should handle 403 forbidden error', async () => {
      mockComfyApi.fetchApi.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.PERMISSION_DENIED,
        );
      }
    });

    it('should handle other HTTP errors as service unavailable', async () => {
      mockComfyApi.fetchApi.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('should handle Response object thrown as error with 401 status', async () => {
      const responseError = new Response('Unauthorized', { status: 401 });
      mockComfyApi.fetchApi.mockRejectedValue(responseError);

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.INVALID_API_KEY,
        );
      }
    });

    it('should handle Response object thrown as error with 403 status', async () => {
      const responseError = new Response('Forbidden', { status: 403 });
      mockComfyApi.fetchApi.mockRejectedValue(responseError);

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.PERMISSION_DENIED,
        );
      }
    });

    it('should handle error with Response object as cause (403 status)', async () => {
      const cause = new Response('Forbidden', { status: 403 });
      const error = new Error('Network error');
      (error as any).cause = cause;
      mockComfyApi.fetchApi.mockRejectedValue(error);

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.PERMISSION_DENIED,
        );
      }
    });

    it('should handle error with Response object as cause (401 status)', async () => {
      const cause = new Response('Unauthorized', { status: 401 });
      const error = new Error('Network error');
      (error as any).cause = cause;
      mockComfyApi.fetchApi.mockRejectedValue(error);

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.INVALID_API_KEY,
        );
      }
    });

    it('should throw error when no models are available', async () => {
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [[]],
                },
              },
            },
          }),
        ok: true,
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.NO_MODELS_AVAILABLE,
        );
      }
    });

    it('should throw error when CheckpointLoaderSimple is not available', async () => {
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({}),
        ok: true,
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('should throw error when ckpt_name input is not available', async () => {
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () =>
          Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {},
              },
            },
          }),
        ok: true,
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('should throw error for malformed server response', async () => {
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve(null),
        ok: true,
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('should throw error when JSON parsing fails', async () => {
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.reject(new Error('Invalid JSON')),
        ok: true,
      });

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.SERVICE_UNAVAILABLE,
        );
      }
    });

    it('should handle network errors gracefully', async () => {
      mockComfyApi.fetchApi.mockRejectedValue(new Error('Network connection failed'));

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.CONNECTION_ERROR,
        );
      }
    });

    it('should handle ECONNREFUSED errors', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:8188');
      mockComfyApi.fetchApi.mockRejectedValue(connectionError);

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.CONNECTION_ERROR,
        );
      }
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      mockComfyApi.fetchApi.mockRejectedValue(timeoutError);

      await expect(resolver.getAvailableModelFiles()).rejects.toThrow(ModelResolverError);

      try {
        await resolver.getAvailableModelFiles();
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.CONNECTION_ERROR,
        );
      }
    });
  });
});