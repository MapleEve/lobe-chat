import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import { AgentRuntimeErrorType } from '../../error';
import { AgentRuntimeError } from '../../utils/createError';
import type { ModelConfig } from '../config/modelRegistry';
// Import the mocked functions
import { getAllModelNames, getModelConfig, getModelsByVariant } from '../config/modelRegistry';
import {
  ModelResolver,
  getAllModels,
  isValidModel,
  resolveModel,
  resolveModelStrict,
} from './modelResolver';

// Mock the modelRegistry module
vi.mock('../config/modelRegistry', () => ({
  getModelConfig: vi.fn(),
  getAllModelNames: vi.fn(),
  getModelsByVariant: vi.fn(),
}));

// Mock the ComfyUI SDK
vi.mock('@saintno/comfyui-sdk', () => ({
  ComfyApi: vi.fn().mockImplementation(() => ({
    fetchApi: vi.fn(),
  })),
}));

// Mock the debug module
vi.mock('debug', () => ({
  __esModule: true,
  default: vi.fn(() => vi.fn()),
}));

// Mock the error parser
vi.mock('../../utils/comfyuiErrorParser', () => ({
  parseComfyUIErrorMessage: vi.fn().mockReturnValue({
    error: { message: 'Mocked error' },
    errorType: AgentRuntimeErrorType.ComfyUIBizError,
  }),
}));

// Mock AgentRuntimeError.createImage
vi.mock('../../utils/createError', () => ({
  AgentRuntimeError: {
    createImage: vi.fn(),
  },
}));

const mockGetModelConfig = getModelConfig as MockedFunction<typeof getModelConfig>;
const mockGetAllModelNames = getAllModelNames as MockedFunction<typeof getAllModelNames>;
const mockGetModelsByVariant = getModelsByVariant as MockedFunction<typeof getModelsByVariant>;
const mockAgentRuntimeErrorCreateImage = AgentRuntimeError.createImage as MockedFunction<
  typeof AgentRuntimeError.createImage
>;

