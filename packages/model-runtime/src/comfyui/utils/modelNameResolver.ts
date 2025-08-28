/**
 * Model Name Resolver Utilities
 *
 * Helper functions for resolving model names to configurations
 */
import debug from 'debug';

import { MODEL_REGISTRY, type ModelConfig, getModelConfig } from '../config/modelRegistry';

const log = debug('lobe-image:comfyui:model-name-resolver');

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
    log('Found exact match in registry:', cleanName);
    return config;
  }

  // Try to match by variant name
  for (const [filename, modelConfig] of Object.entries(MODEL_REGISTRY)) {
    if (cleanName === modelConfig.variant || cleanName.includes(modelConfig.variant)) {
      log('Found by variant match:', filename);
      return modelConfig;
    }
  }

  log('No static config found for:', modelName);
  return null;
}
