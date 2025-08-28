/**
 * ComfyUI Model Registry - Linus-style simple design
 * Combines FLUX and SD model families while maintaining KISS principle
 * Interface shared, registries split for maintainability
 */
import { FLUX_MODEL_REGISTRY } from './fluxModelRegistry';
import { SD_MODEL_REGISTRY } from './sdModelRegistry';

export interface ModelConfig {
  modelFamily: 'FLUX' | 'SD1' | 'SDXL' | 'SD3';
  priority: number;
  recommendedDtype?: 'default' | 'fp8_e4m3fn' | 'fp8_e4m3fn_fast' | 'fp8_e5m2';
  variant:
    | 'dev'
    | 'schnell'
    | 'kontext'
    | 'krea'
    | 'sd35'
    | 'sd35-inclclip'
    | 'sd3'
    | 'sd15-t2i'
    | 'sdxl-t2i'
    | 'sdxl-i2i'
    | 'custom-sd';
}

// ===================================================================
// Combined Model Registry - FLUX + SD families
// Maintained KISS principle by composing separate registries
// ===================================================================

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  ...FLUX_MODEL_REGISTRY,
  ...SD_MODEL_REGISTRY,
};

// ===================================================================
// Universal Query Interface - One Function Rules All
// ===================================================================

/**
 * Get models by variant, sorted by priority
 */
export function getModelsByVariant(variant: ModelConfig['variant']): string[] {
  const matchingModels: Array<{ fileName: string; priority: number }> = [];

  for (const [fileName, config] of Object.entries(MODEL_REGISTRY)) {
    if (config.variant === variant) {
      matchingModels.push({ fileName, priority: config.priority });
    }
  }

  // Sort by priority (lower number = higher priority)
  return matchingModels.sort((a, b) => a.priority - b.priority).map((item) => item.fileName);
}

/**
 * Get single model config
 */
export function getModelConfig(
  modelName: string,
  options?: {
    caseInsensitive?: boolean;
    modelFamily?: ModelConfig['modelFamily'];
    priority?: number;
    recommendedDtype?: ModelConfig['recommendedDtype'];
    variant?: ModelConfig['variant'];
  },
): ModelConfig | undefined {
  // Direct lookup - KISS principle
  let config = MODEL_REGISTRY[modelName];

  // If not found and case-insensitive search requested, try case-insensitive lookup
  if (!config && options?.caseInsensitive) {
    const lowerModelName = modelName.toLowerCase();
    for (const [registryName, registryConfig] of Object.entries(MODEL_REGISTRY)) {
      if (registryName.toLowerCase() === lowerModelName) {
        config = registryConfig;
        break;
      }
    }
  }

  if (!config) return undefined;

  // No filters - return the config
  if (!options) return config;

  // Check filters (excluding caseInsensitive which is not a model property filter)
  const matches =
    (!options.variant || config.variant === options.variant) &&
    (!options.priority || config.priority === options.priority) &&
    (!options.modelFamily || config.modelFamily === options.modelFamily) &&
    (!options.recommendedDtype || config.recommendedDtype === options.recommendedDtype);

  return matches ? config : undefined;
}

/**
 * Get all model names from the registry
 * @returns Array of all model filenames
 */
export function getAllModelNames(): string[] {
  return Object.keys(MODEL_REGISTRY);
}
