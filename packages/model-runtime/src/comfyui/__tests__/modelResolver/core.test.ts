import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';

import type { ModelConfig } from '../../config/modelRegistry';
import { getAllModelNames, getModelConfig, getModelsByVariant } from '../../config/modelRegistry';
import {
  ModelResolverError,
  getAllModels,
  isValidModel,
  resolveModel,
  resolveModelStrict,
} from '../../utils/modelResolver';

// Mock the modelRegistry module
vi.mock('../../config/modelRegistry', () => ({
  getAllModelNames: vi.fn(),
  getModelConfig: vi.fn(),
  getModelsByVariant: vi.fn(),
}));

// Mock the debug module
vi.mock('debug', () => ({
  __esModule: true,
  default: vi.fn(() => vi.fn()),
}));

const mockGetModelConfig = getModelConfig as MockedFunction<typeof getModelConfig>;
const mockGetAllModelNames = getAllModelNames as MockedFunction<typeof getAllModelNames>;
const mockGetModelsByVariant = getModelsByVariant as MockedFunction<typeof getModelsByVariant>;

describe('ModelResolver - Core Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    mockGetModelConfig.mockReturnValue(undefined);
    mockGetAllModelNames.mockReturnValue([]);
    mockGetModelsByVariant.mockReturnValue([]);
  });

  describe('resolveModel', () => {
    it('should resolve model with direct filename match', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };
      mockGetModelConfig.mockReturnValue(mockConfig);

      const result = resolveModel('flux1-dev.safetensors');

      expect(result).toBe(mockConfig);
      expect(mockGetModelConfig).toHaveBeenCalledWith('flux1-dev.safetensors');
    });

    it('should resolve model from path by extracting filename', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };
      mockGetModelConfig.mockReturnValue(mockConfig);

      const result = resolveModel('/path/to/flux1-dev.safetensors');

      expect(result).toBe(mockConfig);
      expect(mockGetModelConfig).toHaveBeenCalledWith('flux1-dev.safetensors');
    });

    it('should fallback to case-insensitive lookup when direct match fails', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };

      // First call returns null, second call (case-insensitive) returns config
      mockGetModelConfig.mockReturnValueOnce(undefined).mockReturnValueOnce(mockConfig);

      const result = resolveModel('FLUX1-DEV.safetensors');

      expect(result).toBe(mockConfig);
      expect(mockGetModelConfig).toHaveBeenCalledTimes(2);
      expect(mockGetModelConfig).toHaveBeenCalledWith('FLUX1-DEV.safetensors');
      expect(mockGetModelConfig).toHaveBeenCalledWith('FLUX1-DEV.safetensors', {
        caseInsensitive: true,
      });
    });

    it('should return null when model is not found', () => {
      mockGetModelConfig.mockReturnValue(undefined);

      const result = resolveModel('non-existent-model.safetensors');

      expect(result).toBeNull();
      expect(mockGetModelConfig).toHaveBeenCalledTimes(2); // Direct and case-insensitive attempts
    });
  });

  describe('resolveModelStrict', () => {
    it('should return model config when model exists', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };
      mockGetModelConfig.mockReturnValue(mockConfig);

      const result = resolveModelStrict('flux1-dev.safetensors');

      expect(result).toBe(mockConfig);
    });

    it('should throw error when model is not found', () => {
      mockGetModelConfig.mockReturnValue(undefined);

      expect(() => resolveModelStrict('non-existent-model.safetensors')).toThrow(
        ModelResolverError,
      );

      try {
        resolveModelStrict('non-existent-model.safetensors');
      } catch (error) {
        expect(error).toBeInstanceOf(ModelResolverError);
        expect((error as ModelResolverError).reason).toBe(
          ModelResolverError.Reasons.MODEL_NOT_FOUND,
        );
        expect((error as ModelResolverError).message).toContain('non-existent-model.safetensors');
      }
    });
  });

  describe('isValidModel', () => {
    it('should return true when model exists', () => {
      const mockConfig: ModelConfig = {
        modelFamily: 'FLUX',
        priority: 1,
        recommendedDtype: 'default',
        variant: 'dev',
      };
      mockGetModelConfig.mockReturnValue(mockConfig);

      const result = isValidModel('flux1-dev.safetensors');

      expect(result).toBe(true);
    });

    it('should return false when model does not exist', () => {
      mockGetModelConfig.mockReturnValue(undefined);

      const result = isValidModel('non-existent-model.safetensors');

      expect(result).toBe(false);
    });
  });

  describe('getAllModels', () => {
    it('should return all model names from registry', () => {
      const mockModels = ['flux1-dev.safetensors', 'flux1-schnell.safetensors'];
      mockGetAllModelNames.mockReturnValue(mockModels);

      const result = getAllModels();

      expect(result).toEqual(mockModels);
      expect(mockGetAllModelNames).toHaveBeenCalled();
    });
  });
});