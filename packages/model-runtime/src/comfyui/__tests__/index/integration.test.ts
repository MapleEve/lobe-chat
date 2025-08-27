// @vitest-environment node
import { CallWrapper, ComfyApi, PromptBuilder } from '@saintno/comfyui-sdk';
import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateImagePayload , LobeComfyUI } from '../../index';
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

});