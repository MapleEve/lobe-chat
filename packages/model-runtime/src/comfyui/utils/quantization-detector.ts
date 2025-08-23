/**
 * Simple quantization type detection utility
 * Replaces the complex ModelNameStandardizer for basic quantization detection
 */

export type QuantizationType =
  | 'bnb_nf4'
  | 'fp16'
  | 'fp32'
  | 'fp8'
  | 'fp8_e4m3fn'
  | 'fp8_e5m2'
  | 'gguf_q2_k'
  | 'gguf_q3_k_s'
  | 'gguf_q4_k_s'
  | 'gguf_q5_k_s'
  | 'gguf_q6_k'
  | 'gguf_q8_0'
  | 'int4'
  | 'int8'
  | 'nf4';

/**
 * Detect quantization type from model filename using simple string matching
 * @param fileName - The model filename to analyze
 * @returns The detected quantization type or null if none found
 */
export function detectQuantization(fileName: string): QuantizationType | null {
  const lower = fileName.toLowerCase();
  
  // Specific precision detection (most specific first)
  if (lower.includes('fp8_e5m2') || lower.includes('fp8-e5m2')) return 'fp8_e5m2';
  if (lower.includes('fp8_e4m3fn') || lower.includes('fp8-e4m3fn')) return 'fp8_e4m3fn';
  
  // GGUF quantization detection
  if (lower.includes('q2_k')) return 'gguf_q2_k';
  if (lower.includes('q3_k_s')) return 'gguf_q3_k_s';
  if (lower.includes('q4_k_s')) return 'gguf_q4_k_s';
  if (lower.includes('q5_k_s')) return 'gguf_q5_k_s';
  if (lower.includes('q6_k')) return 'gguf_q6_k';
  if (lower.includes('q8_0')) return 'gguf_q8_0';
  
  // Other quantization types
  if (lower.includes('bnb-nf4') || lower.includes('bnb_nf4')) return 'bnb_nf4';
  if (lower.includes('nf4')) return 'nf4';
  if (lower.includes('int4')) return 'int4';
  if (lower.includes('int8')) return 'int8';
  if (lower.includes('fp32')) return 'fp16'; // Map to FP16 as high precision
  if (lower.includes('fp16')) return 'fp16';
  if (lower.includes('fp8')) return 'fp8';
  
  return null;
}