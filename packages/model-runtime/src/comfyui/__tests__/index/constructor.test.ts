// @vitest-environment node
import { ComfyApi } from '@saintno/comfyui-sdk';
import { beforeEach, describe, expect, it, vi, Mock } from 'vitest';

import { LobeComfyUI } from '../../index';
import { createMockComfyApi } from '../helpers/testSetup';

// Mock the ComfyUI SDK
vi.mock('@saintno/comfyui-sdk', () => ({
  CallWrapper: vi.fn(),
  ComfyApi: vi.fn(),
  PromptBuilder: vi.fn(),
}));

// Mock the ModelResolver
vi.mock('../../utils/modelResolver', () => ({
  ModelResolver: vi.fn(),
  getAllModels: vi.fn().mockReturnValue(['flux-schnell.safetensors', 'flux-dev.safetensors']),
  isValidModel: vi.fn().mockReturnValue(true),
  resolveModel: vi.fn().mockImplementation((_modelName: string) => {
    return {
      modelFamily: 'FLUX',
      priority: 1,
      recommendedDtype: 'default' as const,
      variant: 'dev' as const,
    };
  }),
  resolveModelStrict: vi.fn().mockImplementation((_modelName: string) => {
    return {
      modelFamily: 'FLUX',
      priority: 1,
      recommendedDtype: 'default' as const,
      variant: 'dev' as const,
    };
  }),
}));

// Mock WorkflowDetector
vi.mock('../../utils/workflowDetector', () => ({
  WorkflowDetector: {
    detectModelType: vi.fn(),
  },
}));

// Mock the workflows
vi.mock('../../workflows', () => ({
  buildFluxDevWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
  })),
  buildFluxKontextWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
  })),
  buildFluxKreaWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
  })),
  buildFluxSchnellWorkflow: vi.fn().mockImplementation(() => ({
    input: vi.fn().mockReturnThis(),
    prompt: {
      '1': {
        _meta: { title: 'Checkpoint Loader' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: 'test.safetensors' },
      },
    },
    setInputNode: vi.fn().mockReturnThis(),
    setOutputNode: vi.fn().mockReturnThis(),
  })),
}));

// Mock WorkflowRouter
vi.mock('../../utils/workflowRouter', () => ({
  WorkflowRouter: {
    getExactlySupportedModels: () => ['comfyui/flux-dev', 'comfyui/flux-schnell'],
    getSupportedFluxVariants: () => ['dev', 'schnell', 'kontext', 'krea'],
    routeWorkflow: () => ({
      input: vi.fn().mockReturnThis(),
      prompt: {
        '1': {
          _meta: { title: 'Checkpoint Loader' },
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'test.safetensors' },
        },
      },
      setInputNode: vi.fn().mockReturnThis(),
      setOutputNode: vi.fn().mockReturnThis(),
    }),
  },
  WorkflowRoutingError: class extends Error {
    constructor(message?: string) {
      super(message);
      this.name = 'WorkflowRoutingError';
    }
  },
}));

// Mock systemComponents
vi.mock('../../config/systemComponents', () => ({
  getAllComponentsWithNames: vi.fn().mockImplementation((options: any) => {
    if (options?.type === 'clip') {
      return [
        { config: { priority: 1 }, name: 'clip_l.safetensors' },
        { config: { priority: 2 }, name: 'clip_g.safetensors' },
      ];
    }
    if (options?.type === 't5') {
      return [{ config: { priority: 1 }, name: 't5xxl_fp16.safetensors' }];
    }
    return [];
  }),
  getOptimalComponent: vi.fn().mockImplementation((type: string, _modelFamily: string) => {
    if (type === 't5') return 't5xxl_fp16.safetensors';
    if (type === 'vae') return 'ae.safetensors';
    if (type === 'clip') return 'clip_l.safetensors';
    return 'default.safetensors';
  }),
}));

// Mock processModels utility
vi.mock('../../utils/modelParse', () => ({
  MODEL_LIST_CONFIGS: {
    comfyui: {
      id: 'comfyui',
      modelList: [],
    },
  },
  detectModelProvider: vi.fn().mockImplementation((modelId: string) => {
    if (modelId.includes('claude')) return 'anthropic';
    if (modelId.includes('gpt')) return 'openai';
    if (modelId.includes('gemini')) return 'google';
    return 'unknown';
  }),
  processModelList: vi.fn(),
}));

// Mock console.error to avoid polluting test output
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('LobeComfyUI - Constructor', () => {
  let mockComfyApi: ReturnType<typeof createMockComfyApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockComfyApi = createMockComfyApi();
    // Mock ComfyApi constructor to return our mock instance
    (ComfyApi as unknown as Mock).mockImplementation(() => mockComfyApi as any);
  });

  describe('Basic Configuration', () => {
    it('should initialize with default baseURL and no credentials', () => {
      const _instance = new LobeComfyUI({});

      expect(ComfyApi).toHaveBeenCalledWith('http://localhost:8188', undefined, {
        credentials: undefined,
      });
      expect(mockComfyApi.init).toHaveBeenCalled();
      expect(_instance.baseURL).toBe('http://localhost:8188');
    });

    it('should initialize with custom baseURL', () => {
      const customBaseURL = 'https://my-comfyui.example.com';
      const _instance = new LobeComfyUI({ baseURL: customBaseURL });

      expect(ComfyApi).toHaveBeenCalledWith(customBaseURL, undefined, {
        credentials: undefined,
      });
      expect(_instance.baseURL).toBe(customBaseURL);
    });
  });

  describe('Basic Auth Validation', () => {
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

    it('should accept complete basic auth configuration', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'basic',
          password: 'pass',
          username: 'user',
        });
      }).not.toThrow();
    });
  });

  describe('Bearer Auth Validation', () => {
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

    it('should accept complete bearer auth configuration', () => {
      expect(() => {
        new LobeComfyUI({
          apiKey: 'test-key',
          authType: 'bearer',
        });
      }).not.toThrow();
    });
  });

  describe('ComfyUIKeyVault Authentication', () => {
    it('should create basic credentials from authType and username/password fields', () => {
      const _instance = new LobeComfyUI({
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
      const _instance = new LobeComfyUI({
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
      const _instance = new LobeComfyUI({
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
      const _instance = new LobeComfyUI({
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

      try {
        new LobeComfyUI({
          authType: 'basic',
        });
      } catch (error: any) {
        expect(error.errorType).toBe('InvalidComfyUIArgs');
      }
    });

    it('should prioritize new authType over legacy apiKey format', () => {
      const _instance = new LobeComfyUI({
        apiKey: 'bearer:legacy-token',
        authType: 'basic',
        password: 'newpass',
        username: 'newuser',
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

  describe('Authentication Edge Cases', () => {
    it('should throw InvalidProviderAPIKey for bearer auth without apiKey', () => {
      expect(() => {
        new LobeComfyUI({
          authType: 'bearer',
          // No apiKey provided - should throw error
        });
      }).toThrow();

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

      try {
        new LobeComfyUI({
          authType: 'custom',
        });
      } catch (error: any) {
        expect(error.errorType).toBe('InvalidComfyUIArgs');
      }
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