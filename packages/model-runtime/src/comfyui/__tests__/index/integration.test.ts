// @vitest-environment node
import { CallWrapper, ComfyApi, PromptBuilder } from '@saintno/comfyui-sdk';
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateImagePayload } from '../../index';
import { LobeComfyUI } from '../../index';
import { processModelList } from '../../../utils/modelParse';
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

// Mock the ModelResolver
vi.mock('../../utils/modelResolver', () => ({
  ModelResolver: vi.fn(),
  resolveModel: vi.fn().mockImplementation((modelName: string) => {
    return {
      modelFamily: 'FLUX',
      priority: 1,
      recommendedDtype: 'default' as const,
      variant: 'dev' as const,
    };
  }),
  resolveModelStrict: vi.fn().mockImplementation((modelName: string) => {
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

// Mock WorkflowDetector
vi.mock('../../utils/workflowDetector', () => ({
  WorkflowDetector: {
    detectModelType: vi.fn(),
  },
}));

// Mock the workflows
vi.mock('../../workflows', () => ({
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
}));

// Mock WorkflowRouter
vi.mock('../../utils/workflowRouter', () => ({
  WorkflowRouter: {
    getExactlySupportedModels: () => ['comfyui/flux-dev', 'comfyui/flux-schnell'],
    getSupportedFluxVariants: () => ['dev', 'schnell', 'kontext', 'krea'],
    routeWorkflow: () => ({
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
  getOptimalComponent: vi.fn().mockImplementation((type: string, modelFamily: string) => {
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
vi.mock('../../../utils/modelParse', () => ({
  processModelList: vi.fn(),
  detectModelProvider: vi.fn().mockImplementation((modelId: string) => {
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

// Mock console.error to avoid polluting test output
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('LobeComfyUI - Integration Tests', () => {
  let instance: LobeComfyUI;
  let mockComfyApi: ReturnType<typeof createMockComfyApi>;
  let mockCallWrapper: ReturnType<typeof createMockCallWrapper>;
  let mockPromptBuilder: ReturnType<typeof createMockPromptBuilder>;
  let mockModelResolver: ReturnType<typeof createMockModelResolver>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create fresh mock instances
    mockComfyApi = createMockComfyApi();
    mockCallWrapper = createMockCallWrapper();
    mockPromptBuilder = createMockPromptBuilder();
    mockModelResolver = createMockModelResolver();
    
    // Mock constructors to return our mock instances
    (ComfyApi as unknown as Mock).mockImplementation(() => mockComfyApi as any);
    (CallWrapper as unknown as Mock).mockImplementation(() => mockCallWrapper as any);
    (PromptBuilder as unknown as Mock).mockImplementation(() => mockPromptBuilder as any);
    
    // Mock ModelResolver class
    const { ModelResolver } = await import('../../utils/modelResolver');
    (ModelResolver as unknown as Mock).mockImplementation(() => mockModelResolver);

    // Mock global fetch
    global.fetch = vi.fn() as Mock;

    // Setup WorkflowDetector default behavior
    vi.spyOn(WorkflowDetector, 'detectModelType').mockImplementation((modelFileName: string) => {
      if (modelFileName.includes('flux')) {
        if (modelFileName.includes('dev')) {
          return { architecture: 'FLUX', isSupported: true, variant: 'dev' };
        }
        if (modelFileName.includes('schnell')) {
          return { architecture: 'FLUX', isSupported: true, variant: 'schnell' };
        }
        return { architecture: 'FLUX', isSupported: true, variant: 'schnell' };
      }
      if (modelFileName.includes('sd35')) {
        return { architecture: 'SD3' as const, isSupported: true, variant: 'sd35' };
      }
      if (modelFileName.includes('sd') || modelFileName.includes('xl')) {
        return { architecture: 'SDXL' as const, isSupported: true, variant: undefined };
      }
      return { architecture: 'FLUX', isSupported: true, variant: 'schnell' };
    });

    (processModelList as unknown as Mock).mockImplementation(async (modelList: any, config: any, provider: any) => {
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
    });

    instance = new LobeComfyUI({ baseURL: 'http://custom:8188' });
    
    // Replace the instance's modelResolver with our mock
    (instance as any).modelResolver = mockModelResolver;
  });

  describe('Connection Validation', () => {
    it('should throw ModelNotFound error for non-existent model', async () => {
      mockModelResolver.validateModel.mockResolvedValue({
        exists: false,
      });

      const payload: CreateImagePayload = {
        model: 'comfyui/non-existent-model',
        params: { prompt: 'Test model not found' },
      };

      await expect(instance.createImage(payload)).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.any(String),
        }),
        errorType: 'ModelNotFound',
      });

      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/non-existent-model');
    });

    it('should return static model list even when connection validation fails in models()', async () => {
      (global.fetch as Mock).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      const result = await instance.models();
      // Now returns static list regardless of connection status
      expect(result).toHaveLength(11); // We have 11 models defined in the static list
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('displayName');
    });

    it('should validate model existence using strict validation', async () => {
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux-schnell.safetensors',
        exists: true,
      });

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

      expect(mockModelResolver.validateModel).toHaveBeenCalledWith('comfyui/flux-schnell');
      expect(result).toEqual({
        height: 512,
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 512,
      });
    });
  });

  describe('Progress Handling', () => {
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

  describe('Model List Integration', () => {
    beforeEach(() => {
      instance = new LobeComfyUI({ baseURL: 'http://localhost:8188' });
      
      // Replace the instance's modelResolver with our mock
      (instance as any).modelResolver = mockModelResolver;
    });

    it('should return static model list regardless of checkpoint loader availability', async () => {
      const mockObjectInfo = {
        // No CheckpointLoaderSimple
        SomeOtherNode: {},
      };

      (global.fetch as Mock).mockResolvedValue({
        json: () => Promise.resolve(mockObjectInfo),
      });

      const result = await instance.models();
      // Always returns static list
      expect(result).toHaveLength(11);
      expect(result[0]).toHaveProperty('id');
    });

    it('should return static model list regardless of ckpt_name availability', async () => {
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
      // Always returns static list
      expect(result).toHaveLength(11);
      expect(result[0]).toHaveProperty('id');
    });

    it('should return static model list even when fetch fails', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const result = await instance.models();
      // Always returns static list
      expect(result).toHaveLength(11);
      expect(result[0]).toHaveProperty('id');
    });

    it('should successfully return models with comfyui prefix', async () => {
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

      (processModelList as unknown as Mock).mockResolvedValue([
        { id: 'comfyui/flux-schnell', displayName: 'FLUX Schnell', type: 'chat' },
        { id: 'comfyui/flux-dev', displayName: 'FLUX Dev', type: 'chat' },
      ] as any);

      const result = await instance.models();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      result.forEach((model) => {
        expect(model.id).toMatch(/^comfyui\//);
      });
    });

    it('should return static model list regardless of model file availability', async () => {
      mockModelResolver.getAvailableModelFiles.mockResolvedValue([]);

      const result = await instance.models();
      // Always returns static list
      expect(result).toHaveLength(11);
      expect(result[0]).toHaveProperty('id');
    });

    it('should handle undefined MODEL_LIST_CONFIGS.comfyui gracefully', async () => {
      const modelParseModule = await import('../../../utils/modelParse');
      const originalConfig = modelParseModule.MODEL_LIST_CONFIGS.comfyui;

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

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      (modelParseModule.MODEL_LIST_CONFIGS as any).comfyui = originalConfig;
    });

    it('should return static model list even when encountering unexpected error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      mockModelResolver.getAvailableModelFiles
        .mockResolvedValueOnce(['flux-schnell.safetensors']) // for ensureConnection
        .mockRejectedValueOnce(new Error('Unexpected server error')); // for models() method

      const result = await instance.models();

      // Always returns static list
      expect(result).toHaveLength(11);
      // getAvailableModelFiles is no longer called by models() since it returns static list
      expect(mockModelResolver.getAvailableModelFiles).toHaveBeenCalledTimes(0);
    });

    it('should return static model list even when getAvailableModelFiles returns non-array', async () => {
      mockModelResolver.getAvailableModelFiles.mockResolvedValue('not an array' as any);

      (instance as any).connectionValidated = false;

      // models() no longer validates connection, just returns static list
      const result = await instance.models();
      expect(result).toHaveLength(11);
      expect(result[0]).toHaveProperty('id');
      
      // getAvailableModelFiles may not even be called since models() returns static list
      expect(mockModelResolver.getAvailableModelFiles).not.toHaveBeenCalled();
    });
  });
});