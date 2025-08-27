import type { PromptBuilder } from '@saintno/comfyui-sdk';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowError } from '../../errors';
import { buildFluxDevWorkflow } from '../../workflows/flux-dev';
import { buildFluxKontextWorkflow } from '../../workflows/flux-kontext';
import { buildFluxSchnellWorkflow } from '../../workflows/flux-schnell';
import { buildSD35Workflow } from '../../workflows/sd35';
import { buildSimpleSDWorkflow } from '../../workflows/simple-sd';
import { type WorkflowDetectionResult, WorkflowRouter } from '../../utils/workflowRouter';

// Mock workflow builders
vi.mock('../../workflows/flux-dev', () => ({
  buildFluxDevWorkflow: vi.fn(),
}));

vi.mock('../../workflows/flux-kontext', () => ({
  buildFluxKontextWorkflow: vi.fn(),
}));

vi.mock('../../workflows/flux-schnell', () => ({
  buildFluxSchnellWorkflow: vi.fn(),
}));

vi.mock('../../workflows/sd35', () => ({
  buildSD35Workflow: vi.fn(),
}));

vi.mock('../../workflows/simple-sd', () => ({
  buildSimpleSDWorkflow: vi.fn(),
}));

describe('WorkflowRouter', () => {
  let mockPromptBuilder: PromptBuilder<any, any, any>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock PromptBuilder instance
    mockPromptBuilder = {
      prompt: { '1': { class_type: 'TestNode', inputs: {} } },
      input: vi.fn(),
      clone: vi.fn(),
    } as unknown as PromptBuilder<any, any, any>;

    // Setup workflow builder mocks
    (buildFluxDevWorkflow as Mock).mockReturnValue(mockPromptBuilder);
    (buildFluxSchnellWorkflow as Mock).mockReturnValue(mockPromptBuilder);
    (buildFluxKontextWorkflow as Mock).mockReturnValue(mockPromptBuilder);
    (buildSD35Workflow as Mock).mockReturnValue(mockPromptBuilder);
    (buildSimpleSDWorkflow as Mock).mockReturnValue(mockPromptBuilder);
  });

  describe('Factory Pattern - routeWorkflow', () => {
    describe('Input Validation', () => {
      it('should throw WorkflowError when modelId is null', () => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'FLUX',
          isSupported: true,
        };

        try {
          WorkflowRouter.routeWorkflow(null as any, detectionResult, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.INVALID_CONFIG);
          expect(error.message).toBe(
            'Invalid parameters: modelId and detectionResult are required',
          );
          expect(error.details).toHaveProperty('modelId', null);
        }
      });

      it('should throw WorkflowError when modelId is undefined', () => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'FLUX',
          isSupported: true,
        };

        try {
          WorkflowRouter.routeWorkflow(undefined as any, detectionResult, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.INVALID_CONFIG);
        }
      });

      it('should throw WorkflowError when modelId is empty string', () => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'FLUX',
          isSupported: true,
        };

        try {
          WorkflowRouter.routeWorkflow('', detectionResult, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.INVALID_CONFIG);
        }
      });

      it('should throw WorkflowError when detectionResult is null', () => {
        try {
          WorkflowRouter.routeWorkflow('flux-dev', null as any, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.INVALID_CONFIG);
        }
      });

      it('should throw WorkflowError when detectionResult is undefined', () => {
        try {
          WorkflowRouter.routeWorkflow('flux-dev', undefined as any, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.INVALID_CONFIG);
        }
      });

      it('should include modelId in error when validation fails', () => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'FLUX',
          isSupported: true,
        };

        try {
          WorkflowRouter.routeWorkflow('', detectionResult, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.INVALID_CONFIG);
          expect(error.details).toHaveProperty('modelId', '');
        }
      });
    });

    describe('Support Validation', () => {
      it('should throw WorkflowError when model is not supported', () => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'unknown',
          isSupported: false,
        };

        try {
          WorkflowRouter.routeWorkflow('unknown-model', detectionResult, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.UNSUPPORTED_MODEL);
          expect(error.message).toBe(
            'Unsupported model architecture: unknown for model unknown-model',
          );
        }
      });

      it('should include modelId in unsupported error', () => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'unknown',
          isSupported: false,
        };

        try {
          WorkflowRouter.routeWorkflow('stable-diffusion-v1', detectionResult, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.UNSUPPORTED_MODEL);
          expect(error.details).toHaveProperty('modelId', 'stable-diffusion-v1');
        }
      });
    });

    describe('Exact Model Matching', () => {
      const supportedResult: WorkflowDetectionResult = {
        architecture: 'FLUX',
        isSupported: true,
      };

      it('should route flux-dev to buildFluxDevWorkflow', () => {
        const result = WorkflowRouter.routeWorkflow(
          'flux-dev',
          supportedResult,
          'flux-dev.safetensors',
          { steps: 20 },
        );

        expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux-dev.safetensors', { steps: 20 });
        expect(result).toBe(mockPromptBuilder);
      });

      it('should route flux-kontext-dev to buildFluxKontextWorkflow', () => {
        const result = WorkflowRouter.routeWorkflow(
          'flux-kontext-dev',
          supportedResult,
          'flux-kontext-dev.safetensors',
          { guidance: 7.5 },
        );

        expect(buildFluxKontextWorkflow).toHaveBeenCalledWith('flux-kontext-dev.safetensors', {
          guidance: 7.5,
        });
        expect(result).toBe(mockPromptBuilder);
      });

      it('should route flux-krea-dev to buildFluxDevWorkflow (merged template)', () => {
        const result = WorkflowRouter.routeWorkflow(
          'flux-krea-dev',
          supportedResult,
          'flux-krea-dev.safetensors',
          { cfg: 3.5, samplerName: 'dpmpp_2m_sde', scheduler: 'karras' },
        );

        expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux-krea-dev.safetensors', {
          cfg: 3.5,
          samplerName: 'dpmpp_2m_sde', 
          scheduler: 'karras'
        });
        expect(result).toBe(mockPromptBuilder);
      });

      it('should route flux-schnell to buildFluxSchnellWorkflow', () => {
        const result = WorkflowRouter.routeWorkflow(
          'flux-schnell',
          supportedResult,
          'flux-schnell.safetensors',
          { steps: 4 },
        );

        expect(buildFluxSchnellWorkflow).toHaveBeenCalledWith('flux-schnell.safetensors', {
          steps: 4,
        });
        expect(result).toBe(mockPromptBuilder);
      });


      it('should route stable-diffusion-15 to SimpleSD workflow', () => {
        const result = WorkflowRouter.routeWorkflow(
          'stable-diffusion-15',
          supportedResult,
          'sd-v1-5.safetensors',
          { steps: 20, cfg: 7.5 },
        );

        expect(buildSimpleSDWorkflow).toHaveBeenCalledWith('sd-v1-5.safetensors', { steps: 20, cfg: 7.5 });
        expect(result).toBe(mockPromptBuilder);
      });

      it('should route stable-diffusion-xl to SimpleSD workflow', () => {
        const result = WorkflowRouter.routeWorkflow(
          'stable-diffusion-xl',
          supportedResult,
          'sdxl-base.safetensors',
          { steps: 25, cfg: 7.0 },
        );

        expect(buildSimpleSDWorkflow).toHaveBeenCalledWith('sdxl-base.safetensors', { steps: 25, cfg: 7.0 });
        expect(result).toBe(mockPromptBuilder);
      });

      it('should route stable-diffusion-35 to buildSD35Workflow', () => {
        const result = WorkflowRouter.routeWorkflow(
          'stable-diffusion-35',
          supportedResult,
          'sd3.5_large.safetensors',
          { steps: 28, cfg: 4.5 },
        );

        expect(buildSD35Workflow).toHaveBeenCalledWith('sd3.5_large.safetensors', { steps: 28, cfg: 4.5 });
        expect(result).toBe(mockPromptBuilder);
      });

      it('should pass empty params when not provided', () => {
        WorkflowRouter.routeWorkflow('flux-dev', supportedResult, 'flux-dev.safetensors');

        expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux-dev.safetensors', {});
      });
    });

    describe('Fallback Routing', () => {
      const supportedResult: WorkflowDetectionResult = {
        architecture: 'FLUX',
        isSupported: true,
      };

      it('should fallback to variant builder when exact match not found', () => {
        const detectionWithVariant: WorkflowDetectionResult = {
          ...supportedResult,
          variant: 'dev',
        };

        const result = WorkflowRouter.routeWorkflow(
          'flux-v1-dev',
          detectionWithVariant,
          'flux-v1-dev.safetensors',
          { guidance: 8.5 },
        );

        expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux-v1-dev.safetensors', {
          guidance: 8.5,
        });
        expect(result).toBe(mockPromptBuilder);
      });

      it('should fallback to kontext variant builder', () => {
        const detectionWithVariant: WorkflowDetectionResult = {
          ...supportedResult,
          variant: 'kontext',
        };

        const result = WorkflowRouter.routeWorkflow(
          'flux-custom-kontext',
          detectionWithVariant,
          'flux-custom-kontext.safetensors',
        );

        expect(buildFluxKontextWorkflow).toHaveBeenCalledWith(
          'flux-custom-kontext.safetensors',
          {},
        );
        expect(result).toBe(mockPromptBuilder);
      });

      it('should route krea models through exact matching to dev template', () => {
        const result = WorkflowRouter.routeWorkflow(
          'flux-krea-dev',
          supportedResult,
          'flux-krea-dev.safetensors',
          { cfg: 3.5 },
        );

        expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux-krea-dev.safetensors', { cfg: 3.5 });
        expect(result).toBe(mockPromptBuilder);
      });

      it('should fallback to schnell variant builder', () => {
        const detectionWithVariant: WorkflowDetectionResult = {
          ...supportedResult,
          variant: 'schnell',
        };

        const result = WorkflowRouter.routeWorkflow(
          'custom-schnell',
          detectionWithVariant,
          'custom-schnell.safetensors',
        );

        expect(buildFluxSchnellWorkflow).toHaveBeenCalledWith('custom-schnell.safetensors', {});
        expect(result).toBe(mockPromptBuilder);
      });

      it('should fallback to sd35 variant builder', () => {
        const detectionWithVariant: WorkflowDetectionResult = {
          ...supportedResult,
          variant: 'sd35',
        };

        const result = WorkflowRouter.routeWorkflow(
          'sd3.5_medium',
          detectionWithVariant,
          'sd3.5_medium.safetensors',
        );

        expect(buildSD35Workflow).toHaveBeenCalledWith('sd3.5_medium.safetensors', {});
        expect(result).toBe(mockPromptBuilder);
      });

      // 简化后的sd variant测试
      it('should route sd variant to SimpleSD workflow', () => {
        const detectionWithVariant: WorkflowDetectionResult = {
          ...supportedResult,
          variant: 'sd',
        };

        const result = WorkflowRouter.routeWorkflow(
          'stable-diffusion-custom',
          detectionWithVariant,
          'custom-model.safetensors',
          { steps: 25, cfg: 7.5 },
        );

        expect(buildSimpleSDWorkflow).toHaveBeenCalledWith('custom-model.safetensors', { 
          steps: 25,
          cfg: 7.5
        });
        expect(result).toBe(mockPromptBuilder);
      });
    });

    describe('Error Cases', () => {
      it('should throw WorkflowError when no builder found', () => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'FLUX',
          isSupported: true,
          // No variant specified
        };

        try {
          WorkflowRouter.routeWorkflow('unknown-model', detectionResult, 'test.safetensors');
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.reason).toBe(WorkflowError.Reasons.UNSUPPORTED_MODEL);
          expect(error.message).toContain('No workflow builder found for model');
        }
      });

      it('should include model details in no builder error', () => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'FLUX',
          isSupported: true,
        };

        try {
          WorkflowRouter.routeWorkflow(
            'experimental-model',
            detectionResult,
            'experimental.safetensors',
          );
          expect.fail('Should have thrown an error');
        } catch (error: any) {
          expect(error).toBeInstanceOf(WorkflowError);
          expect(error.details).toHaveProperty('modelId', 'experimental-model');
          expect(error.details).toHaveProperty('variant', undefined);
        }
      });

      it('should handle workflow builder errors', () => {
        const supportedResult: WorkflowDetectionResult = {
          architecture: 'FLUX',
          isSupported: true,
        };

        const builderError = new Error('Builder failed');
        (buildFluxDevWorkflow as Mock).mockImplementation(() => {
          throw builderError;
        });

        try {
          WorkflowRouter.routeWorkflow('flux-dev', supportedResult, 'flux-dev.safetensors', {
            steps: 20,
          });
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBe(builderError);
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in model ID', () => {
      const detectionResult: WorkflowDetectionResult = {
        architecture: 'FLUX',
        isSupported: true,
        variant: 'dev',
      };

      const result = WorkflowRouter.routeWorkflow(
        'flux@dev#v1',
        detectionResult,
        'flux-dev.safetensors',
      );

      expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux-dev.safetensors', {});
      expect(result).toBe(mockPromptBuilder);
    });

    it('should handle case sensitivity in exact matching', () => {
      const detectionResult: WorkflowDetectionResult = {
        architecture: 'FLUX',
        isSupported: true,
      };

      // Should not find exact match for uppercase
      try {
        WorkflowRouter.routeWorkflow('FLUX-DEV', detectionResult, 'test.safetensors');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error).toBeInstanceOf(WorkflowError);
        expect(error.reason).toBe(WorkflowError.Reasons.UNSUPPORTED_MODEL);
      }
    });
  });
});
