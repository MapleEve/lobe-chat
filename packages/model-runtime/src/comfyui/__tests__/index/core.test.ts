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
  ModelResolver: vi.fn().mockImplementation(() => ({
    getAvailableModelFiles: vi.fn().mockResolvedValue(['flux-schnell.safetensors', 'flux-dev.safetensors', 'sd15-base.ckpt']),
    resolveModelFileName: vi.fn().mockImplementation((modelId: string) => {
      if (
        modelId.includes('non-existent') ||
        modelId.includes('unknown') ||
        modelId.includes('non-verified')
      ) {
        return Promise.reject(new Error(`Model not found: ${modelId}`));
      }
      const fileName = modelId.split('/').pop() || modelId;
      return Promise.resolve(fileName + '.safetensors');
    }),
    transformModelFilesToList: vi.fn().mockReturnValue([]),
    validateModel: vi.fn().mockImplementation((modelId: string) => {
      if (
        modelId.includes('non-existent') ||
        modelId.includes('unknown') ||
        modelId.includes('non-verified')
      ) {
        return Promise.resolve({ exists: false });
      }
      const fileName = modelId.split('/').pop() || modelId;
      return Promise.resolve({ exists: true, actualFileName: fileName + '.safetensors' });
    }),
  })),
  ModelResolverError: class extends Error {
    static Reasons = {
      MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
      INVALID_API_KEY: 'INVALID_API_KEY',
      PERMISSION_DENIED: 'PERMISSION_DENIED',
      SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
      NO_MODELS_AVAILABLE: 'NO_MODELS_AVAILABLE',
      CONNECTION_ERROR: 'CONNECTION_ERROR',
    };
    reason: string;
    constructor(message?: string, reason?: string) {
      super(message);
      this.name = 'ModelResolverError';
      this.reason = reason || 'Unknown';
    }
  },
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

// Mock fetch globally
global.fetch = vi.fn();

// Mock console.error to avoid polluting test output
vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock WorkflowDetector
vi.mock('../../utils/workflowDetector', () => ({
  WorkflowDetector: {
    detectModelType: vi.fn(),
  },
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

// Mock the workflows
const createMockBuilder = () => ({
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
});

vi.mock('../../workflows', () => ({
  buildFluxSchnellWorkflow: vi.fn().mockImplementation(() => createMockBuilder()),
  buildFluxDevWorkflow: vi.fn().mockImplementation(() => createMockBuilder()),
  buildFluxKontextWorkflow: vi.fn().mockImplementation(() => createMockBuilder()),
  buildFluxKreaWorkflow: vi.fn().mockImplementation(() => createMockBuilder()),
  buildSD35Workflow: vi.fn().mockImplementation(() => createMockBuilder()),
  buildSD35NoClipWorkflow: vi.fn().mockImplementation(() => createMockBuilder()),
}));

// Mock WorkflowRouter
vi.mock('../../utils/workflowRouter', () => ({
  WorkflowRouter: {
    getExactlySupportedModels: () => ['comfyui/flux-dev', 'comfyui/flux-schnell'],
    getSupportedFluxVariants: () => ['dev', 'schnell', 'kontext', 'krea'],
    routeWorkflow: () => createMockBuilder(),
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

describe('LobeComfyUI - Core Functionality', () => {
  let instance: LobeComfyUI;
  let mockComfyApi: ReturnType<typeof createMockComfyApi>;
  let mockCallWrapper: ReturnType<typeof createMockCallWrapper>;
  let mockPromptBuilder: ReturnType<typeof createMockPromptBuilder>;
  let mockModelResolver: ReturnType<typeof createMockModelResolver>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockComfyApi = createMockComfyApi();
    (ComfyApi as unknown as Mock).mockImplementation(() => mockComfyApi);

    mockCallWrapper = createMockCallWrapper();
    (CallWrapper as Mock).mockImplementation(() => mockCallWrapper);

    mockPromptBuilder = createMockPromptBuilder();
    (PromptBuilder as Mock).mockImplementation(() => mockPromptBuilder);

    // ModelResolver is already mocked at module level
    mockModelResolver = createMockModelResolver();

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

    // Setup processModelList default behavior
    vi.mocked(processModelList).mockImplementation(async (modelList: any, config: any, provider: any) => {
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

    instance = new LobeComfyUI({ apiKey: 'test-key' });
  });

  describe('createImage() - Basic Functionality', () => {
    it('should successfully create image with FLUX Schnell model', async () => {
      // Mock successful model validation
      mockModelResolver.validateModel.mockResolvedValue({
        actualFileName: 'flux_schnell.safetensors',
        exists: true,
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

    it('should use default parameters when not provided', async () => {
      // validateModel is already mocked at module level to return correct response

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

      expect(mockCallWrapper.run).toHaveBeenCalled();
      // validateModel is mocked at module level, so we can't check it with mockModelResolver
      // The test passes if no error is thrown
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
        height: 768, // From params
        imageUrl: 'http://localhost:8188/view?filename=test.png',
        width: 512, // From params
      });
    });
  });

  describe('Model Matching and Resolution', () => {
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
  });
});