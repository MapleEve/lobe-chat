/**
 * Simple Workflow Detector
 *
 * Replaces 257 lines of complex pattern matching with simple O(1) lookups.
 * KISS principle: Keep It Simple, Stupid.
 */
import { resolveModel } from './modelResolver';
import type { WorkflowDetectionResult } from './workflowRouter';

export type FluxVariant = 'dev' | 'schnell' | 'kontext' ;
export type SD3Variant = 'sd35' | 'sd-t2i';
export type SDVariant = 'sd-t2i' | 'sd-i2i';

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
      // Return the detection result with the actual variant from config
      // No type casting needed - just pass through the variant
      return {
        architecture: config.modelFamily === 'FLUX' ? 'FLUX' : 
                     config.modelFamily === 'SD3' ? 'SD3' :
                     config.modelFamily === 'SD1' ? 'SD1' :
                     config.modelFamily === 'SDXL' ? 'SDXL' : 'unknown',
        isSupported: true,
        variant: config.variant,
      };
    }

    return {
      architecture: 'unknown',
      isSupported: false,
    };
  },
};
