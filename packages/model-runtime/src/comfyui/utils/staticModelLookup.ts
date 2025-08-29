/**
 * Model Name Resolver Utilities
 *
 * Helper functions for resolving model names to configurations
 */
import debug from 'debug';

import {
  MODEL_ID_VARIANT_MAP,
  MODEL_REGISTRY,
  type ModelConfig,
  getModelConfig,
} from '../config/modelRegistry';

const log = debug('lobe-image:comfyui:static-model-lookup');

/**
 * Resolve a model name to its configuration
 * This is a helper function for static model config lookup
 */
export function resolveModel(modelName: string): ModelConfig | null {
  log('Resolving static model config for:', modelName);

  // Clean the model name
  const cleanName = modelName.replace(/^comfyui\//, '');

  // First try exact match with filename
  const config = getModelConfig(cleanName);
  if (config) {
    return config;
  }

  // Try to resolve using model ID mapping
  const mappedVariant = MODEL_ID_VARIANT_MAP[cleanName];
  if (mappedVariant) {
    // Find first model with this variant
    for (const [, modelConfig] of Object.entries(MODEL_REGISTRY)) {
      if (modelConfig.variant === mappedVariant) {
        return modelConfig;
      }
    }
  }

  // Fallback: Try to match by variant name (legacy logic)
  for (const [, modelConfig] of Object.entries(MODEL_REGISTRY)) {
    // Check if clean name matches variant exactly or ends with variant
    if (
      cleanName === modelConfig.variant ||
      cleanName.endsWith(`-${modelConfig.variant}`) ||
      cleanName.endsWith(modelConfig.variant)
    ) {
      return modelConfig;
    }
  }

  log('No static config found for:', modelName);
  return null;
}
