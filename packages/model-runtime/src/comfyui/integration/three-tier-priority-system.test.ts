// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ComfyApi } from '@saintno/comfyui-sdk';
import type { PromptBuilder } from '@saintno/comfyui-sdk';

import { AgentRuntimeErrorType } from '../../error';
import { ModelValidationManager } from '../utils/modelValidationManager';
import { WorkflowTypeDetector } from '../utils/WorkflowTypeDetector';
import { WorkflowRouter, WorkflowRoutingError } from '../utils/WorkflowRouter';

import { buildFluxDevWorkflow } from '../workflows/flux-dev';
import { buildFluxSchnellWorkflow } from '../workflows/flux-schnell';
import { buildFluxKontextWorkflow } from '../workflows/flux-kontext';
import { buildFluxKreaWorkflow } from '../workflows/flux-krea';

// Mock workflow builders
vi.mock('../workflows/flux-dev', () => ({
  buildFluxDevWorkflow: vi.fn(),
}));

vi.mock('../workflows/flux-schnell', () => ({
  buildFluxSchnellWorkflow: vi.fn(),
}));

vi.mock('../workflows/flux-kontext', () => ({
  buildFluxKontextWorkflow: vi.fn(),
}));

vi.mock('../workflows/flux-krea', () => ({
  buildFluxKreaWorkflow: vi.fn(),
}));

// Mock ModelNameStandardizer for validation
vi.mock('../utils/model-name-standardizer', () => {
  const createStandardizedModel = (variant: string, fileName: string) => ({
    fileSizeGB: 11.9,
    priority: 1 as const,
    quantization: null,
    recommendedDtype: 'default',
    source: 'black-forest-labs',
    standardName: fileName.replace(/\.(safetensors|ckpt|pt|gguf)$/i, ''),
    subPriority: 1,
    variant: variant as 'dev' | 'schnell' | 'kontext' | 'krea',
  });

  return {
    ModelNameStandardizer: {
      isValidModel: vi.fn((fileName: string) => {
        if (!fileName) return false;
        const lowerFileName = fileName.toLowerCase();
        return lowerFileName === 'flux-dev' || 
               lowerFileName === 'flux-schnell' || 
               lowerFileName === 'flux-kontext-dev' ||
               lowerFileName === 'flux-krea-dev' ||
               lowerFileName === 'custom-flux-model'; // Special case
      }),
      standardize: vi.fn((fileName: string) => {
        if (!fileName) {
          const error = new Error('Model not found: undefined');
          error.name = 'ModelNotFoundError';
          throw error;
        }
        
        const lowerFileName = fileName.toLowerCase();
        
        // Return mock model for EXACT FLUX model names only (strict validation)
        if (lowerFileName === 'flux-dev' || lowerFileName === 'flux1-dev') {
          return createStandardizedModel('dev', fileName);
        }
        if (lowerFileName === 'flux-schnell' || lowerFileName === 'flux1-schnell') {
          return createStandardizedModel('schnell', fileName);
        }
        if (lowerFileName === 'flux-kontext-dev') {
          return createStandardizedModel('kontext', fileName);
        }
        if (lowerFileName === 'flux-krea-dev') {
          return createStandardizedModel('krea', fileName);
        }
        // Special case for the malformed detection test
        if (lowerFileName === 'custom-flux-model') {
          return createStandardizedModel('dev', fileName);
        }
        
        // Throw error for unknown models (strict validation behavior)
        const error = new Error(`Model not found: ${fileName}`);
        error.name = 'ModelNotFoundError';
        throw error;
      }),
    },
    ModelNotFoundError: class extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'ModelNotFoundError';
      }
    },
  };
});

/**
 * Three-Tier Priority System Integration Tests
 * 
 * Tests the complete validation and routing flow:
 * 1. ModelValidationManager - Validates model existence and caches results
 * 2. WorkflowTypeDetector - Detects architecture and variant with confidence levels
 * 3. WorkflowRouter - Routes to appropriate workflow builders based on detection results
 */
