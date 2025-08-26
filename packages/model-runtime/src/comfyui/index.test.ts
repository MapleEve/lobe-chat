// @vitest-environment node
import { CallWrapper, ComfyApi, PromptBuilder } from '@saintno/comfyui-sdk';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentRuntimeErrorType, CreateImagePayload } from '../index';
import { LobeComfyUI } from '../index';
import { AgentRuntimeError } from '../utils/createError';
import { processModelList } from '../utils/modelParse';
// Error types are now from AgentRuntimeErrorType
import { ModelResolver } from './utils/modelResolver';
import { WorkflowDetector } from './utils/workflowDetector';

// Mock the ComfyUI SDK
vi.mock('@saintno/comfyui-sdk', () => ({
  CallWrapper: vi.fn(),
  ComfyApi: vi.fn(),
  PromptBuilder: vi.fn(),
}));

// Mock the ModelResolver
vi.mock('./utils/modelResolver', () => ({
  ModelResolver: vi.fn(),
}));

// Mock modelResolver functions
vi.mock('./utils/modelResolver', () => ({
  ModelResolver: vi.fn(),
  resolveModel: vi.fn().mockImplementation((modelName: string) => {
    // Return mock config for any model during tests
    return {
      modelFamily: 'FLUX',
      priority: 1,
      recommendedDtype: 'default' as const,
      variant: 'dev' as const,
    };
  }),
  resolveModelStrict: vi.fn().mockImplementation((modelName: string) => {
    // Return mock config for any model during tests
    return {
      modelFamily: 'FLUX',
      priority: 1,
      recommendedDtype: 'default' as const,
      variant: 'dev' as const,
    };
  }),
  isValidModel: vi.fn().mockReturnValue(true),
  getAllModels: vi.fn().mockReturnValue(['flux-schnell.safetensors', 'flux-dev.safetensors']),
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock console.error to avoid polluting test output
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock WorkflowDetector
vi.mock('./utils/workflowDetector', () => ({
  WorkflowDetector: {
    detectModelType: vi.fn(),
  },
}));

// Mock the workflows index that exports all builders
vi.mock('./workflows', () => ({
  buildFluxSchnellWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
  buildFluxDevWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
  buildFluxKontextWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
  buildFluxKreaWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
  buildSD35Workflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
  buildSD35NoClipWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
}));

// Mock individual workflow builders - ensure they always return a valid builder, never null
vi.mock('./workflows/flux-schnell', () => ({
  buildFluxSchnellWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
}));

vi.mock('./workflows/flux-dev', () => ({
  buildFluxDevWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
}));

vi.mock('./workflows/flux-kontext', () => ({
  buildFluxKontextWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
}));

vi.mock('./workflows/flux-krea', () => ({
  buildFluxKreaWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
}));

vi.mock('./workflows/sd35', () => ({
  buildSD35Workflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
}));

vi.mock('./workflows/sd35-no-clip', () => ({
  buildSD35NoClipWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
  })),
}));

// Mock WorkflowRouter before any other imports can load it
vi.mock('./utils/workflowRouter', () => {
  // Create a mock builder factory that always returns a valid workflow
  const createMockBuilder = () => {
    const builder = {
      input: function () {
        return this;
      },
      setInputNode: function () {
        return this;
      },
      setOutputNode: function () {
        return this;
      },
      prompt: {
        '1': {
          _meta: { title: 'Checkpoint Loader' },
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'test.safetensors' },
        },
      },
    };
    return builder;
  };

  class WorkflowRoutingError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'WorkflowRoutingError';
    }
  }

  return {
    WorkflowRouter: {
      getExactlySupportedModels: () => ['comfyui/flux-dev', 'comfyui/flux-schnell'],
      getSupportedFluxVariants: () => ['dev', 'schnell', 'kontext', 'krea'],
      // This must ALWAYS return a valid workflow, never null
      routeWorkflow: () => createMockBuilder(),
    },
    WorkflowRoutingError,
  };
});

// Mock systemComponents
vi.mock('./config/systemComponents', () => ({
  getOptimalComponent: vi.fn().mockImplementation((type: string) => {
    // Return mock components for testing
    if (type === 't5') return 't5xxl_fp16.safetensors';
    if (type === 'vae') return 'ae.safetensors';
    if (type === 'clip') return 'clip_l.safetensors';
    return 'default.safetensors';
  }),
  getAllComponentsWithNames: vi.fn().mockImplementation((options: any) => {
    if (options?.type === 'clip') {
      return [
        { name: 'clip_l.safetensors', config: { priority: 1 } },
        { name: 'clip_g.safetensors', config: { priority: 2 } },
      ];
    }
    if (options?.type === 't5') {
      return [{ name: 't5xxl_fp16.safetensors', config: { priority: 1 } }];
    }
    return [];
  }),
}));

// Mock processModels utility
vi.mock('../utils/modelParse', () => ({
  processModelList: vi.fn(),
  detectModelProvider: vi.fn().mockImplementation((modelId: string) => {
    // Simple implementation for testing
    if (modelId.includes('claude')) return 'anthropic';
    if (modelId.includes('gpt')) return 'openai';
    if (modelId.includes('gemini')) return 'google';
    return 'unknown';
  }),
  MODEL_LIST_CONFIGS: {
    comfyui: {
      id: 'comfyui',
      modelList: [],
    },
  },
}));

