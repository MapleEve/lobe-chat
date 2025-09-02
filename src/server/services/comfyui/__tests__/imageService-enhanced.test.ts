/**
 * Enhanced test coverage for ImageService
 * Focuses on error handling paths, edge cases, and integration scenarios
 * To achieve 95%+ coverage from current 64.49%
 */
import { AgentRuntimeErrorType } from '@lobechat/model-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateImagePayload } from '@/libs/model-runtime';
import { ComfyUIClientService } from '@/server/services/comfyui/core/comfyUIClientService';
import { ErrorHandlerService } from '@/server/services/comfyui/core/errorHandlerService';
import { ImageService } from '@/server/services/comfyui/core/imageService';
import { ModelResolverService } from '@/server/services/comfyui/core/modelResolverService';
import { WorkflowBuilderService } from '@/server/services/comfyui/core/workflowBuilderService';
import { ServicesError } from '@/server/services/comfyui/errors';
import { imageResizer } from '@/server/services/comfyui/utils/imageResizer';
import { WorkflowDetector } from '@/server/services/comfyui/utils/workflowDetector';

// Mock dependencies
vi.mock('@/server/services/comfyui/core/comfyUIClientService');
vi.mock('@/server/services/comfyui/core/modelResolverService');
vi.mock('@/server/services/comfyui/core/workflowBuilderService');
vi.mock('@/server/services/comfyui/core/errorHandlerService');
vi.mock('@/server/services/comfyui/utils/workflowDetector');
vi.mock('@/server/services/comfyui/utils/imageResizer');
vi.mock('@/utils/uuid', () => ({
  nanoid: vi.fn().mockReturnValue('test-id'),
}));

// Mock sharp conditionally
vi.mock('sharp', async () => {
  const mockSharp = vi.fn((buffer) => ({
    metadata: vi.fn().mockResolvedValue({ height: 1024, width: 1024 }),
    resize: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from(buffer)),
  }));
  return { default: mockSharp };
});

