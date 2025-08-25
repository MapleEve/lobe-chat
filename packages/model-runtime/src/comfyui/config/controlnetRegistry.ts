/**
 * ControlNet Registry Configuration
 * XLabs-AI Official FLUX ControlNet Models
 */

export interface ControlNetConfig {
  /** Compatible model variants */
  compatibleVariants: string[];
  /** Model family this ControlNet is designed for */
  modelFamily: 'FLUX';
  /** Priority level: 1=Official, 2=Community, 3=Experimental */
  priority: number;
  /** ControlNet type */
  type: 'canny' | 'depth' | 'hed' | 'pose' | 'scribble' | 'normal' | 'semantic';
}

export const CONTROLNET_REGISTRY: Record<string, ControlNetConfig> = {
  // ===================================================================
  // === XLabs-AI Official FLUX ControlNet Models ===
  // === All Priority 1 (Official), All Compatible with FLUX.1-dev ===
  // ===================================================================

  'flux-controlnet-canny-v3.safetensors': {
    compatibleVariants: ['dev'],
    modelFamily: 'FLUX',
    priority: 1,
    type: 'canny',
  },

  'flux-controlnet-depth-v3.safetensors': {
    compatibleVariants: ['dev'],
    modelFamily: 'FLUX',
    priority: 1,
    type: 'depth',
  },

  'flux-controlnet-hed-v3.safetensors': {
    compatibleVariants: ['dev'],
    modelFamily: 'FLUX',
    priority: 1,
    type: 'hed',
  },
} as const;

/**
 * Get ControlNet configuration
 * @param controlnetName ControlNet file name
 * @returns ControlNet configuration object or undefined
 */
export function getControlNetConfig(controlnetName: string): ControlNetConfig | undefined {
  return CONTROLNET_REGISTRY[controlnetName];
}

/**
 * Get compatible ControlNets for a model variant
 * @param variant Model variant
 * @returns Array of compatible ControlNet names
 */
export function getCompatibleControlNets(variant: string): string[] {
  return Object.entries(CONTROLNET_REGISTRY)
    .filter(([, config]) => config.compatibleVariants.includes(variant))
    .map(([controlnetName]) => controlnetName);
}

/**
 * Get ControlNets by type
 * @param type ControlNet type
 * @returns Array of matching ControlNet names
 */
export function getControlNetsByType(type: ControlNetConfig['type']): string[] {
  return Object.entries(CONTROLNET_REGISTRY)
    .filter(([, config]) => config.type === type)
    .map(([controlnetName]) => controlnetName);
}

/**
 * Get ControlNets by priority
 * @param priority Priority level
 * @returns Array of matching ControlNet names
 */
export function getControlNetsByPriority(priority: number): string[] {
  return Object.entries(CONTROLNET_REGISTRY)
    .filter(([, config]) => config.priority === priority)
    .map(([controlnetName]) => controlnetName);
}

/**
 * Get ControlNets by model family
 * @param modelFamily Model family
 * @returns Array of matching ControlNet names
 */
export function getControlNetsByModelFamily(modelFamily: 'FLUX'): string[] {
  return Object.entries(CONTROLNET_REGISTRY)
    .filter(([, config]) => config.modelFamily === modelFamily)
    .map(([controlnetName]) => controlnetName);
}

/**
 * Get compatible FLUX ControlNets for a model variant
 * @param variant Model variant
 * @returns Array of compatible FLUX ControlNet names
 */
export function getCompatibleFluxControlNets(variant: string): string[] {
  return Object.entries(CONTROLNET_REGISTRY)
    .filter(
      ([, config]) => config.modelFamily === 'FLUX' && config.compatibleVariants.includes(variant),
    )
    .map(([controlnetName]) => controlnetName);
}
