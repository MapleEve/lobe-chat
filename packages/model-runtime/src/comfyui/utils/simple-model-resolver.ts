/**
 * Simple Model Resolver - Replace over-engineered mapping system
 * 
 * This replaces 1000+ lines of complex fuzzy matching, Levenshtein distance calculations,
 * pattern recognition, and confidence scoring with simple O(1) model registry lookups.
 * 
 * KISS Principle: Keep It Simple, Stupid
 */

import { MODEL_REGISTRY, type ModelConfig, getModelConfig } from '../config/modelRegistry';

export class ModelNotFoundError extends Error {
  constructor(modelName: string) {
    super(`Model not found: ${modelName}. Only verified FLUX models are supported.`);
    this.name = 'ModelNotFoundError';
  }
}

/**
 * Simple model resolver - O(1) lookup in MODEL_REGISTRY
 * @param modelName - The model filename (with or without path)
 * @returns Model configuration or null if not found
 */
export function resolveModel(modelName: string): ModelConfig | null {
  // Remove path, keep only filename
  const fileName = modelName.split('/').pop() || modelName;
  
  // Direct O(1) lookup
  let config = getModelConfig(fileName);
  
  // If not found, try case-insensitive lookup
  if (!config) {
    const lowerFileName = fileName.toLowerCase();
    for (const [registryName, registryConfig] of Object.entries(MODEL_REGISTRY)) {
      if (registryName.toLowerCase() === lowerFileName) {
        config = registryConfig;
        break;
      }
    }
  }
  
  return config || null;
}

/**
 * Resolve model with error throwing for strict validation
 * @param modelName - The model filename
 * @returns Model configuration
 * @throws {ModelNotFoundError} when model is not found
 */
export function resolveModelStrict(modelName: string): ModelConfig {
  const config = resolveModel(modelName);
  if (!config) {
    throw new ModelNotFoundError(modelName);
  }
  return config;
}

/**
 * Check if model exists in registry
 * @param modelName - The model filename
 * @returns Whether model is supported
 */
export function isValidModel(modelName: string): boolean {
  return resolveModel(modelName) !== null;
}

/**
 * Get all supported model names
 * @returns Array of all model filenames in registry
 */
export function getAllModels(): string[] {
  return Object.keys(MODEL_REGISTRY);
}