describe('ImageService - Enhanced Coverage', () => {
  let imageService: ImageService;
  let mockClientService: any;
  let mockModelResolverService: any;
  let mockWorkflowBuilderService: any;
  let mockErrorHandler: any;
  let mockFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment
    delete (globalThis as any).window;

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
    vi.mocked(ComfyUIClientService).mockImplementation(() => mockClientService as any);
    vi.mocked(ModelResolverService).mockImplementation(() => mockModelResolverService as any);
    vi.mocked(WorkflowBuilderService).mockImplementation(() => mockWorkflowBuilderService as any);
    vi.mocked(ErrorHandlerService).mockImplementation(() => mockErrorHandler as any);

    // Create service instance
    imageService = new ImageService(
      mockClientService,
      mockModelResolverService,
      mockWorkflowBuilderService,
    );

    // Setup default successful mocks
    mockModelResolverService.validateModel.mockResolvedValue({
      actualFileName: 'flux1-schnell-fp8.safetensors',
      exists: true,
    });

    vi.mocked(WorkflowDetector.detectModelType).mockReturnValue({
      architecture: 'FLUX',
      isSupported: true,
    });

    // Mock imageResizer to return reasonable defaults
    vi.mocked(imageResizer.calculateTargetDimensions).mockReturnValue({
      width: 1024,
      height: 1024,
      needsResize: false,
    });

    mockWorkflowBuilderService.buildWorkflow.mockResolvedValue({ id: 'test-workflow' });
    mockClientService.executeWorkflow.mockResolvedValue({
      images: { images: [{ data: 'test-data' }] },
    });
    mockClientService.getPathImage.mockReturnValue('https://comfyui.test/image.png');
  });

  describe('connection validation errors', () => {
    it('should handle connection validation failure', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: { prompt: 'test prompt' },
      };

      // Mock connection failure
      const connectionError = new Error('Connection failed');
      mockClientService.validateConnection.mockRejectedValue(connectionError);
      mockErrorHandler.handleError.mockImplementation((error: Error) => {
        throw error;
      });

      await expect(imageService.createImage(payload)).rejects.toThrow('Connection failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(connectionError);
    });

    it('should handle connection timeout', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: { prompt: 'test prompt' },
      };

      // Mock timeout error
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      mockClientService.validateConnection.mockRejectedValue(timeoutError);
      mockErrorHandler.handleError.mockImplementation((error: Error) => {
        throw error;
      });

      await expect(imageService.createImage(payload)).rejects.toThrow('Request timeout');
    });

    it('should handle authentication errors during validation', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: { prompt: 'test prompt' },
      };

      // Mock auth error
      const authError = new Error('Invalid API key');
      authError.name = 'AuthError';
      mockClientService.validateConnection.mockRejectedValue(authError);
      mockErrorHandler.handleError.mockImplementation((error: Error) => {
        throw { errorType: AgentRuntimeErrorType.InvalidProviderAPIKey };
      });

      await expect(imageService.createImage(payload)).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
      });
    });
  });

  describe('image processing error paths', () => {
    it('should handle fetch response with invalid content type', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: {
          imageUrl: 'https://example.com/not-image.txt',
          prompt: 'test prompt',
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
        headers: { get: vi.fn().mockReturnValue('text/plain') },
      });

      const { default: sharp } = await import('sharp');
      vi.mocked(sharp).mockImplementation(
        () =>
          ({
            metadata: vi.fn().mockResolvedValue({ width: 1024, height: 1024 }),
          }) as any,
      );

      mockClientService.uploadImage.mockResolvedValue('uploaded.png');

      mockErrorHandler.handleError.mockImplementation((error: Error) => {
        throw error;
      });

      // Should not throw as we don't validate content type currently
      const result = await imageService.createImage(payload);
      expect(result).toBeDefined();
    });

    it('should handle sharp metadata extraction failure', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: {
          imageUrl: 'https://example.com/invalid-meta.png',
          prompt: 'test prompt',
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      });

      // Mock sharp metadata to fail
      const { default: sharp } = await import('sharp');
      vi.mocked(sharp).mockImplementation(
        () =>
          ({
            metadata: vi.fn().mockRejectedValue(new Error('Cannot read image metadata')),
          }) as any,
      );

      mockErrorHandler.handleError.mockImplementation((error: Error) => {
        throw error;
      });

      await expect(imageService.createImage(payload)).rejects.toThrow('Cannot read image metadata');
    });

    it('should handle image resizing failure', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: {
          imageUrl: 'https://example.com/resize-fail.png',
          prompt: 'test prompt',
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      });

      const { default: sharp } = await import('sharp');
      vi.mocked(sharp).mockImplementation(
        () =>
          ({
            metadata: vi.fn().mockResolvedValue({ width: 2000, height: 2000 }),
            resize: vi.fn().mockReturnThis(),
            toBuffer: vi.fn().mockRejectedValue(new Error('Resize operation failed')),
          }) as any,
      );

      // Mock imageResizer to indicate resize is needed
      vi.mocked(imageResizer.calculateTargetDimensions).mockReturnValue({
        width: 1024,
        height: 1024,
        needsResize: true,
      });

      mockErrorHandler.handleError.mockImplementation((error: Error) => {
        throw error;
      });

      await expect(imageService.createImage(payload)).rejects.toThrow('Resize operation failed');
    });

    it('should handle parameter callback type errors', async () => {
      const payload: CreateImagePayload = {
        model: 'flux-schnell',
        params: { prompt: 'test prompt' },
      };

      mockClientService.executeWorkflow.mockResolvedValue({
        images: { images: [{ data: 'test-data' }] },
      });

      mockClientService.getPathImage.mockImplementation(
        (imageData: any, index = 0) => `https://comfyui.test/image-${index}.png`,
      );

      const result = await imageService.createImage(payload);
      expect(result.imageUrl).toBeDefined();
    });
  });
});