const provider = 'comfyui';
const bizErrorType = 'ComfyUIBizError';
const emptyResultErrorType = AgentRuntimeErrorType.ComfyUIEmptyResult;
const serviceUnavailableErrorType = 'ComfyUIServiceUnavailable';
const invalidErrorType = 'InvalidProviderAPIKey';
const modelNotFoundErrorType = 'ModelNotFound';

describe('LobeComfyUI', () => {
  let instance: LobeComfyUI;
  let mockComfyApi: {
    fetchApi: Mock;
    getPathImage: Mock;
    init: Mock;
    waitForReady: Mock;
  };
  let mockCallWrapper: {
    onFailed: Mock;
    onFinished: Mock;
    onProgress: Mock;
    run: Mock;
  };
  let mockPromptBuilder: {
    input: Mock;
    setInputNode: Mock;
    setOutputNode: Mock;
  };
  let mockModelResolver: {
    getAvailableModelFiles: Mock;
    resolveModelFileName: Mock;
    transformModelFilesToList: Mock;
    validateModel: Mock;
  };

  beforeEach(async () => {
    // Clear all mocks first
    vi.clearAllMocks();

    // Setup ComfyApi mock
    mockComfyApi = {
      fetchApi: vi.fn().mockResolvedValue({
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux-schnell.safetensors', 'flux-dev.safetensors', 'sd15-base.ckpt']],
            },
          },
        },
      }),
      getPathImage: vi.fn().mockReturnValue('http://localhost:8188/view?filename=test.png'),
      init: vi.fn(),
      waitForReady: vi.fn().mockResolvedValue(undefined),
    };
    (ComfyApi as any).mockImplementation(() => mockComfyApi);

    // Setup CallWrapper mock with proper async behavior
    mockCallWrapper = {
      onFailed: vi.fn().mockReturnThis(),
      onFinished: vi.fn().mockReturnThis(),
      onProgress: vi.fn().mockReturnThis(),
      run: vi.fn().mockReturnThis(),
    };
    (CallWrapper as Mock).mockImplementation(() => mockCallWrapper);

    // Setup PromptBuilder mock with prompt property
    mockPromptBuilder = {
      input: vi.fn().mockReturnThis(),
      prompt: {},
      setInputNode: vi.fn().mockReturnThis(),
      setOutputNode: vi.fn().mockReturnThis(),
    } as any; // Type assertion needed since mock doesn't match full PromptBuilder interface
    (PromptBuilder as Mock).mockImplementation(() => mockPromptBuilder);

    // Setup ModelResolver mock
    mockModelResolver = {
      getAvailableModelFiles: vi
        .fn()
        .mockResolvedValue(['flux-schnell.safetensors', 'flux-dev.safetensors', 'sd15-base.ckpt']),
      resolveModelFileName: vi.fn().mockImplementation((modelId: string) => {
        // Mock specific failure cases for tests
        if (
          modelId.includes('non-existent') ||
          modelId.includes('unknown') ||
          modelId.includes('non-verified')
        ) {
          return Promise.reject(new Error(`Model not found: ${modelId}`));
        }
        // Default success - return filename based on model ID
        const fileName = modelId.split('/').pop() || modelId;
        return Promise.resolve(fileName + '.safetensors');
      }),
      transformModelFilesToList: vi.fn().mockReturnValue([]),
      validateModel: vi.fn().mockImplementation((modelId: string) => {
        // Mock specific failure cases for tests
        if (
          modelId.includes('non-existent') ||
          modelId.includes('unknown') ||
          modelId.includes('non-verified')
        ) {
          return Promise.resolve({ exists: false });
        }
        // Default success for all other models
        const fileName = modelId.split('/').pop() || modelId;
        return Promise.resolve({ exists: true, actualFileName: fileName + '.safetensors' });
      }),
    };
    (ModelResolver as Mock).mockImplementation(() => mockModelResolver);

    // Setup WorkflowDetector default mock behavior - make it smart about model names
    vi.spyOn(WorkflowDetector, 'detectModelType').mockImplementation((modelFileName: string) => {
      // Determine architecture and variant based on the model filename
      if (modelFileName.includes('flux')) {
        if (modelFileName.includes('dev')) {
          return {
            architecture: 'FLUX',
            isSupported: true,
            variant: 'dev',
          };
        }
        if (modelFileName.includes('schnell')) {
          return {
            architecture: 'FLUX',
            isSupported: true,
            variant: 'schnell',
          };
        }
        // Default FLUX
        return {
          architecture: 'FLUX',
          isSupported: true,
          variant: 'schnell',
        };
      }

      if (modelFileName.includes('sd35')) {
        return {
          architecture: 'SD3' as const,
          isSupported: true,
          variant: 'sd35',
        };
      }

      if (modelFileName.includes('sd') || modelFileName.includes('xl')) {
        return {
          architecture: 'SDXL' as const,
          isSupported: true,
          variant: undefined,
        };
      }

      // Default for other models
      return {
        architecture: 'FLUX',
        isSupported: true,
        variant: 'schnell',
      };
    });

    // Setup processModelList default mock behavior
    vi.mocked(processModelList).mockImplementation(
      async (modelList: any, config: any, provider: any) => {
        return modelList.map((model: any) => ({
          ...model,
          displayName: model.id,
          description: '',
          type: 'chat' as const,
          functionCall: false,
          vision: false,
          reasoning: false,
          maxOutput: undefined,
          contextWindowTokens: undefined,
          releasedAt: undefined,
        }));
      },
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default baseURL and no credentials', () => {
      instance = new LobeComfyUI({});

      expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
        credentials: undefined,
      });
      expect(mockComfyApi.init).toHaveBeenCalled();
      expect(instance.baseURL).toBe('http://localhost:8188');
    });

    it('should throw InvalidComfyUIArgs for incomplete basic auth', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'basic',
          username: 'user',
          // missing password - should throw error
        });
      }).toThrow();

      // Verify it throws the correct error type
      try {
        new LobeComfyUI({
          authType: 'basic',
          username: 'user',
        });
      } catch (error: any) {
        expect(error.errorType).toBe('InvalidComfyUIArgs');
      }
    });

    it('should throw InvalidProviderAPIKey for missing bearer token', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'bearer',
          // missing apiKey - should throw error
        });
      }).toThrow();

      // Verify it throws the correct error type
      try {
        new LobeComfyUI({
          authType: 'bearer',
        });
      } catch (error: any) {
        expect(error.errorType).toBe('InvalidProviderAPIKey');
      }
    });

    it('should accept complete basic auth configuration', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'basic',
          password: 'pass',
          username: 'user',
        });
      }).not.toThrow();
    });

    it('should accept complete bearer auth configuration', () => {
      expect(() => {
        new LobeComfyUI({
          apiKey: 'test-key',
          authType: 'bearer',
        });
      }).not.toThrow();
    });

    it('should initialize with custom baseURL', () => {
      const customBaseURL = 'https://my-comfyui.example.com';
      instance = new LobeComfyUI({ baseURL: customBaseURL });

      expect(ComfyApi).toHaveBeenCalledWith(customBaseURL, undefined, {
        credentials: undefined,
      });
      expect(instance.baseURL).toBe(customBaseURL);
    });

    // Test new ComfyUIKeyVault authentication architecture
    describe('ComfyUIKeyVault Authentication', () => {
      it('should create basic credentials from authType and username/password fields', () => {
        instance = new LobeComfyUI({
          authType: 'basic',
          password: 'testpass',
          username: 'testuser',
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: {
            password: 'testpass',
            type: 'basic',
            username: 'testuser',
          },
        });
      });

      it('should create bearer credentials from authType and apiKey fields', () => {
        instance = new LobeComfyUI({
          apiKey: 'my-bearer-token',
          authType: 'bearer',
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: {
            token: 'my-bearer-token',
            type: 'bearer_token',
          },
        });
      });

      it('should create custom credentials from authType and customHeaders fields', () => {
        instance = new LobeComfyUI({
          authType: 'custom',
          customHeaders: {
            'Authorization': 'Custom token456',
            'X-API-Key': 'secret123',
          },
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: {
            headers: {
              'Authorization': 'Custom token456',
              'X-API-Key': 'secret123',
            },
            type: 'custom',
          },
        });
      });

      it('should handle authType none with no credentials', () => {
        instance = new LobeComfyUI({
          authType: 'none',
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: undefined,
        });
      });

      it('should throw InvalidComfyUIArgs when required fields are missing for basic auth', () => {
        expect(() => {
          new LobeComfyUI({
            authType: 'basic',
            // Missing username and password - should throw error
          });
        }).toThrow();

        // Verify it throws the correct error type
        try {
          new LobeComfyUI({
            authType: 'basic',
          });
        } catch (error: any) {
          expect(error.errorType).toBe('InvalidComfyUIArgs');
        }
      });

      it('should prioritize new authType over legacy apiKey format', () => {
        instance = new LobeComfyUI({
          apiKey: 'bearer:legacy-token',
          authType: 'basic',
          password: 'newpass',
          username: 'newuser', // This should be ignored
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: {
            password: 'newpass',
            type: 'basic',
            username: 'newuser',
          },
        });
      });
    });
  });

  describe('Connection validation', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ baseURL: 'http://custom:8188' });
    });

    it('should throw ModelNotFound error for non-existent model', async () => {
      // Mock model validation to fail for non-existent model
      mockModelResolver.validateModel.mockResolvedValue({
        exists: false,
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/non-existent-model',
        params: { prompt: 'Test model not found' },
      };

      // Should throw ModelNotFound error for non-existent model
      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.any(String),
        }),
        errorType: 'ModelNotFound',
      });

      // Should attempt validation
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/non-existent-model');
    });

    it('should return empty array when connection validation fails in models()', async () => {
      // Mock connection failure
      (global.fetch as Mock).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      // Should return empty array when connection fails (graceful degradation)
      const result = await instance.models();
      expect(result).toEqual([]);
    });

    it('should validate model existence using strict validation', async () => {
      // Mock successful validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      // Mock successful workflow execution
      const mockResult = {
        images: { images: [{ filename: 'test.png', height: 512, width: 512 }] },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: { prompt: 'Test strict validation' },
      };

      const result = await instance.createImage(payload);

      // Should validate model existence
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');

      // Should succeed with valid model
      expect(result).toEqual({
        height: 512,
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 512,
      });
    });

    it('should handle authentication errors during validation', async () => {
      // Mock model resolver to throw auth error
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
      instance = new LobeComfyUI({
        authType: 'none',
        baseURL: 'http://secure-server:8188',
      });

      // Mock model resolver to throw auth error even with none auth
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

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: 'InvalidProviderAPIKey',
      });

      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');
    });
  });

  describe('createImage()', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should successfully create image with FLUX Schnell model', async () => {
      // Mock successful model validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux_schnell.safetensors',
        exists: true,
      });

      // Setup successful workflow execution
      const mockResult = {
        images: {
          images: [
            {
              filename: 'test.png',
              height: 1024,
              width: 1024,
            },
          ],
        },
      };

      // Mock CallWrapper to call onFinished immediately
      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          height: 1024,
          prompt: 'A beautiful landscape',
          steps: 4,
          width: 1024,
        },
      };

      const result = await instance.createImage(payload);

      expect(CallWrapper).toHaveBeenCalled();
      expect(mockCallWrapper.onFinished).toHaveBeenCalled();
      expect(mockCallWrapper.run).toHaveBeenCalled();
      expect(mockComfyApi.getPathImage).toHaveBeenCalledWith({
        filename: 'test.png',
        height: 1024,
        width: 1024,
      });

      expect(result).toEqual({
        height: 1024,
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 1024,
      });
    });

    it('should successfully create image with FLUX Dev model', async () => {
      // Setup available checkpoints
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_dev.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const mockResult = {
        images: {
          images: [
            {
              filename: 'test.png',
              height: 1024,
              width: 1024,
            },
          ],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-dev',
        params: {
          cfg: 3.5,
          height: 1024,
          prompt: 'A beautiful landscape',
          steps: 20,
          width: 1024,
        },
      };

      const result = await instance.createImage(payload);

      expect(result).toEqual({
        height: 1024,
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 1024,
      });
    });

    it('should use generic SD workflow for non-FLUX models', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['stable_diffusion_xl.ckpt']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const mockResult = {
        images: {
          images: [
            {
              filename: 'test.png',
              height: 512,
              width: 512,
            },
          ],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/stable-diffusion-xl',
        params: {
          cfg: 7,
          height: 512,
          negativePrompt: 'blurry, low quality',
          prompt: 'A beautiful landscape',
          steps: 20,
          width: 512,
        },
      };

      const result = await instance.createImage(payload);

      expect(result).toEqual({
        height: 512,
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 512,
      });
    });

    it('should handle exact model matching', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux-schnell.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const mockResult = {
        images: {
          images: [
            {
              filename: 'test.png',
              height: 1024,
              width: 1024,
            },
          ],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test exact matching',
        },
      };

      await instance.createImage(payload);

      expect(CallWrapper).toHaveBeenCalled();
    });

    it('should handle fuzzy model matching with keywords', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['some_flux_model_v1.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const mockResult = {
        images: {
          images: [
            {
              filename: 'test.png',
            },
          ],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-test',
        params: {
          prompt: 'Test fuzzy matching',
        },
      };

      await instance.createImage(payload);

      expect(CallWrapper).toHaveBeenCalled();
    });

    it('should throw error when no exact match found', async () => {
      // Mock validation to fail for unknown model
      mockModelResolver.validateModel.mockResolvedValue({
        exists: false,
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/unknown-model',
        params: {
          prompt: 'Test unknown model',
        },
      };

      // Should throw error for unknown model
      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });

      // Verify validation was attempted
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/unknown-model');
    });

    it('should throw error when model not in verified list', async () => {
      // Mock validation to fail for non-verified model
      const mockValidationManager = {
        validateModelExistence: vi.fn().mockRejectedValue({
          error: { model: 'comfyui/non-verified-model' },
          errorType: AgentRuntimeErrorType.ModelNotFound,
        }),
      };

      // Setup instance with mocked validation
      // Model validation now handled internally

      const payload: CreateImagePayload = {
        model: 'comfyui/non-verified-model',
        params: {
          prompt: 'Test non-verified model',
        },
      };

      // Should throw error for non-verified model
      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });

      // Verify validation was attempted
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/non-verified-model');
    });

    it('should use fallback dimensions when not provided in response', async () => {
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
          images: [
            {
              filename: 'test.png',
              // No width/height provided
            },
          ],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          height: 768,
          prompt: 'Test fallback dimensions',
          width: 512,
        },
      };

      const result = await instance.createImage(payload);

      expect(result).toEqual({
        // From params
        height: 768,

        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 512, // From params
      });
    });

    it('should throw error when no exact, fuzzy, or FLUX match is found', async () => {
      // Mock validation to fail for unknown model
      mockModelResolver.validateModel.mockResolvedValue({
        exists: false,
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/some-unknown-model', // A model that won't match anything
        params: {
          prompt: 'Test unknown model',
        },
      };

      // Expect the validation to throw a ModelNotFound error
      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });

      // Verify validation was attempted
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/some-unknown-model');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should throw ModelNotFound error when validation fails', async () => {
      // Mock validation to fail for unknown model
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

      // Should attempt validation
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/unknown-model');
    });

    it('should throw ComfyUIEmptyResult when no images are generated', async () => {
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

    it('should throw ComfyUIServiceUnavailable for ECONNREFUSED', async () => {
      // Mock ModelResolver.validateModel to throw connection error
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

      // Setup basic mock for models
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

    it('should throw InvalidProviderAPIKey for 401 status with basic auth', async () => {
      const comfyuiWithBasicAuth = new LobeComfyUI({
        authType: 'basic',
        baseURL: 'http://localhost:8188',
        password: 'pass',
        username: 'user',
      });

      // Mock validation to throw auth error
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

      // Mock validation to throw auth error
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
      // Mock validation to throw permission error
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

    it('should throw ComfyUIBizError for server errors', async () => {
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

      // Setup basic mock for models
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

    it('should handle network errors gracefully', async () => {
      // Mock the validateModel to throw network error
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

    it('should throw ComfyUIEmptyResult when result.images is null or undefined', async () => {
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

      // This covers the `result.images?.images ?? []` branch.
      // `result.images` is undefined, so `images` becomes `[]`, and the length check fails.
      await expect(instance.createImage(payload)).rejects.toEqual({
        error: expect.objectContaining({
          message: expect.any(String),
        }),
        errorType: emptyResultErrorType,
        provider: 'comfyui',
      });
    });

    it('should throw ModelNotFound error for validation failure', async () => {
      // Mock validation to throw error for validation failure
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

      // Should attempt validation
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');
    });
  });

  describe('Workflow Building', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should build FLUX Schnell workflow using WorkflowRouter', async () => {
      // Mock successful validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      // Mock WorkflowRouter.routeWorkflow spy
      const mockPromptBuilder = new PromptBuilder(
        {
          '1': {
            _meta: { title: 'Checkpoint Loader' },
            class_type: 'CheckpointLoaderSimple',
            inputs: { ckpt_name: 'flux-schnell.safetensors' },
          },
          '5': {
            _meta: { title: 'Empty Latent Image' },
            class_type: 'EmptyLatentImage',
            inputs: { height: 1024, width: 1024 },
          },
          '6': {
            _meta: { title: 'KSampler' },
            class_type: 'KSampler',
            inputs: { cfg: 1, seed: 12_345, steps: 4 },
          },
        },
        [],
        [],
      );
      // Get the mocked WorkflowRouter and update it to return our mock builder
      const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
      const originalRouteWorkflow = MockedWorkflowRouter.routeWorkflow;
      MockedWorkflowRouter.routeWorkflow = vi.fn().mockReturnValue(mockPromptBuilder);
      const routeWorkflowSpy = MockedWorkflowRouter.routeWorkflow;

      const mockResult = {
        images: {
          images: [{ filename: 'test.png' }],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          height: 1024,
          prompt: 'Test FLUX Schnell workflow',
          seed: 12_345,
          steps: 4,
          width: 1024,
        },
      };

      await instance.createImage(payload);

      // Verify validation was called
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');

      // Verify workflow was built and executed
      expect(mockCallWrapper.run).toHaveBeenCalled();
      expect(routeWorkflowSpy).toHaveBeenCalled();
    });

    it('should build FLUX Dev workflow with guidance control', async () => {
      // Mock successful validation for flux-dev
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux_dev.safetensors',
        exists: true,
      });

      const mockResult = {
        images: {
          images: [{ filename: 'test.png' }],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-dev',
        params: {
          cfg: 3.5,
          height: 1024,
          prompt: 'Test FLUX Dev workflow',
          steps: 20,
          width: 1024,
        },
      };

      await instance.createImage(payload);

      // Verify the workflow was executed
      expect(mockCallWrapper.run).toHaveBeenCalled();
      // Verify validation was called
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-dev');
    });

    it('should build generic SD workflow for non-FLUX models', async () => {
      // Mock validation for SD model
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'sd_xl_base.safetensors',
        exists: true,
      });

      const mockResult = {
        images: {
          images: [{ filename: 'test.png' }],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/sd-xl',
        params: {
          cfg: 7,
          height: 512,
          negativePrompt: 'bad quality',
          prompt: 'Test SD workflow',
          steps: 20,
          width: 512,
        },
      };

      await instance.createImage(payload);

      // Verify the workflow was executed
      expect(mockCallWrapper.run).toHaveBeenCalled();
      // Verify validation was called
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/sd-xl');
    });

    it('should use default parameters when not provided', async () => {
      // Mock validation for flux-schnell
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux_schnell.safetensors',
        exists: true,
      });

      const mockResult = {
        images: {
          images: [{ filename: 'test.png' }],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Minimal parameters test',
        },
      };

      await instance.createImage(payload);

      // Verify the workflow was executed with default parameters
      expect(mockCallWrapper.run).toHaveBeenCalled();
      // Verify validation was called
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');
    });

    it('should use an empty string for prompt in generic workflow if not provided', async () => {
      // Mock validation for SD model
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'sd_xl_base.safetensors',
        exists: true,
      });

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['sd_xl_base.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const mockResult = {
        images: {
          images: [{ filename: 'test.png' }],
        },
      };

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/sd-xl',
        params: {
          prompt: '', // empty prompt to test default value handling
        },
      };

      await instance.createImage(payload);

      // Verify the workflow was executed with empty prompt
      expect(mockCallWrapper.run).toHaveBeenCalled();
      // Verify validation was called
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/sd-xl');
    });

    it('should throw error when model is not in verified list', async () => {
      // Mock validation to fail for non-verified model
      mockModelResolver.validateModel.mockResolvedValue({
        exists: false,
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/abc-def-ghi', // Won't match any verified model
        params: {
          prompt: 'Test non-verified model',
        },
      };

      // Should throw error for non-verified model
      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });

      // Verify validation was attempted
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/abc-def-ghi');
    });
  });

  describe('Progress Handling', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should handle progress callbacks during workflow execution', async () => {
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
          images: [{ filename: 'test.png' }],
        },
      };

      let progressCallback: (info: any) => void;

      mockCallWrapper.onProgress.mockImplementation((callback) => {
        progressCallback = callback;
        return mockCallWrapper;
      });

      mockCallWrapper.run.mockImplementation(() => {
        // Simulate progress updates
        progressCallback({ step: 1, total: 4 });
        progressCallback({ step: 2, total: 4 });
        progressCallback({ step: 3, total: 4 });
        progressCallback({ step: 4, total: 4 });

        // Then finish
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test progress handling',
        },
      };

      await instance.createImage(payload);

      expect(mockCallWrapper.onProgress).toHaveBeenCalled();
    });
  });

  describe('Authentication edge cases', () => {
    it('should throw InvalidProviderAPIKey for bearer auth without apiKey', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'bearer',
          // No apiKey provided - should throw error
        });
      }).toThrow();

      // Verify it throws the correct error type
      try {
        new LobeComfyUI({
          authType: 'bearer',
        });
      } catch (error: any) {
        expect(error.errorType).toBe('InvalidProviderAPIKey');
      }
    });

    it('should throw InvalidComfyUIArgs for custom auth without customHeaders', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'custom',
          // No customHeaders provided - should throw error
        });
      }).toThrow();

      // Verify it throws the correct error type
      try {
        new LobeComfyUI({
          authType: 'custom',
        });
      } catch (error: any) {
        expect(error.errorType).toBe('InvalidComfyUIArgs');
      }
    });

    // Tests to achieve 100% branch coverage of createCredentials method
    describe('createCredentials fallback scenarios', () => {
      it('should throw error when custom auth has no customHeaders', () => {
        expect(() => {
          new LobeComfyUI({
            authType: 'custom',
            // No customHeaders provided - should throw error
          });
        }).toThrow();
      });

      it('should throw error when custom auth has empty customHeaders', () => {
        expect(() => {
          new LobeComfyUI({
            authType: 'custom',
            customHeaders: {}, // Empty object - should throw error
          });
        }).toThrow();
      });

      it('should throw error when custom auth has null customHeaders', () => {
        expect(() => {
          new LobeComfyUI({
            authType: 'custom',
            customHeaders: null as any, // null value - should throw error
          });
        }).toThrow();
      });
    });
  });

  describe('models() edge cases', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ baseURL: 'http://localhost:8188' });
    });

    it('should return empty array when no checkpoint loader available', async () => {
      const mockObjectInfo = {
        // No CheckpointLoaderSimple
        SomeOtherNode: {},
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await instance.models();
      expect(result).toEqual([]);
    });

    it('should return empty array when ckpt_name is not available', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              // No ckpt_name field
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await instance.models();
      expect(result).toEqual([]);
    });

    it('should return empty array when fetch fails', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const result = await instance.models();
      expect(result).toEqual([]);
    });

    it('should handle undefined MODEL_LIST_CONFIGS.comfyui gracefully', async () => {
      // Mock the MODEL_LIST_CONFIGS to not have comfyui config
      const modelParseModule = await import('../utils/modelParse');
      const originalConfig = modelParseModule.MODEL_LIST_CONFIGS.comfyui;

      // Temporarily remove the comfyui config to trigger the fallback
      delete (modelParseModule.MODEL_LIST_CONFIGS as any).comfyui;

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['test-model.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await instance.models();

      // This covers the `MODEL_LIST_CONFIGS.comfyui || {}` fallback branch
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Restore the original config
      (modelParseModule.MODEL_LIST_CONFIGS as any).comfyui = originalConfig;
    });

    it('should successfully return models with comfyui prefix', async () => {
      // Mock successful model file retrieval
      mockModelResolver.getAvailableModelFiles.mockResolvedValue([
        'flux-schnell.safetensors',
        'flux-dev.safetensors',
      ]);
      mockModelResolver.transformModelFilesToList.mockReturnValue([
        { id: 'flux-schnell', name: 'FLUX Schnell' },
        { id: 'flux-dev', name: 'FLUX Dev' },
      ]);

      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux-schnell.safetensors', 'flux-dev.safetensors']],
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      // Mock processModelList to return the models with comfyui prefix
      vi.mocked(processModelList).mockResolvedValue([
        { id: 'comfyui/flux-schnell', displayName: 'FLUX Schnell', type: 'chat' },
        { id: 'comfyui/flux-dev', displayName: 'FLUX Dev', type: 'chat' },
      ] as any);

      const result = await instance.models();

      // This covers lines 131-133: successful model processing and prefixing
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // Verify that all models have the comfyui prefix
      result.forEach((model) => {
        expect(model.id).toMatch(/^comfyui\//);
      });
    });

    it('should return empty array when no model files available', async () => {
      // Mock getAvailableModelFiles to return empty array
      mockModelResolver.getAvailableModelFiles.mockResolvedValue([]);

      const result = await instance.models();

      // This covers lines 120-121: early return when modelFiles.length === 0
      expect(result).toEqual([]);
    });

    it('should propagate AgentRuntimeError from ModelResolver', async () => {
      // Mock getAvailableModelFiles to throw an AgentRuntimeError (normal case)
      mockModelResolver.getAvailableModelFiles.mockRejectedValue(
        AgentRuntimeError.createImage({
          error: { message: 'Connection failed' },
          errorType: AgentRuntimeErrorType.ComfyUIBizError,
          provider: 'comfyui',
        }),
      );

      // The error should be propagated (not caught by lines 136-138)
      await expect(instance.models()).rejects.toThrow();
    });
  });

  describe('Workflow Building - Uncovered Branches', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should throw ModelNotFound when WorkflowDetector returns unsupported model', async () => {
      // Mock successful model validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'unsupported-model.safetensors',
        exists: true,
      });

      // Mock WorkflowDetector to return unsupported model
      vi.spyOn(WorkflowDetector, 'detectModelType').mockReturnValue({
        architecture: 'unknown',
        isSupported: false, // This triggers the uncovered branch at lines 237-241
        variant: undefined,
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/unsupported-model',
        params: {
          prompt: 'Test unsupported model',
        },
      };

      // Should throw ModelNotFound error when model is not supported
      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: {
          error: 'ModelNotFound',
          model: 'comfyui/unsupported-model',
        },
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });

      // Verify validation and detection were called
      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/unsupported-model');
      expect(WorkflowDetector.detectModelType).toHaveBeenCalledWith(
        'unsupported-model.safetensors',
      );
    });

    it('should map WorkflowError to ComfyUIWorkflowError through error mapping system', async () => {
      // Mock successful model validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      // Mock WorkflowDetector to return supported model
      vi.spyOn(WorkflowDetector, 'detectModelType').mockReturnValue({
        architecture: 'FLUX',
        isSupported: true,
        variant: 'schnell',
      });

      // Create a WorkflowError (internal error) that WorkflowRouter now throws
      const { WorkflowError } = await import('./errors');
      const workflowError = new WorkflowError(
        'Workflow routing failed',
        WorkflowError.Reasons.UNSUPPORTED_MODEL,
        { modelId: 'flux-schnell' },
      );

      // Get the mocked WorkflowRouter
      const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');

      // Override the routeWorkflow to throw WorkflowError (internal error)
      MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
        throw workflowError;
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test workflow error',
        },
      };

      // Should map WorkflowError to AgentRuntimeError through the error mapping system
      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound, // UNSUPPORTED_MODEL maps to ModelNotFound
        provider: 'comfyui',
      });

      // Verify the workflow router was called
      expect(MockedWorkflowRouter.routeWorkflow).toHaveBeenCalled();
    });

    it('should map generic errors to ComfyUIBizError through error mapping system', async () => {
      // Mock successful model validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

      // Mock WorkflowDetector to return supported model
      vi.spyOn(WorkflowDetector, 'detectModelType').mockReturnValue({
        architecture: 'FLUX',
        isSupported: true,
        variant: 'schnell',
      });

      // Create a generic error (not a ComfyUI internal error)
      const genericError = new Error('Generic workflow error');

      // Get the mocked WorkflowRouter
      const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');

      // Override the routeWorkflow to throw generic error
      MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
        throw genericError;
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test generic workflow error',
        },
      };

      // Should map generic error to ComfyUIBizError through the error mapping system
      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: {
          message: 'Generic workflow error',
        },
        errorType: AgentRuntimeErrorType.ComfyUIBizError,
        provider: 'comfyui',
      });

      // Verify the workflow router was called
      expect(MockedWorkflowRouter.routeWorkflow).toHaveBeenCalled();
    });
  });

  describe('Error Mapping System Tests', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    describe('ConfigError mapping', () => {
      it('should map ConfigError.INVALID_CONFIG to ComfyUIBizError', async () => {
        // Mock successful model validation
        mockModelResolver.validateModel.mockResolvedValue({
          actualFileName: 'flux-dev.safetensors',
          exists: true,
        });

        const { ConfigError } = await import('./errors');
        const configError = new ConfigError(
          'Invalid configuration',
          ConfigError.Reasons.INVALID_CONFIG,
          { config: 'test' },
        );

        // Mock WorkflowRouter to throw ConfigError
        const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
        MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
          throw configError;
        });

        const payload: CreateImagePayload = {
          model: 'comfyui/flux-dev',
          params: { prompt: 'Test config error mapping' },
        };

        await expect(instance.createImage(payload)).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.ComfyUIBizError,
          provider: 'comfyui',
          error: expect.objectContaining({
            message: 'Invalid configuration',
            details: { config: 'test' },
          }),
        });
      });

      it('should map ConfigError.MISSING_CONFIG to ComfyUIBizError', async () => {
        mockModelResolver.validateModel.mockResolvedValue({
          actualFileName: 'flux-dev.safetensors',
          exists: true,
        });

        const { ConfigError } = await import('./errors');
        const configError = new ConfigError(
          'Missing configuration',
          ConfigError.Reasons.MISSING_CONFIG,
        );

        const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
        MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
          throw configError;
        });

        const payload: CreateImagePayload = {
          model: 'comfyui/flux-dev',
          params: { prompt: 'Test missing config error' },
        };

        await expect(instance.createImage(payload)).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.ComfyUIBizError,
          provider: 'comfyui',
        });
      });
    });

    describe('WorkflowError mapping', () => {
      it('should map WorkflowError.INVALID_CONFIG to ComfyUIWorkflowError', async () => {
        mockModelResolver.validateModel.mockResolvedValue({
          actualFileName: 'flux-dev.safetensors',
          exists: true,
        });

        const { WorkflowError } = await import('./errors');
        const workflowError = new WorkflowError(
          'Invalid workflow configuration',
          WorkflowError.Reasons.INVALID_CONFIG,
          { workflow: 'flux-dev' },
        );

        const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
        MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
          throw workflowError;
        });

        const payload: CreateImagePayload = {
          model: 'comfyui/flux-dev',
          params: { prompt: 'Test workflow config error' },
        };

        await expect(instance.createImage(payload)).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.ComfyUIWorkflowError,
          provider: 'comfyui',
          error: expect.objectContaining({
            message: 'Invalid workflow configuration',
            details: { workflow: 'flux-dev' },
          }),
        });
      });

      it('should map WorkflowError.MISSING_COMPONENT to ComfyUIModelError', async () => {
        mockModelResolver.validateModel.mockResolvedValue({
          actualFileName: 'flux-dev.safetensors',
          exists: true,
        });

        const { WorkflowError } = await import('./errors');
        const workflowError = new WorkflowError(
          'Missing required component',
          WorkflowError.Reasons.MISSING_COMPONENT,
          { component: 'encoder' },
        );

        const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
        MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
          throw workflowError;
        });

        const payload: CreateImagePayload = {
          model: 'comfyui/flux-dev',
          params: { prompt: 'Test missing component error' },
        };

        await expect(instance.createImage(payload)).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.ComfyUIModelError,
          provider: 'comfyui',
        });
      });

      it('should map WorkflowError.INVALID_PARAMS to ComfyUIWorkflowError', async () => {
        mockModelResolver.validateModel.mockResolvedValue({
          actualFileName: 'flux-dev.safetensors',
          exists: true,
        });

        const { WorkflowError } = await import('./errors');
        const workflowError = new WorkflowError(
          'Invalid parameters provided',
          WorkflowError.Reasons.INVALID_PARAMS,
          { params: ['width', 'height'] },
        );

        const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
        MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
          throw workflowError;
        });

        const payload: CreateImagePayload = {
          model: 'comfyui/flux-dev',
          params: { prompt: 'Test invalid params error' },
        };

        await expect(instance.createImage(payload)).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.ComfyUIWorkflowError,
          provider: 'comfyui',
        });
      });
    });

    describe('UtilsError mapping', () => {
      it('should map UtilsError.CONNECTION_ERROR to ComfyUIServiceUnavailable', async () => {
        mockModelResolver.validateModel.mockResolvedValue({
          actualFileName: 'flux-dev.safetensors',
          exists: true,
        });

        const { UtilsError } = await import('./errors');
        const utilsError = new UtilsError(
          'Connection failed',
          UtilsError.Reasons.CONNECTION_ERROR,
          { url: 'http://localhost:8188' },
        );

        const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
        MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
          throw utilsError;
        });

        const payload: CreateImagePayload = {
          model: 'comfyui/flux-dev',
          params: { prompt: 'Test connection error' },
        };

        await expect(instance.createImage(payload)).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.ComfyUIServiceUnavailable,
          provider: 'comfyui',
        });
      });

      it('should map UtilsError.INVALID_API_KEY to InvalidProviderAPIKey', async () => {
        mockModelResolver.validateModel.mockResolvedValue({
          actualFileName: 'flux-dev.safetensors',
          exists: true,
        });

        const { UtilsError } = await import('./errors');
        const utilsError = new UtilsError('Invalid API key', UtilsError.Reasons.INVALID_API_KEY);

        const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
        MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
          throw utilsError;
        });

        const payload: CreateImagePayload = {
          model: 'comfyui/flux-dev',
          params: { prompt: 'Test API key error' },
        };

        await expect(instance.createImage(payload)).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
          provider: 'comfyui',
        });
      });
    });

    describe('Unknown error mapping', () => {
      it('should map unknown internal error reasons to default error types', async () => {
        mockModelResolver.validateModel.mockResolvedValue({
          actualFileName: 'flux-dev.safetensors',
          exists: true,
        });

        const { WorkflowError } = await import('./errors');
        // Create an error with an unknown reason (not in the mapping)
        const workflowError = new WorkflowError(
          'Unknown workflow issue',
          'UNKNOWN_REASON' as any, // Using unknown reason
          { unknown: true },
        );

        const { WorkflowRouter: MockedWorkflowRouter } = await import('./utils/workflowRouter');
        MockedWorkflowRouter.routeWorkflow = vi.fn(() => {
          throw workflowError;
        });

        const payload: CreateImagePayload = {
          model: 'comfyui/flux-dev',
          params: { prompt: 'Test unknown error mapping' },
        };

        // Should fall back to default ComfyUIWorkflowError for WorkflowError
        await expect(instance.createImage(payload)).rejects.toMatchObject({
          errorType: AgentRuntimeErrorType.ComfyUIWorkflowError,
          provider: 'comfyui',
        });
      });
    });
  });

  describe('Coverage Completion Tests', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should throw "Invalid response from ComfyUI server" when getAvailableModelFiles returns non-array', async () => {
      // Mock getAvailableModelFiles to return non-array value to trigger line 86-87
      // This should trigger the ensureConnection method during models() call
      mockModelResolver.getAvailableModelFiles.mockResolvedValue('not an array' as any);

      // Reset the connection validation flag to force ensureConnection to run
      (instance as any).connectionValidated = false;

      // This should trigger the ensureConnection method during models() which checks if Array.isArray(models)
      await expect(instance.models()).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('Invalid response from ComfyUI server'),
        }),
        errorType: expect.any(String),
        provider: 'comfyui',
      });

      expect(mockModelResolver.getAvailableModelFiles).toHaveBeenCalled();
    });

    it('should log error and return empty array when models() method encounters unexpected error', async () => {
      // Mock console.log to track log calls (since log function is mocked to console.error)
      const consoleErrorSpy = vi.spyOn(console, 'error');

      // Mock getAvailableModelFiles to succeed first (for ensureConnection)
      mockModelResolver.getAvailableModelFiles
        .mockResolvedValueOnce(['flux-schnell.safetensors']) // for ensureConnection
        .mockRejectedValueOnce(new Error('Unexpected server error')); // for models() method

      // This should trigger lines 136-138: catch block in models() method
      const result = await instance.models();

      expect(result).toEqual([]);
      // The error should be logged (even though our test mocks console.error)
      expect(mockModelResolver.getAvailableModelFiles).toHaveBeenCalledTimes(2);
    });

    it('should handle custom authType with empty customHeaders validation', () => {
      // This test covers constructor validation that should throw
      expect(() => {
        new LobeComfyUI({
          authType: 'custom',
          customHeaders: {}, // Empty object should trigger error
        });
      }).toThrow();
    });
  });
});
