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
  variant: string;
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
// Model ID to Variant Mapping
// Maps common model IDs to their corresponding variants
// ===================================================================

/**
 * Model ID to Variant mapping
 * Maps actual frontend model IDs to their corresponding variants in registry
 * Based on src/config/aiModels/comfyui.ts definitions
 */
/* eslint-disable sort-keys-fix/sort-keys-fix */
export const MODEL_ID_VARIANT_MAP: Record<string, string> = {
  // FLUX models - based on actual frontend IDs
  'flux-schnell': 'schnell', // comfyui/flux-schnell
  'flux-dev': 'dev', // comfyui/flux-dev
  'flux-krea-dev': 'krea', // comfyui/flux-krea-dev
  'flux-kontext-dev': 'kontext', // comfyui/flux-kontext-dev

  // SD3 models - based on actual frontend IDs
  'stable-diffusion-35': 'sd35', // comfyui/stable-diffusion-35
  'stable-diffusion-35-inclclip': 'sd35-inclclip', // comfyui/stable-diffusion-35-inclclip

  // SD1/SDXL models - based on actual frontend IDs
  'stable-diffusion-15': 'sd15-t2i', // comfyui/stable-diffusion-15
  'stable-diffusion-xl': 'sdxl-t2i', // comfyui/stable-diffusion-xl
  'stable-diffusion-refiner': 'sdxl-i2i', // comfyui/stable-diffusion-refiner
  'stable-diffusion-custom': 'custom-sd', // comfyui/stable-diffusion-custom
  'stable-diffusion-custom-refiner': 'custom-sd', // comfyui/stable-diffusion-custom-refiner
};
/* eslint-enable sort-keys-fix/sort-keys-fix */

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
