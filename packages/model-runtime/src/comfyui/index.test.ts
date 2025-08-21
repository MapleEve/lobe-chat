// @vitest-environment node
import { CallWrapper, ComfyApi, PromptBuilder } from '@saintno/comfyui-sdk';
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentRuntimeErrorType } from '@/libs/model-runtime';
import { CreateImagePayload, CreateImageResponse } from '@/libs/model-runtime';
import { ChatModelCard } from '@/types/llm';

import { LobeComfyUI } from '../index';
import { AgentRuntimeError } from '../utils/createError';

// Mock the ComfyUI SDK
vi.mock('@saintno/comfyui-sdk', () => ({
  ComfyApi: vi.fn(),
  CallWrapper: vi.fn(),
  PromptBuilder: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock console.error to avoid polluting test output
vi.spyOn(console, 'error').mockImplementation(() => {});

const provider = 'comfyui';
const bizErrorType = 'ComfyUIBizError';
const emptyResultErrorType = 'ComfyUIEmptyResult';
const serviceUnavailableErrorType = 'ComfyUIServiceUnavailable';
const invalidErrorType = 'InvalidProviderAPIKey';
const modelNotFoundErrorType = 'ModelNotFound';

describe('LobeComfyUI', () => {
  let instance: LobeComfyUI;
  let mockComfyApi: {
    init: Mock;
    waitForReady: Mock;
    getPathImage: Mock;
  };
  let mockCallWrapper: {
    onFinished: Mock;
    onFailed: Mock;
    onProgress: Mock;
    run: Mock;
  };
  let mockPromptBuilder: {
    setOutputNode: Mock;
  };

  beforeEach(() => {
    // Setup ComfyApi mock
    mockComfyApi = {
      init: vi.fn(),
      waitForReady: vi.fn().mockResolvedValue(undefined),
      getPathImage: vi.fn().mockReturnValue('http://localhost:8188/view?filename=test.png'),
    };
    (ComfyApi as any).mockImplementation(() => mockComfyApi);

    // Setup CallWrapper mock
    mockCallWrapper = {
      onFinished: vi.fn().mockReturnThis(),
      onFailed: vi.fn().mockReturnThis(),
      onProgress: vi.fn().mockReturnThis(),
      run: vi.fn(),
    };
    (CallWrapper as Mock).mockImplementation(() => mockCallWrapper);

    // Setup PromptBuilder mock
    mockPromptBuilder = {
      setOutputNode: vi.fn().mockReturnThis(),
    };
    (PromptBuilder as Mock).mockImplementation(() => mockPromptBuilder);

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
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
          // missing password
        });
      }).toThrow();
    });

    it('should throw InvalidProviderAPIKey for missing bearer token', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'bearer',
          // missing apiKey
        });
      }).toThrow();
    });

    it('should accept complete basic auth configuration', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'basic',
          username: 'user',
          password: 'pass',
        });
      }).not.toThrow();
    });

    it('should accept complete bearer auth configuration', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'bearer',
          apiKey: 'test-key',
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
          username: 'testuser',
          password: 'testpass',
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: {
            type: 'basic',
            username: 'testuser',
            password: 'testpass',
          },
        });
      });

      it('should create bearer credentials from authType and apiKey fields', () => {
        instance = new LobeComfyUI({
          authType: 'bearer',
          apiKey: 'my-bearer-token',
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: {
            type: 'bearer_token',
            token: 'my-bearer-token',
          },
        });
      });

      it('should create custom credentials from authType and customHeaders fields', () => {
        instance = new LobeComfyUI({
          authType: 'custom',
          customHeaders: {
            'X-API-Key': 'secret123',
            'Authorization': 'Custom token456',
          },
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: {
            type: 'custom',
            headers: {
              'X-API-Key': 'secret123',
              'Authorization': 'Custom token456',
            },
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

      it('should throw error when required fields are missing for basic auth', () => {
        expect(() => {
          new LobeComfyUI({
            authType: 'basic',
            // Missing username and password
          });
        }).toThrow();
      });

      it('should prioritize new authType over legacy apiKey format', () => {
        instance = new LobeComfyUI({
          authType: 'basic',
          username: 'newuser',
          password: 'newpass',
          apiKey: 'bearer:legacy-token', // This should be ignored
        });

        expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
          credentials: {
            type: 'basic',
            username: 'newuser',
            password: 'newpass',
          },
        });
      });
    });
  });

  describe('Connection validation', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ baseURL: 'http://custom:8188' });
    });

    it('should handle connection failure during createImage', async () => {
      // Mock connection failure
      (global.fetch as Mock).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: { prompt: 'Test connection validation' },
      };

      // Should throw error (ModelNotFound) when trying to resolve model after connection validation
      await expect(instance.createImage(payload)).rejects.toThrow();
    });

    it('should return empty array when connection validation fails in models()', async () => {
      // Mock connection failure
      (global.fetch as Mock).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      // Should return empty array when connection fails (graceful degradation)
      const result = await instance.models();
      expect(result).toEqual([]);
    });

    it('should cache successful connection validation', async () => {
      // Mock successful connection and model files response for BOTH calls in first createImage:
      // 1. ensureConnection() -> getAvailableModelFiles()
      // 2. resolveModelFileName() -> getAvailableModelFiles()
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [['flux_schnell.safetensors']],
                },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [['flux_schnell.safetensors']],
                },
              },
            },
          }),
        });

      // Mock successful image creation
      mockComfyApi.waitForReady.mockResolvedValue(undefined);
      const mockRun = vi.fn().mockImplementation(function (this: any) {
        // Simulate CallWrapper behavior
        setTimeout(
          () =>
            this.onFinishedCallback({
              images: { images: [{ filename: 'test.png', height: 512, width: 512 }] },
            }),
          0,
        );
        return this;
      });
      const mockCallWrapper = {
        onFinished: vi.fn().mockImplementation(function (this: any, callback: any) {
          this.onFinishedCallback = callback;
          return this;
        }),
        onFailed: vi.fn().mockReturnThis(),
        onProgress: vi.fn().mockReturnThis(),
        run: mockRun,
      };
      (CallWrapper as any).mockImplementation(() => mockCallWrapper);

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: { prompt: 'Test caching' },
      };

      // First call - should validate connection (2 fetch calls)
      await instance.createImage(payload);

      // Reset fetch mock to count subsequent calls
      (global.fetch as Mock).mockClear();

      // Mock the fetch call for model resolution in the second call (only 1 call now, connection cached)
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['flux_schnell.safetensors']],
              },
            },
          },
        }),
      });

      // Second call - should use cached connection validation but still needs to resolve models
      await instance.createImage(payload);

      // fetch should be called once for model resolution, but not for connection validation
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication errors during validation', async () => {
      // Mock 401 error
      (global.fetch as Mock).mockRejectedValueOnce({
        status: 401,
        message: 'Unauthorized',
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: { prompt: 'Test auth error' },
      };

      await expect(instance.createImage(payload)).rejects.toThrow();
    });

    it('should validate even with authType=none', async () => {
      instance = new LobeComfyUI({
        baseURL: 'http://secure-server:8188',
        authType: 'none',
      });

      // Mock server requiring authentication despite none config
      (global.fetch as Mock).mockRejectedValueOnce({
        status: 401,
        message: 'Unauthorized',
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: { prompt: 'Test none auth validation' },
      };

      await expect(instance.createImage(payload)).rejects.toThrow();
    });
  });

  describe('createImage()', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should successfully create image with FLUX Schnell model', async () => {
      // Setup available checkpoints
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

      // Setup successful workflow execution
      const mockResult = {
        images: {
          images: [
            {
              filename: 'test.png',
              width: 1024,
              height: 1024,
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
          prompt: 'A beautiful landscape',
          width: 1024,
          height: 1024,
          steps: 4,
        },
      };

      const result = await instance.createImage(payload);

      expect(mockComfyApi.waitForReady).toHaveBeenCalled();
      expect(CallWrapper).toHaveBeenCalled();
      expect(mockCallWrapper.onFinished).toHaveBeenCalled();
      expect(mockCallWrapper.run).toHaveBeenCalled();
      expect(mockComfyApi.getPathImage).toHaveBeenCalledWith({
        filename: 'test.png',
        width: 1024,
        height: 1024,
      });

      expect(result).toEqual({
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 1024,
        height: 1024,
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
              width: 1024,
              height: 1024,
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
          prompt: 'A beautiful landscape',
          width: 1024,
          height: 1024,
          steps: 20,
          cfg: 3.5,
        },
      };

      const result = await instance.createImage(payload);

      expect(result).toEqual({
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 1024,
        height: 1024,
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
              width: 512,
              height: 512,
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
          prompt: 'A beautiful landscape',
          negativePrompt: 'blurry, low quality',
          width: 512,
          height: 512,
          steps: 20,
          cfg: 7,
        },
      };

      const result = await instance.createImage(payload);

      expect(result).toEqual({
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 512,
        height: 512,
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
              width: 1024,
              height: 1024,
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

    it('should fallback to FLUX model when no exact match found', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['flux_something.safetensors', 'other_model.ckpt']],
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
        model: 'comfyui/unknown-model',
        params: {
          prompt: 'Test FLUX fallback',
        },
      };

      await instance.createImage(payload);

      expect(CallWrapper).toHaveBeenCalled();
    });

    it('should fallback to first available model when no FLUX found', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['stable_diffusion.ckpt']],
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
        model: 'comfyui/unknown-model',
        params: {
          prompt: 'Test first model fallback',
        },
      };

      await instance.createImage(payload);

      expect(CallWrapper).toHaveBeenCalled();
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
          prompt: 'Test fallback dimensions',
          width: 512,
          height: 768,
        },
      };

      const result = await instance.createImage(payload);

      expect(result).toEqual({
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 512, // From params
        height: 768, // From params
      });
    });

    it('should fallback to first available model when no exact, fuzzy, or FLUX match is found', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['first_model.ckpt', 'second_model.safetensors']],
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
        model: 'comfyui/some-unknown-model', // A model that won't match anything
        params: {
          prompt: 'Test fallback to first model',
        },
      };

      await instance.createImage(payload);

      // This covers the branch where `if (fluxMatch)` is false.
      // We verify that the generic workflow is called with the *first* model from the list.
      const callArgs = (PromptBuilder as Mock).mock.calls[0];
      const workflow = callArgs[0];
      expect(workflow['1'].inputs.ckpt_name).toBe('first_model.ckpt');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should throw ModelNotFound error when no models available', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [[]], // Empty array
            },
          },
        },
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/unknown-model',
        params: {
          prompt: 'Test no models',
        },
      };

      await expect(instance.createImage(payload)).rejects.toEqual({
        error: {
          model: 'comfyui/unknown-model',
        },
        errorType: modelNotFoundErrorType,
      });
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
        errorType: emptyResultErrorType,
        provider: 'comfyui',
        error: expect.objectContaining({
          message: expect.any(String),
        }),
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
      const mockError = new Error('connect ECONNREFUSED 127.0.0.1:8188');
      mockComfyApi.waitForReady.mockRejectedValueOnce(mockError);

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test connection error',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: serviceUnavailableErrorType,
        provider: 'comfyui',
        error: expect.objectContaining({
          message: expect.any(String),
        }),
      });
    });

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
        errorType: serviceUnavailableErrorType,
        provider: 'comfyui',
        error: expect.objectContaining({
          message: expect.any(String),
        }),
      });
    });

    it('should throw InvalidProviderAPIKey for 401 status with basic auth', async () => {
      const comfyuiWithBasicAuth = new LobeComfyUI({
        baseURL: 'http://localhost:8188',
        authType: 'basic',
        username: 'user',
        password: 'pass',
      });

      const mockError = { status: 401, message: 'Unauthorized' };
      mockComfyApi.waitForReady.mockRejectedValueOnce(mockError);

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test auth error',
        },
      };

      await expect(comfyuiWithBasicAuth.createImage(payload)).rejects.toMatchObject({
        errorType: 'InvalidProviderAPIKey',
        provider: 'comfyui',
        error: expect.objectContaining({
          message: expect.any(String),
        }),
      });
    });

    it('should throw InvalidProviderAPIKey for 401 status with bearer token', async () => {
      const comfyuiWithBearer = new LobeComfyUI({
        baseURL: 'http://localhost:8188',
        authType: 'bearer',
        apiKey: 'invalid-token',
      });

      const mockError = { status: 401, message: 'Unauthorized' };
      mockComfyApi.waitForReady.mockRejectedValueOnce(mockError);

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test bearer auth error',
        },
      };

      await expect(comfyuiWithBearer.createImage(payload)).rejects.toMatchObject({
        errorType: 'InvalidProviderAPIKey',
        provider: 'comfyui',
        error: expect.objectContaining({
          message: expect.any(String),
        }),
      });
    });

    it('should throw PermissionDenied for 403 status', async () => {
      const mockError = { status: 403, message: 'Forbidden' };
      mockComfyApi.waitForReady.mockRejectedValueOnce(mockError);

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test permission error',
        },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        errorType: 'PermissionDenied',
        provider: 'comfyui',
        error: expect.objectContaining({
          message: expect.any(String),
        }),
      });
    });

    it('should throw ComfyUIBizError for server errors', async () => {
      const mockError = { status: 500, message: 'Internal Server Error' };
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
        errorType: serviceUnavailableErrorType,
        provider: 'comfyui',
        error: expect.objectContaining({
          message: expect.any(String),
          status: 500,
        }),
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
        errorType: 'CustomError',
        error: { message: 'Custom error' },
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
      (global.fetch as Mock).mockRejectedValue(new Error('Network timeout'));

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test network error',
        },
      };

      await expect(instance.createImage(payload)).rejects.toEqual({
        error: {
          model: 'comfyui/flux-schnell',
        },
        errorType: modelNotFoundErrorType,
      });
    });

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
        errorType: emptyResultErrorType,
        provider: 'comfyui',
        error: expect.objectContaining({
          message: expect.any(String),
        }),
      });
    });

    it('should throw ModelNotFound error if object_info response is malformed', async () => {
      // Simulate a response missing the CheckpointLoaderSimple key
      const mockMalformedObjectInfo = {
        SomeOtherNode: {},
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockMalformedObjectInfo),
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test malformed object_info',
        },
      };

      // This covers the `objectInfo.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] || []` branch.
      // The optional chain will result in `undefined`, so `modelFiles` becomes `[]`, triggering the error.
      await expect(instance.createImage(payload)).rejects.toEqual({
        error: {
          model: 'comfyui/flux-schnell',
        },
        errorType: modelNotFoundErrorType,
      });
    });
  });

  describe('Workflow Building', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ apiKey: 'test-key' });
    });

    it('should build FLUX Schnell workflow with correct parameters', async () => {
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

      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/flux-schnell',
        params: {
          prompt: 'Test FLUX Schnell workflow',
          width: 1024,
          height: 1024,
          steps: 4,
          seed: 12345,
        },
      };

      await instance.createImage(payload);

      // Verify PromptBuilder was called with correct workflow structure
      const callArgs = (PromptBuilder as Mock).mock.calls[0];
      const workflow = callArgs[0];

      expect(workflow).toHaveProperty('6'); // KSampler node
      expect(workflow['6'].inputs.steps).toBe(4);
      expect(workflow['6'].inputs.seed).toBe(12345);
      expect(workflow['6'].inputs.cfg).toBe(1); // Fixed for Schnell

      expect(workflow).toHaveProperty('5'); // Empty latent
      expect(workflow['5'].inputs.width).toBe(1024);
      expect(workflow['5'].inputs.height).toBe(1024);
    });

    it('should build FLUX Dev workflow with guidance control', async () => {
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
          prompt: 'Test FLUX Dev workflow',
          width: 1024,
          height: 1024,
          steps: 20,
          cfg: 3.5,
        },
      };

      await instance.createImage(payload);

      const callArgs = (PromptBuilder as Mock).mock.calls[0];
      const workflow = callArgs[0];

      expect(workflow).toHaveProperty('9'); // Basic Scheduler
      expect(workflow['9'].inputs.steps).toBe(20);

      expect(workflow).toHaveProperty('5'); // CLIP Text Encode
      expect(workflow['5'].inputs.guidance).toBe(3.5);

      expect(workflow).toHaveProperty('6'); // Flux Guidance
      expect(workflow['6'].inputs.guidance).toBe(3.5);
    });

    it('should build generic SD workflow for non-FLUX models', async () => {
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
          prompt: 'Test SD workflow',
          negativePrompt: 'bad quality',
          width: 512,
          height: 512,
          steps: 20,
          cfg: 7,
        },
      };

      await instance.createImage(payload);

      const callArgs = (PromptBuilder as Mock).mock.calls[0];
      const workflow = callArgs[0];

      expect(workflow).toHaveProperty('1'); // CheckpointLoaderSimple
      expect(workflow['1'].inputs.ckpt_name).toBe('sd_xl_base.safetensors');

      expect(workflow).toHaveProperty('2'); // Positive prompt
      expect(workflow).toHaveProperty('3'); // Negative prompt

      expect(workflow).toHaveProperty('5'); // KSampler
      expect(workflow['5'].inputs.cfg).toBe(7);
      expect(workflow['5'].inputs.steps).toBe(20);
    });

    it('should use default parameters when not provided', async () => {
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

      const callArgs = (PromptBuilder as Mock).mock.calls[0];
      const workflow = callArgs[0];

      // Check defaults are applied
      expect(workflow['5'].inputs.width).toBe(1024); // Default width
      expect(workflow['5'].inputs.height).toBe(1024); // Default height
      expect(workflow['6'].inputs.steps).toBe(4); // Default steps for Schnell
      expect(workflow['6'].inputs.seed).toBe(-1); // Default random seed
    });

    it('should use an empty string for prompt in generic workflow if not provided', async () => {
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

      const callArgs = (PromptBuilder as Mock).mock.calls[0];
      const workflow = callArgs[0];

      // This covers the `params.prompt ?? ''` branch.
      // We expect the positive prompt node to receive an empty string.
      expect(workflow['2'].inputs.text).toBe('');
    });

    it('should fallback to FLUX model when no exact or fuzzy match is found', async () => {
      const mockObjectInfo = {
        CheckpointLoaderSimple: {
          input: {
            required: {
              ckpt_name: [['xyz_checkpoint.ckpt', 'flux_v1.safetensors']],
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
        model: 'comfyui/abc-def-ghi', // Won't match any model keywords but FLUX should be found
        params: {
          prompt: 'Test FLUX fallback when match is found',
        },
      };

      await instance.createImage(payload);

      // This covers the `if (fluxMatch) return fluxMatch;` branch when fluxMatch is truthy
      const callArgs = (PromptBuilder as Mock).mock.calls[0];
      const workflow = callArgs[0];
      expect(workflow['1'].inputs.ckpt_name).toBe('flux_v1.safetensors');
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
    it('should throw error for bearer auth without apiKey', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'bearer',
          // No apiKey provided
        });
      }).toThrow();
    });

    it('should handle custom auth without customHeaders', () => {
      const instance = new LobeComfyUI({
        authType: 'custom',
        // No customHeaders provided
      });
      expect(instance).toBeDefined();
      expect(instance.baseURL).toBe('http://localhost:8188');
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
  });
});
