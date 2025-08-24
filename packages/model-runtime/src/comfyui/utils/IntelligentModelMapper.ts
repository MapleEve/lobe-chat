/**
 * Intelligent Model Mapper - RFC-128 Enhanced Model Discovery
 * 
 * Features:
 * - Fuzzy model name matching with similarity scoring
 * - Automatic priority assignment based on naming patterns  
 * - Dynamic model registration for unknown models
 * - Support for 200+ FLUX models through intelligent pattern recognition
 * - Alias/variation support for model names
 */

import { ModelConfig } from '../config/modelRegistry';

interface ModelPattern {
  /** Confidence score (0-1) */
  confidence: number;
  /** Pattern to match against model names */
  pattern: RegExp;
  /** Priority level for matched models */
  priority: number;
  /** Recommended data type */
  recommendedDtype: ModelConfig['recommendedDtype'];
  /** Model variant */
  variant: ModelConfig['variant'];
}

interface FuzzyMatchResult {
  /** Model configuration */
  config: ModelConfig;
  /** Matched model name from registry */
  modelName: string;
  /** Similarity score (0-1, higher is better) */
  similarity: number;
}

interface IntelligentMappingResult {
  /** Confidence score (0-1) */
  confidence: number;
  /** Final model configuration */
  config: ModelConfig;
  /** Mapping method used */
  method: 'exact' | 'fuzzy' | 'pattern' | 'alias';
  /** Suggested model name for registration */
  suggestedName?: string;
}

export class IntelligentModelMapper {
  
  /** Known model aliases and variations */
  private static readonly MODEL_ALIASES = new Map<string, string[]>([
    // Official model variations
    ['flux1-dev.safetensors', [
      'flux-dev.safetensors', 
      'FLUX.1-dev.safetensors',
      'flux_1_dev.safetensors',
      'flux1_dev.safetensors'
    ]],
    ['flux1-schnell.safetensors', [
      'flux-schnell.safetensors',
      'FLUX.1-schnell.safetensors', 
      'flux_1_schnell.safetensors',
      'flux1_schnell.safetensors'
    ]],
    ['flux1-kontext-dev.safetensors', [
      'flux-kontext-dev.safetensors',
      'FLUX.1-Kontext-dev.safetensors',
      'flux1_kontext_dev.safetensors'
    ]],
    ['flux1-krea-dev.safetensors', [
      'flux-krea-dev.safetensors',
      'FLUX.1-Krea-dev.safetensors',
      'flux1_krea_dev.safetensors'
    ]],
    
    // Platform prefix variations
    ['hf-mirror-flux-dev.safetensors', [
      'flux1-dev.safetensors',
      'flux-dev.safetensors'
    ]],
    ['alibaba-flux-chinese.safetensors', [
      'flux1-dev.safetensors',
      'flux-dev.safetensors'
    ]]
  ]);

