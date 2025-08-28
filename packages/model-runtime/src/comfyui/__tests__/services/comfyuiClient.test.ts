import { ComfyApi } from '@saintno/comfyui-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComfyUIKeyVault } from '@/types/user/settings/keyVaults';

import { AgentRuntimeErrorType } from '../../../error';
import { ModelResolverError } from '../../errors/modelResolverError';
import { ComfyUIClientService } from '../../services/comfyuiClient';

// Mock the SDK
vi.mock('@saintno/comfyui-sdk', () => ({
  ComfyApi: vi.fn(),
  CallWrapper: vi.fn(),
}));

describe('ComfyUIClientService', () => {
  let service: ComfyUIClientService;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      init: vi.fn(),
      fetchApi: vi.fn(),
      uploadImage: vi.fn(),
      getPathImage: vi.fn(),
    };

    // Mock ComfyApi constructor
    vi.mocked(ComfyApi).mockImplementation(() => mockClient);
  });

  describe('constructor', () => {
    it('should initialize with default settings', () => {
      service = new ComfyUIClientService();

      expect(ComfyApi).toHaveBeenCalledWith(expect.stringContaining('http'), undefined, {
        credentials: undefined,
      });
      expect(mockClient.init).toHaveBeenCalled();
    });

    it('should validate basic auth configuration', () => {
      const options: ComfyUIKeyVault = {
        authType: 'basic',
        // Missing username and password
      };

      expect(() => new ComfyUIClientService(options)).toThrow();
    });

    it('should validate bearer auth configuration', () => {
      const options: ComfyUIKeyVault = {
        authType: 'bearer',
        // Missing apiKey
      };

      expect(() => new ComfyUIClientService(options)).toThrow();
    });

    it('should create basic credentials correctly', () => {
      const options: ComfyUIKeyVault = {
        authType: 'basic',
        username: 'user',
        password: 'pass',
      };

      service = new ComfyUIClientService(options);

      expect(ComfyApi).toHaveBeenCalledWith(expect.any(String), undefined, {
        credentials: {
          type: 'basic',
          username: 'user',
          password: 'pass',
        },
      });
    });

    it('should create bearer credentials correctly', () => {
      const options: ComfyUIKeyVault = {
        authType: 'bearer',
        apiKey: 'test-key',
      };

      service = new ComfyUIClientService(options);

      expect(ComfyApi).toHaveBeenCalledWith(expect.any(String), undefined, {
        credentials: {
          type: 'bearer_token',
          token: 'test-key',
        },
      });
    });

    it('should create custom credentials correctly', () => {
      const options: ComfyUIKeyVault = {
        authType: 'custom',
        customHeaders: {
          'X-Custom': 'header',
        },
      };

      service = new ComfyUIClientService(options);

      expect(ComfyApi).toHaveBeenCalledWith(expect.any(String), undefined, {
        credentials: {
          type: 'custom',
          headers: { 'X-Custom': 'header' },
        },
      });
    });
  });

  describe('uploadImage', () => {
    beforeEach(() => {
      service = new ComfyUIClientService();
    });

    it('should successfully upload an image', async () => {
      // Setup mock
      const mockBuffer = Buffer.from('test image data');
      const mockFileName = 'test.png';
      const mockResult = {
        info: {
          filename: 'uploaded_test.png',
        },
      };

      mockClient.uploadImage.mockResolvedValue(mockResult);

      // Execute
      const result = await service.uploadImage(mockBuffer, mockFileName);

      // Verify
      expect(result).toBe('uploaded_test.png');
      expect(mockClient.uploadImage).toHaveBeenCalledWith(mockBuffer, mockFileName);
    });

    it('should handle upload failure when result is null', async () => {
      // Setup
      mockClient.uploadImage.mockResolvedValue(null);

      // Execute and verify
      await expect(service.uploadImage(Buffer.from('data'), 'file.png')).rejects.toThrow(
        'Failed to upload image to ComfyUI server',
      );
    });

    it('should handle network errors during upload', async () => {
      // Setup
      const networkError = new TypeError('Failed to fetch');
      mockClient.uploadImage.mockRejectedValue(networkError);

      // Execute and verify
      await expect(service.uploadImage(Buffer.from('data'), 'file.png')).rejects.toThrow(
        ModelResolverError,
      );

      try {
        await service.uploadImage(Buffer.from('data'), 'file.png');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect(error.reason).toBe('CONNECTION_ERROR');
      }
    });

    it('should support Blob upload', async () => {
      // Setup
      const mockBlob = new Blob(['test data']);
      const mockResult = {
        info: { filename: 'blob_upload.png' },
      };

      mockClient.uploadImage.mockResolvedValue(mockResult);

      // Execute
      const result = await service.uploadImage(mockBlob, 'blob.png');

      // Verify
      expect(result).toBe('blob_upload.png');
      expect(mockClient.uploadImage).toHaveBeenCalledWith(mockBlob, 'blob.png');
    });
  });

  describe('executeWorkflow', () => {
    beforeEach(() => {
      service = new ComfyUIClientService();
    });

    it('should execute workflow successfully', async () => {
      // Import CallWrapper mock
      const { CallWrapper } = await import('@saintno/comfyui-sdk');

      // Setup mock workflow
      const mockWorkflow = { id: 'test-workflow' };
      const mockResult = {
        images: {
          images: [{ data: 'base64' }],
        },
      };

      // Create CallWrapper mock instance
      const mockCallWrapper = {
        onFinished: vi.fn().mockReturnThis(),
        onFailed: vi.fn().mockReturnThis(),
        onProgress: vi.fn().mockReturnThis(),
        run: vi.fn(),
      };

      // Setup CallWrapper mock
      vi.mocked(CallWrapper).mockImplementation(() => mockCallWrapper as any);

      // Simulate successful execution
      mockCallWrapper.run.mockImplementation(() => {
        const finishCallback = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCallback(mockResult);
      });

      // Execute
      const result = await service.executeWorkflow(mockWorkflow as any);

      // Verify
      expect(result).toEqual(mockResult);
      expect(CallWrapper).toHaveBeenCalledWith(mockClient, mockWorkflow);
    });

    it('should handle workflow execution failure', async () => {
      const { CallWrapper } = await import('@saintno/comfyui-sdk');

      const mockWorkflow = { id: 'test' };
      const mockError = new Error('Workflow failed');

      const mockCallWrapper = {
        onFinished: vi.fn().mockReturnThis(),
        onFailed: vi.fn().mockReturnThis(),
        onProgress: vi.fn().mockReturnThis(),
        run: vi.fn(),
      };

      vi.mocked(CallWrapper).mockImplementation(() => mockCallWrapper as any);

      // Simulate failure
      mockCallWrapper.run.mockImplementation(() => {
        const failCallback = mockCallWrapper.onFailed.mock.calls[0][0];
        failCallback(mockError);
      });

      // Execute and verify
      await expect(service.executeWorkflow(mockWorkflow as any)).rejects.toMatchObject({
        provider: 'comfyui',
      });
    });

    it('should call progress callback', async () => {
      const { CallWrapper } = await import('@saintno/comfyui-sdk');

      const mockWorkflow = { id: 'test' };
      const mockProgress = { step: 1, total: 10 };
      const progressCallback = vi.fn();

      const mockCallWrapper = {
        onFinished: vi.fn().mockReturnThis(),
        onFailed: vi.fn().mockReturnThis(),
        onProgress: vi.fn().mockReturnThis(),
        run: vi.fn(),
      };

      vi.mocked(CallWrapper).mockImplementation(() => mockCallWrapper as any);

      // Simulate progress and completion
      mockCallWrapper.run.mockImplementation(() => {
        const progressCb = mockCallWrapper.onProgress.mock.calls[0][0];
        progressCb(mockProgress);

        const finishCb = mockCallWrapper.onFinished.mock.calls[0][0];
        finishCb({ images: { images: [] } });
      });

      // Execute
      await service.executeWorkflow(mockWorkflow as any, progressCallback);

      // Verify
      expect(progressCallback).toHaveBeenCalledWith(mockProgress);
    });
  });

  describe('validateConnection', () => {
    beforeEach(() => {
      service = new ComfyUIClientService();
      // Mock getNodeDefs for validation
      service.getNodeDefs = vi.fn();
    });

    it('should validate connection successfully', async () => {
      // Setup
      const mockNodeDefs = {
        KSampler: { input: {} },
        VAEDecode: { input: {} },
      };

      vi.mocked(service.getNodeDefs).mockResolvedValue(mockNodeDefs);

      // Execute
      const result = await service.validateConnection();

      // Verify
      expect(result).toBe(true);
      expect(service.getNodeDefs).toHaveBeenCalled();
    });

    it('should cache successful validation', async () => {
      // Setup
      vi.mocked(service.getNodeDefs).mockResolvedValue({ test: 'data' });

      // Execute twice
      await service.validateConnection();
      await service.validateConnection();

      // Verify only called once
      expect(service.getNodeDefs).toHaveBeenCalledTimes(1);
    });

    it('should handle connection failure', async () => {
      // Setup
      vi.mocked(service.getNodeDefs).mockRejectedValue(new TypeError('Failed to fetch'));

      // Execute and verify
      await expect(service.validateConnection()).rejects.toThrow(ModelResolverError);
    });

    it('should handle invalid response', async () => {
      // Setup
      vi.mocked(service.getNodeDefs).mockResolvedValue(null);

      // Execute and verify
      await expect(service.validateConnection()).rejects.toThrow(
        'Invalid response from ComfyUI server',
      );
    });
  });

  // fetchApi and getObjectInfo tests removed
  // These methods should not be used directly
  // Use SDK methods: getCheckpoints(), getNodeDefs(), getLoras(), getSamplerInfo()

  describe('getPathImage', () => {
    beforeEach(() => {
      service = new ComfyUIClientService();
    });

    it('should delegate to client getPathImage', () => {
      // Setup
      const mockImageInfo = { filename: 'test.png' };
      const expectedPath = 'https://server/image/test.png';
      mockClient.getPathImage.mockReturnValue(expectedPath);

      // Execute
      const result = service.getPathImage(mockImageInfo);

      // Verify
      expect(result).toBe(expectedPath);
      expect(mockClient.getPathImage).toHaveBeenCalledWith(mockImageInfo);
    });
  });

  // getRawClient removed - violates Law of Demeter
  // All SDK methods should be wrapped in service methods
});
