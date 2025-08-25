/**
 * Simple Workflow Detector
 *
 * Replaces 257 lines of complex pattern matching with simple O(1) lookups.
 * KISS principle: Keep It Simple, Stupid.
 */
import { resolveModel } from './modelResolver';
import type { WorkflowDetectionResult } from './workflowRouter';

export type FluxVariant = 'dev' | 'schnell' | 'kontext' | 'krea';
export type SD3Variant = 'sd35';

/**
 * Simple workflow type detector using model registry
 */
export const WorkflowDetector = {
  /**
   * Detect model type using model registry - O(1) lookup
   */
  detectModelType(modelId: string): WorkflowDetectionResult {
    const cleanId = modelId.replace(/^comfyui\//, '');

    // Check if model exists in registry
    const config = resolveModel(cleanId);

    if (config) {
      if (config.modelFamily === 'FLUX') {
        return {
          architecture: 'FLUX',
          isSupported: true,
          variant: config.variant as FluxVariant,
        };
      } else if (config.modelFamily === 'SD3') {
        return {
          architecture: 'SD3',
          isSupported: true,
          variant: config.variant as SD3Variant,
        };
      }
    }

    return {
      architecture: 'unknown',
      isSupported: false,
    };
  },
};
