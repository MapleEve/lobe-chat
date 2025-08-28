import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentRuntimeErrorType } from '../../../error';
import { CreateImagePayload } from '../../../types/image';
import { ComfyUIClientService } from '../../services/comfyuiClient';
import { ErrorHandlerService } from '../../services/errorHandler';
import { ImageService } from '../../services/imageService';
import { ModelResolverService } from '../../services/modelResolver';
import { WorkflowBuilderService } from '../../services/workflowBuilder';
import { WorkflowDetector } from '../../utils/workflowDetector';

// Mock dependencies
vi.mock('../../services/comfyuiClient');
vi.mock('../../services/modelResolver');
vi.mock('../../services/workflowBuilder');
vi.mock('../../services/errorHandler');
vi.mock('../../utils/workflowDetector');

describe('ImageService', () => {
  let imageService: ImageService;
  let mockClientService: any;
  let mockModelResolverService: any;
  let mockWorkflowBuilderService: any;
  let mockErrorHandler: any;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks
    mockClientService = {
      executeWorkflow: vi.fn(),
      getPathImage: vi.fn(),
      uploadImage: vi.fn(),
      validateConnection: vi.fn().mockResolvedValue(true),
    };

    mockModelResolverService = {
      validateModel: vi.fn(),
    };

    mockWorkflowBuilderService = {
      buildWorkflow: vi.fn(),
    };

    mockErrorHandler = {
      handleError: vi.fn(),
    };

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Setup mocks for constructor
    vi.mocked(ComfyUIClientService, true).mockImplementation(() => mockClientService as any);
    vi.mocked(ModelResolverService, true).mockImplementation(() => mockModelResolverService as any);
    vi.mocked(WorkflowBuilderService, true).mockImplementation(
      () => mockWorkflowBuilderService as any,
    );
    vi.mocked(ErrorHandlerService, true).mockImplementation(() => mockErrorHandler as any);

    // Create service instance
    imageService = new ImageService(
      mockClientService,
      mockModelResolverService,
      mockWorkflowBuilderService,
    );

    // Mock workflow detector
    vi.mocked(WorkflowDetector, true).detectModelType = vi.fn().mockReturnValue({
      isSupported: true,
      modelType: 'FLUX',
      architecture: 'flux-schnell',
    });
  });

  describe('createImage', () => {
    const mockPayload: CreateImagePayload = {
      model: 'flux-schnell',
      params: {
        prompt: 'test prompt',
        width: 1024,
        height: 1024,
      },
    };

    it('should successfully create image with text2img workflow', async () => {
      // Setup mocks
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'flux1-schnell-fp8.safetensors',
      });

      const mockWorkflow = { id: 'test-workflow' };
      mockWorkflowBuilderService.buildWorkflow.mockResolvedValue(mockWorkflow);

      const mockResult = {
        images: {
          images: [
            {
              width: 1024,
              height: 1024,
              data: 'base64data',
            },
          ],
        },
      };
      mockClientService.executeWorkflow.mockResolvedValue(mockResult);
      mockClientService.getPathImage.mockReturnValue('https://comfyui.test/image.png');

      // Execute
      const result = await imageService.createImage(mockPayload);

      // Verify
      expect(result).toEqual({
        width: 1024,
        height: 1024,
        imageUrl: 'https://comfyui.test/image.png',
      });

      expect(mockModelResolverService.validateModel).toHaveBeenCalledWith('flux-schnell');
      expect(mockWorkflowBuilderService.buildWorkflow).toHaveBeenCalled();
      expect(mockClientService.executeWorkflow).toHaveBeenCalledWith(
        mockWorkflow,
        expect.any(Function),
      );
    });

    it('should handle model not found error', async () => {
      // Setup
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: false,
      });

      mockErrorHandler.handleError.mockImplementation((error: any) => {
        throw {
          errorType: AgentRuntimeErrorType.ModelNotFound,
          provider: 'comfyui',
          error: { message: error.message },
        };
      });

      // Execute and verify
      await expect(imageService.createImage(mockPayload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
        provider: 'comfyui',
      });
    });

    it('should handle empty result from workflow', async () => {
      // Setup
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'flux1-schnell-fp8.safetensors',
      });

      mockWorkflowBuilderService.buildWorkflow.mockResolvedValue({});
      mockClientService.executeWorkflow.mockResolvedValue({
        images: { images: [] },
      });

      mockErrorHandler.handleError.mockImplementation((error: any) => {
        throw {
          errorType: AgentRuntimeErrorType.ComfyUIBizError,
          provider: 'comfyui',
          error: { message: error.message },
        };
      });

      // Execute and verify
      await expect(imageService.createImage(mockPayload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ComfyUIBizError,
        provider: 'comfyui',
      });
    });
  });

  describe('processImageFetch', () => {
    const mockPayloadWithImage: CreateImagePayload = {
      model: 'flux-schnell',
      params: {
        prompt: 'test prompt',
        imageUrl: 'https://s3.test/bucket/image.png',
        width: 1024,
        height: 1024,
      },
    };

    it('should fetch image from URL and upload to ComfyUI', async () => {
      // Setup mocks
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'flux1-schnell-fp8.safetensors',
      });

      // Fetch mocks
      const mockImageData = new Uint8Array([1, 2, 3, 4, 5]);
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockImageData.buffer),
      });

      // Upload mock
      mockClientService.uploadImage.mockResolvedValue('img2img_123456.png');

      // Workflow mocks
      mockWorkflowBuilderService.buildWorkflow.mockResolvedValue({});
      mockClientService.executeWorkflow.mockResolvedValue({
        images: { images: [{ width: 1024, height: 1024 }] },
      });
      mockClientService.getPathImage.mockReturnValue('https://comfyui.test/result.png');

      // Execute
      const result = await imageService.createImage(mockPayloadWithImage);

      // Verify fetch was called with the image URL
      expect(mockFetch).toHaveBeenCalledWith('https://s3.test/bucket/image.png');
      expect(mockClientService.uploadImage).toHaveBeenCalledWith(
        Buffer.from(mockImageData),
        expect.stringMatching(/^LobeChat_img2img_\d+\.png$/),
      );

      // Verify the URL was replaced with ComfyUI filename
      expect(mockPayloadWithImage.params.imageUrl).toBe('img2img_123456.png');
    });

    it('should skip processing if imageUrl is already a ComfyUI filename', async () => {
      const payloadWithFilename: CreateImagePayload = {
        model: 'flux-schnell',
        params: {
          prompt: 'test prompt',
          imageUrl: 'existing_image.png', // Not a URL
        },
      };

      // Setup
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'flux1-schnell-fp8.safetensors',
      });

      mockWorkflowBuilderService.buildWorkflow.mockResolvedValue({});
      mockClientService.executeWorkflow.mockResolvedValue({
        images: { images: [{}] },
      });
      mockClientService.getPathImage.mockReturnValue('result.png');

      // Execute
      await imageService.createImage(payloadWithFilename);

      // Verify fetch was not called
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockClientService.uploadImage).not.toHaveBeenCalled();
    });

    it('should handle fetch error', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: {
          prompt: 'test prompt',
          imageUrl: 'https://s3.test/missing.png',
        },
      };

      // Setup
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'model.safetensors',
      });

      // Fetch error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      mockErrorHandler.handleError.mockImplementation((error: any) => {
        throw error;
      });

      // Execute and verify
      await expect(imageService.createImage(payload)).rejects.toThrow(
        /Unable to fetch image from URL/,
      );
    });

    it('should reject images larger than 10MB', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: {
          prompt: 'test prompt',
          imageUrl: 'https://s3.test/large.png',
        },
      };

      // Setup
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'model.safetensors',
      });

      // Large image data
      const largeImageData = new Uint8Array(31 * 1024 * 1024); // 31MB (exceeds 30MB limit)
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(largeImageData.buffer),
      });

      mockErrorHandler.handleError.mockImplementation((error: any) => {
        throw error;
      });

      // Execute and verify
      await expect(imageService.createImage(payload)).rejects.toThrow(/Image too large/);
    });

    it('should handle imageUrls array format', async () => {
      const payloadWithArray: CreateImagePayload = {
        model: 'flux-schnell',
        params: {
          prompt: 'test prompt',
          imageUrls: ['https://s3.test/image.png'],
        },
      };

      // Setup
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'model.safetensors',
      });

      // S3 mocks
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      });
      mockClientService.uploadImage.mockResolvedValue('uploaded.png');

      // Workflow mocks
      mockWorkflowBuilderService.buildWorkflow.mockResolvedValue({});
      mockClientService.executeWorkflow.mockResolvedValue({
        images: { images: [{}] },
      });
      mockClientService.getPathImage.mockReturnValue('result.png');

      // Execute
      await imageService.createImage(payloadWithArray);

      // Verify both formats were updated
      expect(payloadWithArray.params.imageUrl).toBe('uploaded.png');
      expect(payloadWithArray.params.imageUrls![0]).toBe('uploaded.png');
    });
  });

  describe('buildWorkflow', () => {
    it('should detect unsupported models', async () => {
      const payload: CreateImagePayload = {
        model: 'unsupported-model',
        params: { prompt: 'test prompt' },
      };

      // Setup
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'unsupported.safetensors',
      });

      // Mock unsupported detection
      vi.mocked(WorkflowDetector).detectModelType = vi.fn().mockReturnValue({
        isSupported: false,
      });

      mockErrorHandler.handleError.mockImplementation((error: any) => {
        throw {
          errorType: AgentRuntimeErrorType.ModelNotFound,
          provider: 'comfyui',
          error: { message: error.message },
        };
      });

      // Execute and verify
      await expect(imageService.createImage(payload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });
    });

    it('should pass correct parameters to workflow builder', async () => {
      const payload: CreateImagePayload = {
        model: 'sd3.5-large',
        params: {
          prompt: 'test',
          negativePrompt: 'bad',
          width: 1024,
          height: 768,
        },
      };

      // Setup
      mockModelResolverService.validateModel.mockResolvedValue({
        exists: true,
        actualFileName: 'sd3.5_large.safetensors',
      });

      const detectionResult = {
        isSupported: true,
        modelType: 'SD35',
        architecture: 'sd35-large',
      };

      vi.mocked(WorkflowDetector).detectModelType = vi.fn().mockReturnValue(detectionResult);

      mockWorkflowBuilderService.buildWorkflow.mockResolvedValue({});
      mockClientService.executeWorkflow.mockResolvedValue({
        images: { images: [{}] },
      });
      mockClientService.getPathImage.mockReturnValue('result.png');

      // Execute
      await imageService.createImage(payload);

      // Verify workflow builder was called correctly
      expect(mockWorkflowBuilderService.buildWorkflow).toHaveBeenCalledWith(
        'sd3.5-large',
        detectionResult,
        'sd3.5_large.safetensors',
        payload.params,
      );
    });
  });

  describe('error handling delegation', () => {
    it('should delegate all errors to ErrorHandlerService', async () => {
      const payload: CreateImagePayload = {
        model: 'test',
        params: { prompt: 'test prompt' },
      };

      // Setup error
      const testError = new Error('Test error');
      mockModelResolverService.validateModel.mockRejectedValue(testError);

      mockErrorHandler.handleError.mockImplementation(() => {
        throw { transformed: true, original: testError };
      });

      // Execute
      await expect(imageService.createImage(payload)).rejects.toMatchObject({
        transformed: true,
        original: testError,
      });

      // Verify error handler was called
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(testError);
    });
  });
});
