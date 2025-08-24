/**
 * RFC-128: Model architecture types
 */
export type ModelArchitecture = 'flux' | 'sd' | 'unknown';

/**
 * RFC-128: FLUX model variants
 */
export type FluxVariant = 'dev' | 'schnell' | 'kontext' | 'krea';

/**
 * RFC-128: Model type detection result
 */
export interface ModelTypeDetectionResult {
  /** The detected model architecture */
  architecture: ModelArchitecture;
  /** Confidence level of the detection (0-1) */
  confidence: number;
  /** Detection method used */
  detectionMethod: 'exact' | 'variant' | 'keyword' | 'unknown';
  /** Whether this model is supported by the current system */
  isSupported: boolean;
  /** The specific FLUX variant (if applicable) */
  variant?: FluxVariant;
}

/**
 * RFC-128: Workflow Type Detector
 * 
 * Responsible for detecting model types and architectures to ensure
 * compatibility with appropriate workflow builders.
 */
export class WorkflowTypeDetector {
  /**
   * Known FLUX model exact matches
   */
  private static readonly EXACT_FLUX_MODELS = new Set([
    'flux-dev',
    'flux-schnell', 
    'flux-kontext-dev',
    'flux-krea-dev',
  ]);

  /**
   * FLUX variant keywords
   */
  private static readonly FLUX_VARIANT_KEYWORDS: Record<FluxVariant, string[]> = {
    dev: ['dev', 'development'],
    kontext: ['kontext', 'context'],
    krea: ['krea', 'creative'],
    schnell: ['schnell', 'fast', 'quick'],
  };

  /**
   * General FLUX keywords
   */
  private static readonly FLUX_KEYWORDS = [
    'flux',
    'flux.1',
    'flux1',
    'black-forest-labs',
  ];

  /**
   * Detect model type and architecture
   */
  static detectModelType(modelId: string): ModelTypeDetectionResult {
    const cleanModelId = modelId.replace(/^comfyui\//, '').toLowerCase();

    // 1. Exact match detection (highest confidence)
    const exactResult = this.detectExactMatch(cleanModelId);
    if (exactResult.isSupported) {
      return exactResult;
    }

    // 2. Variant-based detection (high confidence)
    const variantResult = this.detectFluxVariant(cleanModelId);
    if (variantResult.isSupported) {
      return variantResult;
    }

    // 3. Keyword-based detection (medium confidence)
    const keywordResult = this.detectFluxKeywords(cleanModelId);
    if (keywordResult.isSupported) {
      return keywordResult;
    }

    // 4. Unknown model (no support)
    return {
      architecture: 'unknown',
      confidence: 0,
      detectionMethod: 'unknown',
      isSupported: false,
    };
  }

  /**
   * Detect exact model matches
   */
  private static detectExactMatch(modelId: string): ModelTypeDetectionResult {
    // Remove common extensions
    const withoutExt = modelId.replace(/\.(safetensors|ckpt|pt)$/, '');
    
    if (this.EXACT_FLUX_MODELS.has(withoutExt)) {
      return {
        architecture: 'flux',
        confidence: 1,
        detectionMethod: 'exact',
        isSupported: true,
        variant: this.getVariantFromModelId(withoutExt),
      };
    }

    return {
      architecture: 'unknown',
      confidence: 0,
      detectionMethod: 'exact',
      isSupported: false,
    };
  }

  /**
   * Detect FLUX variants by keywords
   */
  private static detectFluxVariant(modelId: string): ModelTypeDetectionResult {
    // Must contain 'flux' to be considered a FLUX model
    if (!this.containsFluxKeyword(modelId)) {
      return {
        architecture: 'unknown',
        confidence: 0,
        detectionMethod: 'variant',
        isSupported: false,
      };
    }

    // Check for specific variants
    for (const [variant, keywords] of Object.entries(this.FLUX_VARIANT_KEYWORDS)) {
      if (keywords.some(keyword => modelId.includes(keyword))) {
        return {
          architecture: 'flux',
          confidence: 0.8,
          detectionMethod: 'variant',
          isSupported: true,
          variant: variant as FluxVariant,
        };
      }
    }

    // General FLUX model without specific variant (assume dev)
    return {
      architecture: 'flux',
      // Default to dev variant
confidence: 0.7,
      
detectionMethod: 'variant', 
      isSupported: true,
      variant: 'dev',
    };
  }

  /**
   * Detect FLUX models by general keywords
   */
  private static detectFluxKeywords(modelId: string): ModelTypeDetectionResult {
    if (this.containsFluxKeyword(modelId)) {
      return {
        architecture: 'flux',
        // Default to dev variant
confidence: 0.6,
        
detectionMethod: 'keyword', 
        isSupported: true,
        variant: 'dev',
      };
    }

    return {
      architecture: 'unknown',
      confidence: 0,
      detectionMethod: 'keyword',
      isSupported: false,
    };
  }

  /**
   * Check if model ID contains FLUX keywords
   */
  private static containsFluxKeyword(modelId: string): boolean {
    return this.FLUX_KEYWORDS.some(keyword => modelId.includes(keyword));
  }

  /**
   * Get FLUX variant from exact model ID
   */
  private static getVariantFromModelId(modelId: string): FluxVariant {
    if (modelId.includes('schnell')) return 'schnell';
    if (modelId.includes('kontext')) return 'kontext';
    if (modelId.includes('krea')) return 'krea';
    return 'dev'; // Default
  }

  /**
   * Validate architecture compatibility
   */
  static validateArchitectureCompatibility(architecture: ModelArchitecture): boolean {
    // Currently only FLUX is supported
    return architecture === 'flux';
  }

  /**
   * Check if model is FLUX
   */
  static isFluxModel(modelId: string): boolean {
    const result = this.detectModelType(modelId);
    return result.architecture === 'flux';
  }

  /**
   * Get supported architectures
   */
  static getSupportedArchitectures(): ModelArchitecture[] {
    return ['flux'];
  }

  /**
   * Get supported FLUX variants
   */
  static getSupportedFluxVariants(): FluxVariant[] {
    return ['dev', 'schnell', 'kontext', 'krea'];
  }

  /**
   * Get detection statistics for monitoring
   */
  static getDetectionStats(modelIds: string[]): {
    exactMatches: number;
    fluxModels: number;
    keywordMatches: number;
    supportedModels: number;
    totalModels: number;
    unknownModels: number;
    unsupportedModels: number;
    variantMatches: number;
  } {
    const results = modelIds.map(id => this.detectModelType(id));
    
    return {
      exactMatches: results.filter(r => r.detectionMethod === 'exact').length,
      fluxModels: results.filter(r => r.architecture === 'flux').length,
      keywordMatches: results.filter(r => r.detectionMethod === 'keyword').length,
      supportedModels: results.filter(r => r.isSupported).length,
      totalModels: results.length,
      unknownModels: results.filter(r => r.detectionMethod === 'unknown').length,
      unsupportedModels: results.filter(r => !r.isSupported).length,
      variantMatches: results.filter(r => r.detectionMethod === 'variant').length,
    };
  }
}