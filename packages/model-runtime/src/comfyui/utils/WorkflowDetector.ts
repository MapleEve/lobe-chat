/**
 * Simple Workflow Detector - RFC-128 Replacement
 *
 * Replaces 257 lines of complex pattern matching with simple O(1) lookups.
 * KISS principle: Keep It Simple, Stupid.
 */

export type ModelArchitecture = 'flux' | 'unknown';
export type FluxVariant = 'dev' | 'schnell' | 'kontext' | 'krea';

export interface ModelTypeDetectionResult {
  architecture: ModelArchitecture;
  isSupported: boolean;
  variant?: FluxVariant;
}

/**
 * Simple workflow type detector
 */
export class WorkflowDetector {
  private static readonly SUPPORTED_MODELS = new Set([
    'flux-dev',
    'flux-schnell',
    'flux-kontext-dev',
    'flux-krea-dev',
  ]);

  /**
   * Detect model type - O(1) lookup
   */
  static detectModelType(modelId: string): ModelTypeDetectionResult {
    const cleanId = modelId.replace(/^comfyui\//, '');

    if (this.SUPPORTED_MODELS.has(cleanId)) {
      return {
        architecture: 'flux',
        isSupported: true,
        variant: this.getVariant(cleanId),
      };
    }

    return {
      architecture: 'unknown',
      isSupported: false,
    };
  }

  /**
   * Get FLUX variant from model ID
   */
  private static getVariant(modelId: string): FluxVariant {
    if (modelId.includes('schnell')) return 'schnell';
    if (modelId.includes('kontext')) return 'kontext';
    if (modelId.includes('krea')) return 'krea';
    return 'dev';
  }

  /**
   * Check if FLUX model
   */
  static isFluxModel(modelId: string): boolean {
    return this.detectModelType(modelId).architecture === 'flux';
  }
}