describe('Three-Tier Priority System Integration', () => {
  let mockComfyApi: any;
  let validationManager: ModelValidationManager;

  // Mock PromptBuilder result
  const mockPromptBuilder = {
    prompt: {
      '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'test.safetensors' } },
    },
  } as unknown as PromptBuilder<any, any, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup ComfyAPI mock
    mockComfyApi = {
      fetchApi: vi.fn(),
    };

    validationManager = new ModelValidationManager(() => Promise.resolve(['mock-model.safetensors']));

    // Mock the validateModelExistence method
    vi.spyOn(validationManager, 'validateModelExistence').mockImplementation(async (modelId: string) => ({
      exists: true,
      actualFileName: modelId.includes('flux-dev') ? 'flux-dev.safetensors' : 
                     modelId.includes('schnell') ? 'flux-schnell.safetensors' :
                     modelId.includes('kontext') ? 'flux-kontext-dev.safetensors' :
                     modelId.includes('krea') ? 'flux-krea-dev.safetensors' :
                     'default-model.safetensors',
      isValid: true,
      priority: 1,
      timestamp: Date.now(),
      validatedAt: Date.now(),
      variant: modelId.includes('schnell') ? 'schnell' : 
               modelId.includes('kontext') ? 'kontext' :
               modelId.includes('krea') ? 'krea' : 'dev'
    }));

    // Setup default workflow builder mocks
    (buildFluxDevWorkflow as any).mockReturnValue(mockPromptBuilder);
    (buildFluxSchnellWorkflow as any).mockReturnValue(mockPromptBuilder);
    (buildFluxKontextWorkflow as any).mockReturnValue(mockPromptBuilder);
    (buildFluxKreaWorkflow as any).mockReturnValue(mockPromptBuilder);
  });

  describe('Complete Flow - Success Cases', () => {
    beforeEach(() => {
      // Mock successful model validation
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['flux-dev.safetensors', 'flux-schnell.safetensors', 'flux-kontext-dev.safetensors']],
              },
            },
          },
        }),
        ok: true,
      });
    });

    it('should handle exact FLUX Dev model through complete flow', async () => {
      const modelId = 'comfyui/flux-dev';
      const params = { prompt: 'A beautiful landscape', steps: 28 };

      // Step 1: Model Validation
      const validationResult = await validationManager.validateModelExistence(modelId);
      expect(validationResult.exists).toBe(true);
      expect(validationResult.actualFileName).toBe('flux-dev.safetensors');

      // Step 2: Type Detection
      const detectionResult = WorkflowTypeDetector.detectModelType(modelId);
      expect(detectionResult).toMatchObject({
        architecture: 'flux',
        confidence: 'high',
        isSupported: true,
        variant: 'dev',
      });

      // Step 3: Workflow Routing
      const workflow = WorkflowRouter.routeWorkflow(
        modelId,
        detectionResult,
        validationResult.actualFileName!,
        params
      );

      expect(buildFluxDevWorkflow).toHaveBeenCalledWith(validationResult.actualFileName, params);
      expect(workflow).toBe(mockPromptBuilder);
    });

    it('should handle community FLUX model as custom model', async () => {
      const modelId = 'comfyui/community-flux-custom-model';
      const params = { prompt: 'Test prompt' };

      // Mock ComfyUI has the model available
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['community-flux-custom-model.safetensors']],
              },
            },
          },
        }),
        ok: true,
      });

      // Step 1: Model Validation should succeed for custom models that exist on server
      // Even though model is not in standardizer, it exists on server so it's valid
      const validationResult = await validationManager.validateModelExistence(modelId);
      expect(validationResult).toMatchObject({
        actualFileName: 'community-flux-custom-model.safetensors',
        exists: true,
      });

      // Step 2: Type Detection still works (doesn't require model validation)
      const detectionResult = WorkflowTypeDetector.detectModelType(modelId);
      expect(detectionResult).toMatchObject({
        architecture: 'flux',
        confidence: 'low', 
        // Generic flux model fallback to dev
        isSupported: true,
        variant: 'dev', // Generic flux models get low confidence
      });

      // Step 3: Workflow Routing would work if validation had passed
      expect(() => {
        WorkflowRouter.routeWorkflow(
          modelId,
          detectionResult,
          'community-flux-custom-model.safetensors',
          params
        );
      }).not.toThrow();
    });

    it('should handle all supported FLUX variants through complete flow', async () => {
      const testCases = [
        { 
          builder: buildFluxDevWorkflow, 
          fileName: 'flux-dev.safetensors',
          modelId: 'comfyui/flux-dev',
          variant: 'dev' 
        },
        { 
          builder: buildFluxSchnellWorkflow, 
          fileName: 'flux-schnell.safetensors',
          modelId: 'comfyui/flux-schnell',
          variant: 'schnell' 
        },
        { 
          builder: buildFluxKontextWorkflow, 
          fileName: 'flux-kontext-dev.safetensors',
          modelId: 'comfyui/flux-kontext-dev',
          variant: 'kontext' 
        },
        { 
          builder: buildFluxKreaWorkflow, 
          fileName: 'flux-krea-dev.safetensors',
          modelId: 'comfyui/flux-krea-dev',
          variant: 'krea' 
        },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();
        validationManager.clearCache();

        // Mock model existence
        mockComfyApi.fetchApi.mockResolvedValue({
          json: () => Promise.resolve({
            CheckpointLoaderSimple: {
              input: {
                required: {
                  ckpt_name: [[testCase.fileName]],
                },
              },
            },
          }),
          ok: true,
        });

        const params = { prompt: `Test ${testCase.variant}` };

        // Complete flow test
        const validationResult = await validationManager.validateModelExistence(testCase.modelId);
        const detectionResult = WorkflowTypeDetector.detectModelType(testCase.modelId);
        const workflow = WorkflowRouter.routeWorkflow(
          testCase.modelId,
          detectionResult,
          validationResult.actualFileName!,
          params
        );

        expect(validationResult.actualFileName).toBe(testCase.fileName);
        expect(detectionResult.variant).toBe(testCase.variant);
        expect(testCase.builder).toHaveBeenCalledWith(testCase.fileName, params);
        expect(workflow).toBe(mockPromptBuilder);
      }
    });
  });

  describe('Complete Flow - Error Cases', () => {
    it('should fail early at validation stage for non-existent models', async () => {
      const modelId = 'comfyui/non-existent-model';

      // Mock model not found in ComfyUI
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['flux-dev.safetensors']], // Model not in list
              },
            },
          },
        }),
        ok: true,
      });

      // Step 1: Should fail at validation
      await expect(
        validationManager.validateModelExistence(modelId)
      ).rejects.toMatchObject({
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });

      // Since validation failed, the flow would stop here
      // But we can still test detection and routing independently
      const detectionResult = WorkflowTypeDetector.detectModelType(modelId);
      expect(detectionResult.isSupported).toBe(false);
    });

    it('should handle non-FLUX models as custom models when they exist', async () => {
      const modelId = 'comfyui/stable-diffusion-xl';

      // Mock SD model in ComfyUI
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['stable-diffusion-xl.safetensors']],
              },
            },
          },
        }),
        ok: true,
      });

      // Step 1: Validation should succeed for custom models that exist on server
      const validationResult = await validationManager.validateModelExistence(modelId);
      expect(validationResult).toMatchObject({
        actualFileName: 'stable-diffusion-xl.safetensors',
        exists: true,
      });

      // Step 2: Detection correctly identifies as unsupported
      const detectionResult = WorkflowTypeDetector.detectModelType(modelId);
      expect(detectionResult).toMatchObject({
        architecture: 'unknown',
        isSupported: false,
      });

      // Step 3: Routing should throw WorkflowRoutingError
      expect(() => {
        WorkflowRouter.routeWorkflow(
          modelId,
          detectionResult,
          'stable-diffusion-xl.safetensors',
          { prompt: 'test' }
        );
      }).toThrow(WorkflowRoutingError);
    });

    it('should handle ComfyUI server connection failures', async () => {
      const modelId = 'comfyui/flux-dev';

      // Mock connection failure
      mockComfyApi.fetchApi.mockRejectedValue(new Error('Connection refused'));

      // Step 1: Should fail at validation with connection error
      await expect(
        validationManager.validateModelExistence(modelId)
      ).rejects.toMatchObject({
        error: expect.objectContaining({
          error: 'Connection refused',
        }),
        errorType: AgentRuntimeErrorType.ModelNotFound,
      });

      // Detection and routing would still work independently
      const detectionResult = WorkflowTypeDetector.detectModelType(modelId);
      expect(detectionResult.isSupported).toBe(true);
    });
  });

  describe('Caching and Performance', () => {
    beforeEach(() => {
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['flux-dev.safetensors']],
              },
            },
          },
        }),
        ok: true,
      });
    });

    it('should cache validation results across multiple workflow generations', async () => {
      const modelId = 'comfyui/flux-dev';
      const params1 = { prompt: 'First prompt' };
      const params2 = { prompt: 'Second prompt' };

      // First complete flow
      const validation1 = await validationManager.validateModelExistence(modelId);
      const detection1 = WorkflowTypeDetector.detectModelType(modelId);
      WorkflowRouter.routeWorkflow(modelId, detection1, validation1.actualFileName!, params1);

      // Second complete flow should use cached validation
      const validation2 = await validationManager.validateModelExistence(modelId);
      const detection2 = WorkflowTypeDetector.detectModelType(modelId);
      WorkflowRouter.routeWorkflow(modelId, detection2, validation2.actualFileName!, params2);

      // Validation should only call ComfyUI once due to caching
      expect(mockComfyApi.fetchApi).toHaveBeenCalledTimes(1);
      expect(validation1.timestamp).toBe(validation2.timestamp);

      // Both workflow builders should be called with different params
      expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux-dev.safetensors', params1);
      expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux-dev.safetensors', params2);
      expect(buildFluxDevWorkflow).toHaveBeenCalledTimes(2);
    });

    it('should handle cache expiry correctly', async () => {
      const modelId = 'comfyui/flux-dev';

      // First validation
      await validationManager.validateModelExistence(modelId);
      expect(mockComfyApi.fetchApi).toHaveBeenCalledTimes(1);

      // Clear cache manually
      validationManager.clearCache();

      // Second validation should refetch
      await validationManager.validateModelExistence(modelId);
      expect(mockComfyApi.fetchApi).toHaveBeenCalledTimes(2);
    });
  });

  describe('Priority and Confidence Levels', () => {
    it('should demonstrate priority routing for conflicting model signals', async () => {
      // Test case where model ID suggests one variant but could be interpreted as another
      const modelId = 'comfyui/flux-dev'; // Exact match for dev

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['flux-dev.safetensors']],
              },
            },
          },
        }),
        ok: true,
      });

      // Complete flow
      const validation = await validationManager.validateModelExistence(modelId);
      const detection = WorkflowTypeDetector.detectModelType(modelId);

      // Should detect as dev with high confidence (exact match priority)
      expect(detection).toMatchObject({
        confidence: 'high',
        variant: 'dev',
      });

      // Should route to dev workflow
      WorkflowRouter.routeWorkflow(modelId, detection, validation.actualFileName!, { prompt: 'test' });
      expect(buildFluxDevWorkflow).toHaveBeenCalled();
      expect(buildFluxSchnellWorkflow).not.toHaveBeenCalled();
    });

    it('should handle generic flux models as custom models', async () => {
      const modelId = 'comfyui/some-custom-flux-model';

      // Mock as non-standard model (would fail validation)
      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['some-custom-flux-model.safetensors']],
              },
            },
          },
        }),
        ok: true,
      });

      // Validation should succeed for custom flux models that exist on server
      const validationResult = await validationManager.validateModelExistence(modelId);
      expect(validationResult).toMatchObject({
        actualFileName: 'some-custom-flux-model.safetensors',
        exists: true,
      });

      // Detection should still work with low confidence fallback to dev
      const detection = WorkflowTypeDetector.detectModelType(modelId);
      expect(detection).toMatchObject({
        architecture: 'flux',
        // Fallback to dev for generic flux models
        confidence: 'low', 
        variant: 'dev',
      });
    });
  });

  describe('Error Propagation and Recovery', () => {
    it('should propagate workflow builder errors through complete flow', async () => {
      const modelId = 'comfyui/flux-dev';

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['flux-dev.safetensors']],
              },
            },
          },
        }),
        ok: true,
      });

      // Mock workflow builder failure
      const builderError = new Error('Workflow generation failed');
      (buildFluxDevWorkflow as any).mockImplementation(() => {
        throw builderError;
      });

      // Complete flow up to workflow generation
      const validation = await validationManager.validateModelExistence(modelId);
      const detection = WorkflowTypeDetector.detectModelType(modelId);

      expect(validation.exists).toBe(true);
      expect(detection.isSupported).toBe(true);

      // Should propagate builder error wrapped in WorkflowRoutingError
      expect(() => {
        WorkflowRouter.routeWorkflow(modelId, detection, validation.actualFileName!, { prompt: 'test' });
      }).toThrow(WorkflowRoutingError);

      // Verify the original error is preserved in the wrapper
      try {
        WorkflowRouter.routeWorkflow(modelId, detection, validation.actualFileName!, { prompt: 'test' });
      } catch (error) {
        expect(error).toBeInstanceOf(WorkflowRoutingError);
        expect((error as WorkflowRoutingError).message).toContain('Workflow generation failed');
      }
    });

    it('should handle malformed detection results gracefully', async () => {
      // Use a non-exact match model ID to force architecture routing
      const modelId = 'comfyui/custom-flux-model';

      mockComfyApi.fetchApi.mockResolvedValue({
        json: () => Promise.resolve({
          CheckpointLoaderSimple: {
            input: {
              required: {
                ckpt_name: [['custom-flux-model.safetensors']],
              },
            },
          },
        }),
        ok: true,
      });

      const validation = await validationManager.validateModelExistence(modelId);
      
      // Create malformed detection result with unsupported variant
      const malformedDetection = {
        architecture: 'flux' as any,
        confidence: 'high' as any, 
        // This variant doesn't exist in FLUX_WORKFLOW_BUILDERS
        isSupported: true,
        variant: 'unknown' as any,
      };

      // Should throw WorkflowRoutingError for unknown FLUX variant
      expect(() => {
        WorkflowRouter.routeWorkflow(modelId, malformedDetection, validation.actualFileName!, { prompt: 'test' });
      }).toThrow(WorkflowRoutingError);

      // Also test with unsupported architecture
      const unsupportedArchDetection = {
        architecture: 'unknown' as any,
        confidence: 'high' as any,
        isSupported: false,
        variant: 'unknown' as any,
      };

      expect(() => {
        WorkflowRouter.routeWorkflow(modelId, unsupportedArchDetection, validation.actualFileName!, { prompt: 'test' });
      }).toThrow(WorkflowRoutingError);
    });
  });
});