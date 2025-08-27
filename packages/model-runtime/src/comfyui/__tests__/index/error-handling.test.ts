// @vitest-environment node
import { CallWrapper, ComfyApi, PromptBuilder } from '@saintno/comfyui-sdk';
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateImagePayload, LobeComfyUI } from '../../index';
import { AgentRuntimeErrorType } from '../../../error';
import { AgentRuntimeError } from '../../../utils/createError';
import { WorkflowDetector } from '../../utils/workflowDetector';
import {
  createMockComfyApi,
  createMockCallWrapper,
  createMockPromptBuilder,
  createMockModelResolver,
} from '../helpers/testSetup';

// Mock the ComfyUI SDK
vi.mock('@saintno/comfyui-sdk', () => ({
  CallWrapper: vi.fn(),
  ComfyApi: vi.fn(),
  PromptBuilder: vi.fn(),
}));

// Mock the ModelResolver with complete export structure
vi.mock('../../utils/modelResolver', () => ({
  ModelResolver: vi.fn().mockImplementation(() => createMockModelResolver()),
  resolveModel: vi.fn(),
  resolveModelStrict: vi.fn(),
  isValidModel: vi.fn(),
  getAllModels: vi.fn(),
  ModelResolverError: Error,
}));

const provider = 'comfyui';
const bizErrorType = 'ComfyUIBizError';
const emptyResultErrorType = AgentRuntimeErrorType.ComfyUIEmptyResult;
const serviceUnavailableErrorType = 'ComfyUIServiceUnavailable';
const modelNotFoundErrorType = 'ModelNotFound';

