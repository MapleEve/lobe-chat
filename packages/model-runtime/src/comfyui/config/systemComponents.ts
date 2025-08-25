/**
 * System Components Registry Configuration
 * FLUX模型系统编码器组件配置 (5个)
 */

export interface ComponentConfig {
  /** Model family this component is designed for */
  modelFamily: 'FLUX';
  /** Priority level: 1=Essential, 2=Standard, 3=Optional */
  priority: number;
  /** Component type: vae, clip, or t5 encoder */
  type: 'vae' | 'clip' | 't5';
}

export const SYSTEM_COMPONENTS: Record<string, ComponentConfig> = {
  // ===================================================================
  // === ESSENTIAL COMPONENTS (Priority 1) ===
  // ===================================================================

  'ae.safetensors': {
    modelFamily: 'FLUX',
    priority: 1,
    type: 'vae',
  },

  'clip_l.safetensors': {
    modelFamily: 'FLUX',
    priority: 1,
    type: 'clip',
  },

  // ===================================================================
  // === STANDARD COMPONENTS (Priority 2) ===
  // ===================================================================

  't5xxl_fp16.safetensors': {
    modelFamily: 'FLUX',
    priority: 2,
    type: 't5',
  },

  't5xxl_fp8_e4m3fn.safetensors': {
    modelFamily: 'FLUX',
    priority: 2,
    type: 't5',
  },

  't5xxl_fp8_e5m2.safetensors': {
    modelFamily: 'FLUX',
    priority: 2,
    type: 't5',
  },
} as const;

/**
 * Get component configuration
 * @param componentName Component file name
 * @returns Component configuration object or undefined
 */
export function getComponentConfig(componentName: string): ComponentConfig | undefined {
  return SYSTEM_COMPONENTS[componentName];
}

/**
 * Get components by type
 * @param type Component type
 * @returns Array of matching component names
 */
export function getComponentsByType(type: ComponentConfig['type']): string[] {
  return Object.entries(SYSTEM_COMPONENTS)
    .filter(([, config]) => config.type === type)
    .map(([componentName]) => componentName);
}

/**
 * Get components by priority
 * @param priority Priority level
 * @returns Array of matching component names
 */
export function getComponentsByPriority(priority: number): string[] {
  return Object.entries(SYSTEM_COMPONENTS)
    .filter(([, config]) => config.priority === priority)
    .map(([componentName]) => componentName);
}

/**
 * Get components by model family
 * @param modelFamily Model family
 * @returns Array of matching component names
 */
export function getComponentsByModelFamily(modelFamily: 'FLUX'): string[] {
  return Object.entries(SYSTEM_COMPONENTS)
    .filter(([, config]) => config.modelFamily === modelFamily)
    .map(([componentName]) => componentName);
}
