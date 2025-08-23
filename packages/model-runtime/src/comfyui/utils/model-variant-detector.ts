/**
 * Simple model variant detection utility
 * Detects FLUX model variants from filename using basic string matching
 */

export type ModelVariant =
  | 'dev'
  | 'fill'
  | 'kontext'
  | 'krea'
  | 'lite'
  | 'mini'
  | 'redux'
  | 'schnell';

/**
 * Detect model variant from filename
 * @param fileName - The model filename to analyze
 * @returns The detected variant or null if none found
 */
export function detectVariant(fileName: string): ModelVariant | null {
  const lower = fileName.toLowerCase();
  
  // Check for specific variants (order matters for accuracy)
  if (lower.includes('schnell')) return 'schnell';
  if (lower.includes('kontext')) return 'kontext';
  if (lower.includes('krea')) return 'krea';
  if (lower.includes('lite')) return 'lite';
  if (lower.includes('mini')) return 'mini';
  if (lower.includes('fill')) return 'fill';
  if (lower.includes('redux')) return 'redux';
  if (lower.includes('dev')) return 'dev';
  
  return null;
}

/**
 * Check if filename appears to be a FLUX model
 * @param fileName - The model filename to check
 * @returns True if it looks like a FLUX model
 */
export function isFluxModel(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.includes('flux');
}