  /** Model patterns for automatic recognition */
  private static readonly MODEL_PATTERNS: ModelPattern[] = [
    
    // === Priority 1: Official Models ===
    {
      confidence: 1,
      pattern: /^(flux1?[_-]dev|flux\.1[_-]dev)\.safetensors$/i,
      priority: 1,
      recommendedDtype: 'default',
      variant: 'dev'
    },
    {
      confidence: 1,
      pattern: /^(flux1?[_-]schnell|flux\.1[_-]schnell)\.safetensors$/i,
      priority: 1,
      recommendedDtype: 'fp8_e4m3fn',
      variant: 'schnell'
    },
    {
      confidence: 1,
      pattern: /^(flux1?[_-]kontext[_-]dev|flux\.1[_-]kontext[_-]dev)\.safetensors$/i,
      priority: 1,
      recommendedDtype: 'default',
      variant: 'kontext'
    },
    {
      confidence: 1,
      pattern: /^(flux1?[_-]krea[_-]dev|flux\.1[_-]krea[_-]dev)\.safetensors$/i,
      priority: 1,
      recommendedDtype: 'default',
      variant: 'krea'
    },
    {
      confidence: 1,
      pattern: /^(flux1?[_-]fill[_-]dev|flux\.1[_-]fill[_-]dev)\.safetensors$/i,
      priority: 1,
      recommendedDtype: 'default',
      variant: 'fill'
    },
    {
      confidence: 1,
      pattern: /^(flux1?[_-]redux[_-]dev|flux\.1[_-]redux[_-]dev)\.safetensors$/i,
      priority: 1,
      recommendedDtype: 'default',
      variant: 'redux'
    },

    // === Priority 2: Enterprise GGUF Quantized Models ===
    {
      // Will be detected from filename
confidence: 0.95,
      
pattern: /^flux1?[_-](dev|schnell|kontext|krea)[_-].*q([2-68])(_k|_k_s|_k_m|_0|_1|)\.gguf$/i,
      
priority: 2,
      
recommendedDtype: 'gguf', 
      variant: 'dev'
    },
    {
      // Will be detected from filename  
confidence: 0.95,
      
pattern: /^flux1?[_-](dev|schnell|kontext|krea)[_-].*f16\.gguf$/i,
      
priority: 2,
      
recommendedDtype: 'gguf', 
      variant: 'dev'
    },

    // === Priority 2: FP8 Quantized Models ===
    {
      // Will be detected from filename
confidence: 0.9,
      
pattern: /^flux1?[_-](dev|schnell|kontext|krea)[_-].*fp8[_-](e4m3fn|e5m2)\.safetensors$/i,
      
priority: 2,
      
recommendedDtype: 'fp8', 
      variant: 'dev'
    },

    // === Priority 2: NF4 Quantized Models ===
    {
      // Will be detected from filename
confidence: 0.9,
      
pattern: /^flux1?[_-](dev|schnell|kontext|krea)[_-].*(bnb[_-])?nf4([_-]v2)?\.safetensors$/i,
      
priority: 2,
      
recommendedDtype: 'nf4', 
      variant: 'dev'
    },

    // === Priority 2: Advanced Quantization ===
    {
      // Will be detected from filename
confidence: 0.85,
      
pattern: /^flux1?[_-](dev|schnell|kontext|krea)[_-].*(svdquant|torchao|quanto).*\.safetensors$/i,
      
priority: 2,
      
recommendedDtype: 'default', 
      variant: 'dev'
    },

    // === Priority 2: Enterprise Optimized Models ===
    {
      confidence: 0.9,
      pattern: /^(flux\.1[_-]lite[_-]8b|flux[_-]mini).*\.safetensors$/i,
      priority: 2,
      recommendedDtype: 'default',
      variant: 'lite'
    },

    // === Priority 2: Platform Variants ===
    {
      // Will be detected from filename
confidence: 0.8,
      
pattern: /^(hf[_-]mirror|alibaba|comfyui)[_-]flux.*\.safetensors$/i,
      
priority: 2,
      
recommendedDtype: 'default', 
      variant: 'dev'
    },

    // === Priority 3: Community Models ===
    {
      // Will be detected from filename
confidence: 0.8,
      
pattern: /^(real_?dream|vision_?realistic|pixel_?wave|ultra_?real|acorn_?spinning).*flux.*\.safetensors$/i,
      
priority: 3,
      
recommendedDtype: 'default', 
      variant: 'dev'
    },
    {
      // Will be detected from filename  
confidence: 0.75,
      
pattern: /^(jib_?mix|flux_?unchained|creart_?hyper|fluxmania).*\.safetensors$/i,
      
priority: 3,
      
recommendedDtype: 'default', 
      variant: 'dev'
    },
    {
      confidence: 0.8,
      pattern: /^(juggernaut_?(pro|lightning|base)).*flux.*\.safetensors$/i,
      priority: 3,
      recommendedDtype: 'default',
      variant: 'dev'
    },

    // === Priority 3: LoRA Adapters ===
    {
      confidence: 0.9,
      pattern: /^(realism|anime|disney|scenery|art|mjv6)_lora\.safetensors$/i,
      priority: 3,
      recommendedDtype: 'default',
      variant: 'dev'
    },

    // === Generic FLUX Model Fallback ===
    {
      confidence: 0.5,
      pattern: /flux.*\.safetensors$/i,
      priority: 3,
      recommendedDtype: 'default',
      variant: 'dev'
    }
  ];

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array.from({length: str2.length + 1}).fill(null).map(() => Array.from({length: str1.length + 1}).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Extract variant from filename patterns
   */
  private static extractVariant(fileName: string): ModelConfig['variant'] {
    const name = fileName.toLowerCase();
    
    if (name.includes('schnell')) return 'schnell';
    if (name.includes('kontext')) return 'kontext'; 
    if (name.includes('krea')) return 'krea';
    if (name.includes('fill')) return 'fill';
    if (name.includes('redux')) return 'redux';
    if (name.includes('lite') || name.includes('mini')) return 'lite';
    
    return 'dev'; // Default variant
  }

  /**
   * Check if model matches known aliases
   */
  private static findAlias(modelName: string): string | null {
    for (const [canonical, aliases] of this.MODEL_ALIASES) {
      if (aliases.includes(modelName.toLowerCase())) {
        return canonical;
      }
    }
    return null;
  }

  /**
   * Find models using fuzzy string matching
   */
  private static findFuzzyMatches(
    targetName: string, 
    registryKeys: string[], 
    threshold: number = 0.7
  ): FuzzyMatchResult[] {
    const matches: FuzzyMatchResult[] = [];
    
    for (const modelName of registryKeys) {
      const similarity = this.calculateSimilarity(targetName, modelName);
      if (similarity >= threshold) {
        // This would need actual MODEL_REGISTRY access - placeholder for now
        matches.push({
          config: {
            priority: 2,
            recommendedDtype: 'default',
            variant: 'dev'
          },
          modelName,
          similarity
        });
      }
    }

    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Match model using pattern recognition
   */
  private static matchByPattern(modelName: string): ModelConfig | null {
    for (const pattern of this.MODEL_PATTERNS) {
      if (pattern.pattern.test(modelName)) {
        // Extract actual variant from filename if pattern uses generic variant
        const variant = pattern.variant === 'dev' && pattern.confidence < 1 
          ? this.extractVariant(modelName)
          : pattern.variant;

        return {
          priority: pattern.priority,
          recommendedDtype: pattern.recommendedDtype,
          variant
        };
      }
    }
    return null;
  }

  /**
   * Main intelligent mapping method
   */
  public static intelligentMap(
    modelName: string,
    registryKeys: string[] = []
  ): IntelligentMappingResult | null {
    
    // Remove path and get filename only
    const fileName = modelName.split('/').pop() || modelName;

    // 1. Check for exact alias match
    const aliasMatch = this.findAlias(fileName);
    if (aliasMatch) {
      return {
        confidence: 1,
        config: {
          priority: 1,
          recommendedDtype: 'default', 
          variant: this.extractVariant(aliasMatch)
        },
        method: 'alias',
        suggestedName: aliasMatch
      };
    }

    // 2. Try fuzzy matching against known models
    if (registryKeys.length > 0) {
      const fuzzyMatches = this.findFuzzyMatches(fileName, registryKeys, 0.8);
      if (fuzzyMatches.length > 0) {
        const bestMatch = fuzzyMatches[0];
        return {
          confidence: bestMatch.similarity,
          config: bestMatch.config,
          method: 'fuzzy',
          suggestedName: bestMatch.modelName
        };
      }
    }

    // 3. Try pattern-based recognition
    const patternMatch = this.matchByPattern(fileName);
    if (patternMatch) {
      return {
        confidence: 0.8,
        config: patternMatch,
        method: 'pattern' // Base confidence for pattern matching
      };
    }

    // 4. No match found
    return null;
  }

  /**
   * Generate missing models based on patterns from validation table
   */
  public static generateMissingModels(): Record<string, ModelConfig> {
    const missing: Record<string, ModelConfig> = {};

    // Generate missing GGUF quantizations for each base model
    const baseModels = ['dev', 'schnell', 'kontext', 'krea'];
    const quantLevels = ['Q2_K', 'Q3_K_S', 'Q4_0', 'Q4_1', 'Q4_K_S', 'Q5_0', 'Q5_1', 'Q5_K_S', 'Q6_K', 'Q8_0', 'F16'];
    
    for (const base of baseModels) {
      for (const quant of quantLevels) {
        const filename = `flux1-${base}-${quant}.gguf`;
        missing[filename] = {
          priority: 2,
          recommendedDtype: 'gguf',
          variant: base as ModelConfig['variant']
        };
      }
    }

    // Generate missing FP8 models
    const fp8Formats = ['e4m3fn', 'e5m2'];
    for (const base of baseModels) {
      for (const format of fp8Formats) {
        const filename = `flux1-${base}-fp8-${format}.safetensors`;
        missing[filename] = {
          priority: 2,
          recommendedDtype: 'fp8',
          variant: base as ModelConfig['variant']
        };
      }
    }

    // Add specific enterprise models from validation table
    missing['juggernaut_pro_flux.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default',
      variant: 'dev'
    };
    missing['juggernaut_lightning_flux.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default', 
      variant: 'dev'
    };
    missing['juggernaut_base_flux.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default',
      variant: 'dev'
    };

    // Add Chinese platform models
    missing['alibaba-flux-chinese.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default',
      variant: 'dev'
    };
    missing['hf-mirror-flux-dev.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default',
      variant: 'dev'
    };
    missing['hf-mirror-flux-schnell.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default',
      variant: 'schnell'
    };

    // Add advanced quantization models
    missing['flux1-dev-svdquant-4bit.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default',
      variant: 'dev'
    };
    missing['flux1-dev-torchao-int4.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default',
      variant: 'dev'  
    };
    missing['flux1-dev-quanto-int8.safetensors'] = {
      priority: 2,
      recommendedDtype: 'default',
      variant: 'dev'
    };

    return missing;
  }
}