describe('LobeComfyUI - Error Handling', () => {
  let instance: LobeComfyUI;
  let mockComfyApi: ReturnType<typeof createMockComfyApi>;
  let mockCallWrapper: ReturnType<typeof createMockCallWrapper>;
  let mockPromptBuilder: ReturnType<typeof createMockPromptBuilder>;
  let mockModelResolver: ReturnType<typeof createMockModelResolver>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create fresh mock instances for test-specific customization
    mockComfyApi = createMockComfyApi();
    mockCallWrapper = createMockCallWrapper();
    mockPromptBuilder = createMockPromptBuilder();
    mockModelResolver = createMockModelResolver();

    // Mock ComfyApi constructor to return our mock instance
    (ComfyApi as unknown as Mock).mockImplementation(() => mockComfyApi as any);
    (CallWrapper as unknown as Mock).mockImplementation(() => mockCallWrapper as any);
    (PromptBuilder as unknown as Mock).mockImplementation(() => mockPromptBuilder as any);

    // ModelResolver is already mocked at the top level, but we can refresh the mock if needed

    // Mock global fetch
    global.fetch = vi.fn() as Mock;

    vi.spyOn(WorkflowDetector, 'detectModelType').mockImplementation(() => ({
      architecture: 'FLUX',
      isSupported: true,
      variant: 'schnell',
    }));

    instance = new LobeComfyUI({ apiKey: 'test-key' });
    
    // Replace the instance's modelResolver with our mock
    (instance as any).modelResolver = mockModelResolver;
  });

  describe('Model Validation Errors', () => {
    it('should throw ModelNotFound error when validation fails', async () => {
      mockModelResolver.validateModel.mockResolvedValue({
        exists: false,
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/unknown-model',
        params: {
          prompt: 'Test no models',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: modelNotFoundErrorType,
      });

      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/unknown-model');
    });

    it('should handle authentication errors during validation', async () => {
      mockModelResolver.validateModel.mockRejectedValue(
        AgentRuntimeError.createImage({
          error: {
            message: 'Unauthorized',
            status: 401,
          },
          errorType: 'InvalidProviderAPIKey',
          provider: 'comfyui',
        }),
      );

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: { prompt: 'Test auth error' },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: 'InvalidProviderAPIKey',
      });

      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');
    });

    it('should validate even with authType=none', async () => {
      const noneAuthInstance = new LobeComfyUI({
        authType: 'none',
        baseURL: 'http://secure-server:8188',
      });
      
      // Replace the instance's modelResolver with our mock
      (noneAuthInstance as any).modelResolver = mockModelResolver;

      mockModelResolver.validateModel.mockRejectedValue(
        AgentRuntimeError.createImage({
          error: {
            message: 'Unauthorized',
            status: 401,
          },
          errorType: 'InvalidProviderAPIKey',
          provider: 'comfyui',
        }),
      );

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: { prompt: 'Test none auth validation' },
      };

      await expect(noneAuthInstance.createImage(payload)).rejects.toMatchObject({
        errorType: 'InvalidProviderAPIKey',
      });

      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');
    });
  });

  describe('Workflow Execution Errors', () => {
    it('should throw ComfyUIEmptyResult when no images are generated', async () => {
      // Mock successful validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_schnell.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const mockResult = {
        images: {
          images: [], // Empty images array
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test no images generated',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.any(String),
        }),
        errorType: emptyResultErrorType,
        provider: 'comfyui',
      });
    });

    it('should throw ComfyUIBizError when workflow fails', async () => {
      // Mock successful validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_schnell.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const workflowError = new Error('Workflow execution failed');

      mockCallWrapper.run.mockImplementation(() => {
        const failCallback = mockCallWrapper.onFailed.mock.calls[0][0];
        failCallback(workflowError);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test workflow failure',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.any(String),
        }),
        errorType: bizErrorType,
        provider: 'comfyui',
      });
    });

    it('should throw ComfyUIEmptyResult when result.images is null or undefined', async () => {
      // Mock successful validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_schnell.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      // Simulate a workflow result where the 'images' key is missing
      const mockResultWithMissingImages = {};

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResultWithMissingImages);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test missing images key',
        },
      };

      await expect(instance.createImage(payload)).rejects.toEqual({
        error: expect.objectContaining({
          message: expect.any(String),
        }),
        errorType: emptyResultErrorType,
        provider: 'comfyui',
      });
    });
  });

  describe('Connection and Network Errors', () => {
    it('should throw ComfyUIServiceUnavailable for ECONNREFUSED', async () => {
      mockModelResolver.validateModel.mockRejectedValueOnce(
        AgentRuntimeError.createImage({
          error: new Error('connect ECONNREFUSED 127.0.0.1:8188'),
          errorType: serviceUnavailableErrorType,
          provider: 'comfyui',
        }),
      );

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test connection error',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: serviceUnavailableErrorType,
        provider: 'comfyui',
      });
    }, 10000);

    it('should throw ComfyUIServiceUnavailable for fetch failed', async () => {
      // Mock successful validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      const mockError = new Error('fetch failed');
      mockCallWrapper.run.mockImplementation(() => {
        const failCallback = mockCallWrapper.onFailed.mock.calls[0][0];
        failCallback(mockError);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test fetch error',
        },
      };

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_schnell.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.any(String),
        }),
        errorType: serviceUnavailableErrorType,
        provider: 'comfyui',
      });
    });

    it('should handle network errors gracefully', async () => {
      mockModelResolver.validateModel.mockRejectedValue(new Error('Network timeout'));

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test network error',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: 'Network timeout',
        }),
        errorType: expect.any(String),
      });

      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');
    }, 5000);
  });

  describe('Authentication Errors', () => {
    it('should throw InvalidProviderAPIKey for 401 status with basic auth', async () => {
      const comfyuiWithBasicAuth = new LobeComfyUI({
        authType: 'basic',
        baseURL: 'http://localhost:8188',
        password: 'pass',
        username: 'user',
      });
      
      // Replace the instance's modelResolver with our mock
      (comfyuiWithBasicAuth as any).modelResolver = mockModelResolver;

      mockModelResolver.validateModel.mockRejectedValueOnce(
        AgentRuntimeError.createImage({
          error: { message: 'Unauthorized', status: 401 },
          errorType: 'InvalidProviderAPIKey',
          provider: 'comfyui',
        }),
      );

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test auth error',
        },
      };

      await expect(comfyuiWithBasicAuth.createImage(payload)).rejects.toMatchObject({
        errorType: 'InvalidProviderAPIKey',
        provider: 'comfyui',
      });
    }, 10000);

    it('should throw InvalidProviderAPIKey for 401 status with bearer token', async () => {
      const comfyuiWithBearer = new LobeComfyUI({
        apiKey: 'invalid-token',
        authType: 'bearer',
        baseURL: 'http://localhost:8188',
      });
      
      // Replace the instance's modelResolver with our mock
      (comfyuiWithBearer as any).modelResolver = mockModelResolver;

      mockModelResolver.validateModel.mockRejectedValueOnce(
        AgentRuntimeError.createImage({
          error: { message: 'Unauthorized', status: 401 },
          errorType: 'InvalidProviderAPIKey',
          provider: 'comfyui',
        }),
      );

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test bearer auth error',
        },
      };

      await expect(comfyuiWithBearer.createImage(payload)).rejects.toMatchObject({
        errorType: 'InvalidProviderAPIKey',
        provider: 'comfyui',
      });
    }, 10000);

    it('should throw PermissionDenied for 403 status', async () => {
      mockModelResolver.validateModel.mockRejectedValueOnce(
        AgentRuntimeError.createImage({
          error: { message: 'Forbidden', status: 403 },
          errorType: 'PermissionDenied',
          provider: 'comfyui',
        }),
      );

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test permission error',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: 'PermissionDenied',
        provider: 'comfyui',
      });
    }, 10000);
  });

  describe('Server Errors', () => {
    it('should throw ComfyUIServiceUnavailable for server errors', async () => {
      // Mock successful validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      const mockError = { message: 'Internal Server Error', status: 500 };
      mockCallWrapper.run.mockImplementation(() => {
        const failCallback = mockCallWrapper.onFailed.mock.calls[0][0];
        failCallback(mockError);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test server error',
        },
      };

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_schnell.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.any(String),
          status: 500,
        }),
        errorType: serviceUnavailableErrorType,
        provider: 'comfyui',
      });
    });

    it('should re-throw existing AgentRuntimeError', async () => {
      // Mock successful validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_schnell.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const existingError = {
        error: { message: 'Custom error' },
        errorType: 'CustomError',
      };

      mockCallWrapper.run.mockImplementation(() => {
        const failCallback = mockCallWrapper.onFailed.mock.calls[0][0];
        failCallback(existingError);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test existing error',
        },
      };

      await expect(instance.createImage(payload)).rejects.toEqual(existingError);
    });

    it('should throw ModelNotFound error for validation failure', async () => {
      mockModelResolver.validateModel.mockRejectedValue(
        AgentRuntimeError.createImage({
          error: {
            message: 'Validation failed: server response malformed',
            model: 'comfyui/flux-schnell',
          },
          errorType: modelNotFoundErrorType,
          provider: 'comfyui',
        }),
      );

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test validation failure',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: modelNotFoundErrorType,
      });

      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');
    });
  });
});