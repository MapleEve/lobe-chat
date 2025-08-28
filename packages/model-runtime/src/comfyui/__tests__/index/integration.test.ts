// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentRuntimeErrorType } from '../../../error';
import { LobeComfyUI } from '../../index';
import { ComfyUIClientService } from '../../services/comfyuiClient';
import { ModelResolverService } from '../../services/modelResolver';
import { WorkflowBuilderService } from '../../services/workflowBuilder';
import { TEST_FLUX_MODELS } from '../constants/testModels';

// Mock services
vi.mock('../../services/comfyuiClient');
vi.mock('../../services/modelResolver');
vi.mock('../../services/workflowBuilder');

// Mock WorkflowDetector
vi.mock('../../utils/workflowDetector', () => ({
  WorkflowDetector: {
    detectModelType: vi.fn().mockReturnValue({
      modelType: 'flux',
      isSupported: true,
    }),
  },
}));

describe('LobeComfyUI - Integration Tests', () => {
  let instance: LobeComfyUI;
  let mockClientService: any;
  let mockModelResolverService: any;
  let mockWorkflowBuilderService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock client service
    mockClientService = {
      validateConnection: vi.fn().mockResolvedValue(true),
      executeWorkflow: vi.fn().mockResolvedValue({
        images: {
          images: [
            {
              data: 'base64imagedata',
              mimeType: 'image/png',
              width: 1024,
              height: 1024,
            },
          ],
        },
      }),
      getRawClient: vi.fn().mockReturnValue({
        getPathImage: vi.fn().mockReturnValue('http://localhost:8188/image.png'),
      }),
    };

    // Setup mock model resolver service
    mockModelResolverService = {
      validateModel: vi.fn(),
      resolveModelFileName: vi.fn(),
    };

    // Setup mock workflow builder service
    mockWorkflowBuilderService = {
      buildWorkflow: vi.fn().mockReturnValue({
        workflow: { '1': { class_type: 'CheckpointLoaderSimple' } },
      }),
    };

    // Mock the constructors
    (ComfyUIClientService as any).mockImplementation(() => mockClientService);
    (ModelResolverService as any).mockImplementation(() => mockModelResolverService);
    (WorkflowBuilderService as any).mockImplementation(() => mockWorkflowBuilderService);

    instance = new LobeComfyUI({
      baseURL: 'http://localhost:8188',
    });
  });

  describe('Connection Validation', () => {
    it('should throw ModelNotFound error for non-existent model', async () => {
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: false,
      });

      await expect(
        instance.createImage({
          model: 'nonexistent-model',
          params: {
            prompt: 'test prompt',
          },
        }),
      ).rejects.toMatchObject({
        error: expect.objectContaining({
          message: expect.stringContaining('Model not found'),
        }),
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
    });

    it('should validate model existence using service', async () => {
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: TEST_FLUX_MODELS.DEV,
      });

      mockClientService.executeWorkflow.mockResolvedValue({
        images: {
          images: [
            {
              data: 'base64imagedata',
              mimeType: 'image/png',
            },
          ],
        },
      });

      // Mock getPathImage on the raw client
      mockClientService.getPathImage = vi.fn().mockReturnValue('http://localhost:8188/image.png');

      const result = await instance.createImage({
        model: TEST_FLUX_MODELS.DEV,
        params: {
          prompt: 'test prompt',
        },
      });

      expect(mockModelResolverService.validateModel).toHaveBeenCalledWith(TEST_FLUX_MODELS.DEV);
      expect(result).toHaveProperty('imageUrl');
    });
  });

  describe('Workflow Execution', () => {
    beforeEach(() => {
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: TEST_FLUX_MODELS.DEV,
      });
    });

    it('should execute workflow through client service', async () => {
      mockClientService.getPathImage = vi.fn().mockReturnValue('http://localhost:8188/image.png');

      const result = await instance.createImage({
        model: TEST_FLUX_MODELS.DEV,
        params: {
          prompt: 'A beautiful landscape',
          width: 1024,
          height: 1024,
        },
      });

      expect(mockClientService.validateConnection).toHaveBeenCalled();
      expect(mockClientService.executeWorkflow).toHaveBeenCalled();
      expect(result).toMatchObject({
        imageUrl: 'http://localhost:8188/image.png',
        width: 1024,
        height: 1024,
      });
    });

    it('should handle workflow execution errors', async () => {
      mockClientService.executeWorkflow.mockRejectedValue({
        errorType: AgentRuntimeErrorType.ComfyUIWorkflowError,
        error: { message: 'Workflow failed' },
      });

      await expect(
        instance.createImage({
          model: TEST_FLUX_MODELS.DEV,
          params: {
            prompt: 'test',
          },
        }),
      ).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ComfyUIWorkflowError,
      });
    });

    it('should handle empty result from workflow', async () => {
      mockClientService.executeWorkflow.mockResolvedValue({
        images: { images: [] },
      });

      await expect(
        instance.createImage({
          model: TEST_FLUX_MODELS.DEV,
          params: {
            prompt: 'test',
          },
        }),
      ).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ComfyUIBizError,
      });
    });
  });

  describe('Service Integration', () => {
    it('should initialize all services correctly', () => {
      expect(ComfyUIClientService).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8188',
      });
      expect(ModelResolverService).toHaveBeenCalledWith(mockClientService);
      expect(WorkflowBuilderService).toHaveBeenCalledWith(
        expect.objectContaining({
          clientService: mockClientService,
          modelResolverService: mockModelResolverService,
        }),
      );
    });

    it('should pass workflow context to builder service', async () => {
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'flux1-schnell.safetensors',
      });

      mockClientService.getPathImage = vi.fn().mockReturnValue('http://localhost:8188/image.png');

      await instance.createImage({
        model: TEST_FLUX_MODELS.SCHNELL,
        params: { prompt: 'test' },
      });

      expect(mockWorkflowBuilderService.buildWorkflow).toHaveBeenCalledWith(
        TEST_FLUX_MODELS.SCHNELL,
        expect.objectContaining({ modelType: 'flux', isSupported: true }),
        'flux1-schnell.safetensors',
        expect.objectContaining({ prompt: 'test' }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle connection validation errors', async () => {
      mockClientService.validateConnection.mockRejectedValue(new Error('Connection failed'));

      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'flux1-schnell.safetensors',
      });

      await expect(
        instance.createImage({
          model: TEST_FLUX_MODELS.SCHNELL,
          params: { prompt: 'test' },
        }),
      ).rejects.toThrow();
    });

    it('should handle workflow builder errors', async () => {
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'flux1-schnell.safetensors',
      });

      mockWorkflowBuilderService.buildWorkflow.mockRejectedValue(
        new Error('Failed to build workflow'),
      );

      await expect(
        instance.createImage({
          model: TEST_FLUX_MODELS.SCHNELL,
          params: { prompt: 'test' },
        }),
      ).rejects.toThrow();
    });
  });
});