describe('modelResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockGetModelConfig.mockReturnValue(undefined);
    mockGetAllModelNames.mockReturnValue([]);
    mockGetModelsByVariant.mockReturnValue([]);
  });

  describe('resolveModel', () => {
    it('should resolve model with direct filename match', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };
      mockGetModelConfig.mockReturnValue(mockConfig);

      const result = resolveModel('flux1-dev.safetensors');

      expect(result).toBe(mockConfig);
      expect(mockGetModelConfig).toHaveBeenCalledWith('flux1-dev.safetensors');
    });

    it('should resolve model from path by extracting filename', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };
      mockGetModelConfig.mockReturnValue(mockConfig);

      const result = resolveModel('/path/to/flux1-dev.safetensors');

      expect(result).toBe(mockConfig);
      expect(mockGetModelConfig).toHaveBeenCalledWith('flux1-dev.safetensors');
    });

    it('should fallback to case-insensitive lookup when direct match fails', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };

      // First call returns null, second call (case-insensitive) returns config
      mockGetModelConfig.mockReturnValueOnce(undefined).mockReturnValueOnce(mockConfig);

      const result = resolveModel('FLUX1-DEV.safetensors');

      expect(result).toBe(mockConfig);
      expect(mockGetModelConfig).toHaveBeenCalledTimes(2);
      expect(mockGetModelConfig).toHaveBeenCalledWith('FLUX1-DEV.safetensors');
      expect(mockGetModelConfig).toHaveBeenCalledWith('FLUX1-DEV.safetensors', {
        caseInsensitive: true,
      });
    });

    it('should return null when model is not found', () => {
      mockGetModelConfig.mockReturnValue(undefined);

      const result = resolveModel('non-existent-model.safetensors');

      expect(result).toBeNull();
      expect(mockGetModelConfig).toHaveBeenCalledTimes(2); // Direct and case-insensitive attempts
    });
  });

  describe('resolveModelStrict', () => {
    it('should return model config when model exists', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };
      mockGetModelConfig.mockReturnValue(mockConfig);

      const result = resolveModelStrict('flux1-dev.safetensors');

      expect(result).toBe(mockConfig);
    });

    it('should throw error when model is not found', () => {
      mockGetModelConfig.mockReturnValue(undefined);
      const mockError = new Error('Model not found');
      mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
        throw mockError;
      });

      expect(() => resolveModelStrict('non-existent-model.safetensors')).toThrow();

      expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
        error: new Error('ModelNotFound'),
        errorType: AgentRuntimeErrorType.ModelNotFound,
        provider: 'comfyui',
      });
    });
  });

  describe('isValidModel', () => {
    it('should return true when model exists', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };
      mockGetModelConfig.mockReturnValue(mockConfig);

      const result = isValidModel('flux1-dev.safetensors');

      expect(result).toBe(true);
    });

    it('should return false when model does not exist', () => {
      mockGetModelConfig.mockReturnValue(undefined);

      const result = isValidModel('non-existent-model.safetensors');

      expect(result).toBe(false);
    });
  });

  describe('getAllModels', () => {
    it('should return all model names from registry', () => {
      const mockModels = ['flux1-dev.safetensors', 'flux1-schnell.safetensors'];
      mockGetAllModelNames.mockReturnValue(mockModels);

      const result = getAllModels();

      expect(result).toEqual(mockModels);
      expect(mockGetAllModelNames).toHaveBeenCalled();
    });
  });

  describe('SD3.5 Mapping Logic', () => {
    describe('ModelResolver.resolveModelFileName', () => {
      let mockComfyApi: any;
      let resolver: ModelResolver;

      beforeEach(() => {
        mockComfyApi = {
          fetchApi: vi.fn(),
        };
        resolver = new ModelResolver(mockComfyApi);
      });

      it('should map stable-diffusion-3.5 to sd35 variant', async () => {
        // Mock server response with SD3.5 models
        const mockServerModels = [
          'sd3.5_large.safetensors',
          'sd3.5_medium.safetensors',
          'flux1-dev.safetensors',
        ];

        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
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
        });

        // Mock getModelsByVariant to return SD3.5 models sorted by priority
        const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
        mockGetModelsByVariant.mockReturnValue(mockSd35Models);

        const result = await resolver.resolveModelFileName('stable-diffusion-3.5');

        expect(result).toBe('sd3.5_large.safetensors');
        expect(mockGetModelsByVariant).toHaveBeenCalledWith('sd35');
      });

      it('should handle direct sd35 variant name', async () => {
        const mockServerModels = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];

        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
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
          ok: true,
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
        });

        // getModelsByVariant should return models sorted by priority (large has higher priority)
        const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
        mockGetModelsByVariant.mockReturnValue(mockSd35Models);

        const result = await resolver.resolveModelFileName('stable-diffusion-3.5');

        expect(result).toBe('sd3.5_large.safetensors'); // Should choose large model due to higher priority
      });

      it('should select available sd3.5_medium.safetensors when large is not available', async () => {
        const mockServerModels = [
          'sd3.5_medium.safetensors', // Only medium model available
          'flux1-dev.safetensors',
        ];

        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
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
        });

        const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
        mockGetModelsByVariant.mockReturnValue(mockSd35Models);

        const result = await resolver.resolveModelFileName('stable-diffusion-3.5');

        expect(result).toBe('sd3.5_medium.safetensors');
      });

      it('should throw ModelNotFound error when no SD3.5 models are available on server', async () => {
        const mockServerModels = [
          'flux1-dev.safetensors', // No SD3.5 models available
          'flux1-schnell.safetensors',
        ];

        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
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
        });

        const mockSd35Models = ['sd3.5_large.safetensors', 'sd3.5_medium.safetensors'];
        mockGetModelsByVariant.mockReturnValue(mockSd35Models);

        const mockError = new Error('Model not found');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.resolveModelFileName('stable-diffusion-3.5')).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: new Error('ModelNotFound'),
          errorType: AgentRuntimeErrorType.ModelNotFound,
          provider: 'comfyui',
        });
      });

      it('should handle other FLUX model variants correctly', async () => {
        const mockServerModels = ['flux1-dev.safetensors', 'flux1-schnell.safetensors'];

        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
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
        });

        const mockDevModels = ['flux1-dev.safetensors'];
        mockGetModelsByVariant.mockReturnValue(mockDevModels);

        const result = await resolver.resolveModelFileName('flux-dev');

        expect(result).toBe('flux1-dev.safetensors');
        expect(mockGetModelsByVariant).toHaveBeenCalledWith('dev');
      });
    });
  });

  describe('ModelResolver Class', () => {
    let mockComfyApi: any;
    let resolver: ModelResolver;

    beforeEach(() => {
      vi.clearAllMocks(); // Clear all mocks including AgentRuntimeError.createImage
      mockComfyApi = {
        fetchApi: vi.fn(),
      };
      resolver = new ModelResolver(mockComfyApi);
      // Reset default mock implementations
      mockGetModelConfig.mockReturnValue(undefined);
      mockGetAllModelNames.mockReturnValue([]);
      mockGetModelsByVariant.mockReturnValue([]);
    });

    describe('getAvailableModelFiles', () => {
      it('should fetch and cache model files from server', async () => {
        const mockModels = ['flux1-dev.safetensors', 'flux1-schnell.safetensors'];
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
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
        });

        const result = await resolver.getAvailableModelFiles();

        expect(result).toEqual(mockModels);
        expect(mockComfyApi.fetchApi).toHaveBeenCalledWith('/object_info');
      });

      it('should return cached models on subsequent calls', async () => {
        const mockModels = ['flux1-dev.safetensors'];
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
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

      it('should handle 401 unauthorized error', async () => {
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        });

        const mockError = new Error('401 error');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.getAvailableModelFiles()).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: { message: 'HTTP 401: Unauthorized' },
          errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
          provider: 'comfyui',
        });
      });

      it('should handle 403 forbidden error', async () => {
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        });

        const mockError = new Error('403 error');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.getAvailableModelFiles()).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: { message: 'HTTP 403: Forbidden' },
          errorType: AgentRuntimeErrorType.PermissionDenied,
          provider: 'comfyui',
        });
      });

      it('should handle other HTTP errors as service unavailable', async () => {
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

        const mockError = new Error('404 error');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.getAvailableModelFiles()).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: { message: 'HTTP 404: Not Found' },
          errorType: AgentRuntimeErrorType.ComfyUIServiceUnavailable,
          provider: 'comfyui',
        });
      });

      it('should handle Response object thrown as error with 401 status', async () => {
        const responseError = new Response('Unauthorized', { status: 401 });
        mockComfyApi.fetchApi.mockRejectedValue(responseError);

        const mockError = new Error('401 error');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.getAvailableModelFiles()).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: { message: 'HTTP 401: Unauthorized' },
          errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
          provider: 'comfyui',
        });
      });

      it('should handle Response object thrown as error with 403 status', async () => {
        const responseError = new Response('Forbidden', { status: 403 });
        mockComfyApi.fetchApi.mockRejectedValue(responseError);

        const mockError = new Error('403 error');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.getAvailableModelFiles()).rejects.toThrow();

        // This covers lines 176-182: Response object with 403 status thrown directly
        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: { message: 'HTTP 403: Forbidden' },
          errorType: AgentRuntimeErrorType.PermissionDenied,
          provider: 'comfyui',
        });
      });

      it('should handle error with Response object as cause (403 status)', async () => {
        const cause = new Response('Forbidden', { status: 403 });
        const error = new Error('Network error');
        (error as any).cause = cause;
        mockComfyApi.fetchApi.mockRejectedValue(error);

        const mockError = new Error('403 error');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.getAvailableModelFiles()).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: { message: 'Network error' },
          errorType: AgentRuntimeErrorType.PermissionDenied,
          provider: 'comfyui',
        });
      });

      it('should handle error with Response object as cause (401 status)', async () => {
        const cause = new Response('Unauthorized', { status: 401 });
        const error = new Error('Network error');
        (error as any).cause = cause;
        mockComfyApi.fetchApi.mockRejectedValue(error);

        const mockError = new Error('401 error');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.getAvailableModelFiles()).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: { message: 'Network error' },
          errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
          provider: 'comfyui',
        });
      });

      it('should throw error when no models are available', async () => {
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              CheckpointLoaderSimple: {
                input: {
                  required: {},
                },
              },
            }),
        });

        const mockError = new Error('No models');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.getAvailableModelFiles()).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: { message: 'No models available on ComfyUI server' },
          errorType: AgentRuntimeErrorType.ModelNotFound,
          provider: 'comfyui',
        });
      });
    });

    describe('transformModelFilesToList', () => {
      it('should transform FLUX model files to list format', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          priority: 1,
          recommendedDtype: 'default',
          variant: 'dev',
        };
        mockGetModelConfig.mockReturnValue(mockConfig);

        const modelFiles = ['flux1-dev.safetensors', 'flux1-schnell.gguf'];
        const result = resolver.transformModelFilesToList(modelFiles);

        expect(result).toEqual([
          { enabled: true, id: 'flux1-dev' },
          { enabled: true, id: 'flux1-schnell' },
        ]);
      });

      it('should filter out non-FLUX models', () => {
        const fluxConfig: ModelConfig = {
          modelFamily: 'FLUX',
          priority: 1,
          recommendedDtype: 'default',
          variant: 'dev',
        };
        const sd3Config: ModelConfig = {
          modelFamily: 'SD3',
          priority: 1,
          recommendedDtype: 'default',
          variant: 'sd35',
        };

        mockGetModelConfig
          .mockReturnValueOnce(fluxConfig)
          .mockReturnValueOnce(sd3Config)
          .mockReturnValueOnce(undefined);

        const modelFiles = [
          'flux1-dev.safetensors',
          'sd3.5_large.safetensors',
          'unknown-model.safetensors',
        ];
        const result = resolver.transformModelFilesToList(modelFiles);

        expect(result).toEqual([{ enabled: true, id: 'flux1-dev' }]);
      });

      it('should handle different file extensions', () => {
        const mockConfig: ModelConfig = {
          modelFamily: 'FLUX',
          priority: 1,
          recommendedDtype: 'default',
          variant: 'dev',
        };
        mockGetModelConfig.mockReturnValue(mockConfig);

        const modelFiles = [
          'flux1-dev.safetensors',
          'flux1-schnell.gguf',
          'flux1-fill.ckpt',
          'flux1-redux.pt',
        ];
        const result = resolver.transformModelFilesToList(modelFiles);

        expect(result).toEqual([
          { enabled: true, id: 'flux1-dev' },
          { enabled: true, id: 'flux1-schnell' },
          { enabled: true, id: 'flux1-fill' },
          { enabled: true, id: 'flux1-redux' },
        ]);
      });
    });

    describe('validateModel', () => {
      beforeEach(() => {
        // Setup default server response
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              CheckpointLoaderSimple: {
                input: {
                  required: {
                    ckpt_name: [['flux1-dev.safetensors', 'sd3.5_large.safetensors']],
                  },
                },
              },
            }),
        });
      });

      it('should return exists: true and actualFileName when model is found', async () => {
        const mockDevModels = ['flux1-dev.safetensors'];
        mockGetModelsByVariant.mockReturnValue(mockDevModels);

        const result = await resolver.validateModel('flux-dev');

        expect(result).toEqual({
          exists: true,
          actualFileName: 'flux1-dev.safetensors',
        });
      });

      it('should return exists: false when model is not found', async () => {
        mockGetModelsByVariant.mockReturnValue([]);

        const result = await resolver.validateModel('non-existent-model');

        expect(result).toEqual({
          exists: false,
        });
      });

      it('should re-throw connection errors', async () => {
        const connectionError = {
          errorType: AgentRuntimeErrorType.ComfyUIServiceUnavailable,
        };

        // Mock the fetchApi to throw a connection error
        mockComfyApi.fetchApi.mockRejectedValue(connectionError);

        await expect(resolver.validateModel('flux-dev')).rejects.toEqual(connectionError);
      });
    });

    describe('resolveModelFileName - Additional Edge Cases', () => {
      beforeEach(() => {
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              CheckpointLoaderSimple: {
                input: {
                  required: {
                    ckpt_name: [['flux1-dev.safetensors', 'sd3.5_large.safetensors']],
                  },
                },
              },
            }),
        });
      });

      it('should handle direct filename on server (backward compatibility)', async () => {
        mockGetModelConfig.mockReturnValue(undefined); // Not in registry

        const result = await resolver.resolveModelFileName('flux1-dev.safetensors');

        expect(result).toBe('flux1-dev.safetensors');
      });

      // Note: The lines 176-182 and 312-343 in modelResolver.ts are covered by existing tests
      // The HTTP 403 error handling is already tested in "should handle 403 forbidden error"
      // The variant config priority sorting is complex to mock correctly due to the call flow
      // but the logic is covered by the overall resolution tests

      it('should handle variant config with priority sorting (lines 312-343)', async () => {
        // Mock model config lookup for a model with variant
        const mockModelConfig: ModelConfig = {
          modelFamily: 'FLUX' as any,
          variant: 'dev',
          priority: 2,
          recommendedDtype: 'default' as any,
        };

        // Mock getModelConfig to return config with variant
        mockGetModelConfig.mockReturnValue(mockModelConfig);

        // Mock server models with multiple variants
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              CheckpointLoaderSimple: {
                input: {
                  required: {
                    ckpt_name: [
                      [
                        'flux1-dev-high-priority.safetensors',
                        'flux1-dev-low-priority.safetensors',
                        'flux1-dev-default.safetensors',
                      ],
                    ],
                  },
                },
              },
            }),
        });

        // Mock getModelConfig for server files to simulate different priorities
        const originalMockGetModelConfig = mockGetModelConfig;
        mockGetModelConfig.mockImplementation((fileName: string) => {
          if (fileName === 'test-model') {
            return mockModelConfig;
          }
          if (fileName === 'flux1-dev-high-priority.safetensors') {
            return {
              variant: 'dev' as const,
              priority: 1,
              modelFamily: 'FLUX' as const,
              recommendedDtype: 'default' as const,
            }; // Higher priority (lower number)
          }
          if (fileName === 'flux1-dev-low-priority.safetensors') {
            return {
              variant: 'dev' as const,
              priority: 5,
              modelFamily: 'FLUX' as const,
              recommendedDtype: 'default' as const,
            }; // Lower priority (higher number)
          }
          if (fileName === 'flux1-dev-default.safetensors') {
            return {
              variant: 'dev' as const,
              priority: 999,
              modelFamily: 'FLUX' as const,
              recommendedDtype: 'default' as const,
            }; // Default priority
          }
          return undefined;
        });

        const result = await resolver.resolveModelFileName('test-model');

        // This covers lines 312-343: variant config priority sorting logic
        // Should choose the file with highest priority (lowest number)
        expect(result).toBe('flux1-dev-high-priority.safetensors');

        // Restore original mock
        mockGetModelConfig.mockImplementation(originalMockGetModelConfig);
      });

      it('should throw error when no match is found', async () => {
        mockGetModelConfig.mockReturnValue(undefined);
        mockGetModelsByVariant.mockReturnValue([]);

        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              CheckpointLoaderSimple: {
                input: {
                  required: {
                    ckpt_name: [['other-model.safetensors']],
                  },
                },
              },
            }),
        });

        const mockError = new Error('Not found');
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          throw mockError;
        });

        await expect(resolver.resolveModelFileName('unknown-model')).rejects.toThrow();

        expect(mockAgentRuntimeErrorCreateImage).toHaveBeenCalledWith({
          error: new Error('ModelNotFound'),
          errorType: AgentRuntimeErrorType.ModelNotFound,
          provider: 'comfyui',
        });
      });
    });

    describe('Coverage Completion Tests', () => {
      beforeEach(() => {
        // Reset all mocks before each test
        mockAgentRuntimeErrorCreateImage.mockReset();
        mockComfyApi.fetchApi.mockReset();
        mockGetModelConfig.mockReset();
        mockGetAllModelNames.mockReset();
        mockGetModelsByVariant.mockReset();
      });

      it('should handle error.cause with 401 status Response object in getAvailableModelFiles', async () => {
        // Create a mock Response object with status 401
        const mockResponse = {
          status: 401,
          statusText: 'Unauthorized',
        };

        // Create error with cause property set to the Response
        const errorWithCause = new Error('Fetch failed');
        (errorWithCause as any).cause = mockResponse;

        mockComfyApi.fetchApi.mockRejectedValue(errorWithCause);

        // Mock AgentRuntimeError.createImage to return an actual error
        const mockAgentError = {
          errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
          provider: 'comfyui',
        };
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          const error = new Error('Mocked agent runtime error') as any;
          error.errorType = mockAgentError.errorType;
          error.provider = mockAgentError.provider;
          throw error;
        });

        // This should trigger lines 192-195: error.cause status handling
        await expect(resolver.getAvailableModelFiles()).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
          provider: 'comfyui',
        });

        expect(mockComfyApi.fetchApi).toHaveBeenCalledWith('/object_info');
      });

      it('should handle error.cause with 403 status Response object in getAvailableModelFiles', async () => {
        // Create a mock Response object with status 403
        const mockResponse = {
          status: 403,
          statusText: 'Forbidden',
        };

        // Create error with cause property set to the Response
        const errorWithCause = new Error('Fetch failed');
        (errorWithCause as any).cause = mockResponse;

        mockComfyApi.fetchApi.mockRejectedValue(errorWithCause);

        // Mock AgentRuntimeError.createImage to return an actual error
        const mockAgentError = {
          errorType: AgentRuntimeErrorType.PermissionDenied,
          provider: 'comfyui',
        };
        mockAgentRuntimeErrorCreateImage.mockImplementation(() => {
          const error = new Error('Mocked agent runtime error') as any;
          error.errorType = mockAgentError.errorType;
          error.provider = mockAgentError.provider;
          throw error;
        });

        // This should trigger lines 196-202: error.cause status 403 handling
        await expect(resolver.getAvailableModelFiles()).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.PermissionDenied,
          provider: 'comfyui',
        });

        expect(mockComfyApi.fetchApi).toHaveBeenCalledWith('/object_info');
      });

      it('should clean modelId by splitting and taking last part in validateModel', async () => {
        // Test the modelId cleaning logic: cleanModelId = modelId.split('/').pop() || modelId;
        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              CheckpointLoaderSimple: {
                input: {
                  required: {
                    ckpt_name: [['cleaned-model.safetensors']],
                  },
                },
              },
            }),
        });

        // The logic cleans the modelId to get just the last part, then checks if that exists on the server
        mockGetModelConfig.mockImplementation((fileName: string) => {
          if (fileName === 'cleaned-model.safetensors')
            return {
              variant: 'dev' as const,
              priority: 1,
              modelFamily: 'FLUX' as const,
              recommendedDtype: 'default' as const,
            };
          return undefined;
        });

        // This should trigger line 235: modelId cleaning logic
        // The input 'comfyui/path/to/cleaned-model.safetensors' should be cleaned to 'cleaned-model.safetensors'
        const result = await resolver.validateModel('comfyui/path/to/cleaned-model.safetensors');

        expect(result).toEqual({
          exists: true,
          actualFileName: 'cleaned-model.safetensors',
        });
      });

      it('should handle priority sorting with default values in resolveModelFileName', async () => {
        // Mock a model config with variant to trigger the priority sorting path
        const mockModelConfig = {
          variant: 'dev' as const,
          priority: 1,
          modelFamily: 'FLUX' as const,
          recommendedDtype: 'default' as const,
        };
        mockGetModelConfig.mockImplementation((fileName: string) => {
          if (fileName === 'priority-test-model') return mockModelConfig;
          // Return configs without priority to test default 999 fallback
          if (fileName === 'no-priority-1.safetensors')
            return {
              variant: 'dev' as const,
              modelFamily: 'FLUX' as const,
              recommendedDtype: 'default' as const,
              priority: undefined as any,
              // no priority field - using undefined to test default 999 fallback
            };
          if (fileName === 'no-priority-2.safetensors')
            return {
              variant: 'dev' as const,
              modelFamily: 'FLUX' as const,
              recommendedDtype: 'default' as const,
              priority: undefined as any,
              // no priority field - using undefined to test default 999 fallback
            };
          return undefined;
        });

        mockGetModelsByVariant.mockReturnValue(['variant-model1', 'variant-model2']);

        mockComfyApi.fetchApi.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              CheckpointLoaderSimple: {
                input: {
                  required: {
                    ckpt_name: [['no-priority-1.safetensors', 'no-priority-2.safetensors']],
                  },
                },
              },
            }),
        });

        // This should trigger lines 330-334: priority sorting with default 999 values
        const result = await resolver.resolveModelFileName('priority-test-model');

        // Both files have default priority 999, should return first one after sorting
        expect(result).toBe('no-priority-1.safetensors');
      });
    });
  });
});
