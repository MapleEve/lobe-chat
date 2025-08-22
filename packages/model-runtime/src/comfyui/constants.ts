/**
 * ComfyUI 框架常量配置
 * 统一管理所有硬编码值，支持环境变量覆盖
 */

/**
 * 默认配置
 */
export const COMFYUI_DEFAULTS = {
  BASE_URL: process.env.COMFYUI_DEFAULT_URL || 'http://localhost:8188',
  CONNECTION_TIMEOUT: 30_000,
  MAX_RETRIES: 3,
} as const;

/**
 * FLUX 模型配置
 */
export const FLUX_MODEL_CONFIG = {
  CLIP: {
    CLIP_L: 'clip_l.safetensors',
    T5XXL: 't5xxl_fp16.safetensors',
  },
  FILENAME_PREFIXES: {
    DEV: 'LobeChat/%year%-%month%-%day%/FLUX_Dev',
    KONTEXT: 'LobeChat/%year%-%month%-%day%/FLUX_Kontext',
    KREA: 'LobeChat/%year%-%month%-%day%/FLUX_Krea',
    SCHNELL: 'LobeChat/%year%-%month%-%day%/FLUX_Schnell',
  },
  VAE: {
    DEFAULT: 'ae.safetensors',
  },
} as const;

/**
 * 工作流节点默认参数
 * 基于 2024 年社区最佳实践配置
 */
export const WORKFLOW_DEFAULTS = {
  IMAGE: {
    BATCH_SIZE: 1,
    HEIGHT: 1024,
    WIDTH: 1024,
  },
  // FLUX Kontext 特定配置 - 图像编辑模型
  KONTEXT: {
    CFG: 3.5, // 使用 guidance distillation，可用较低 CFG
    STEPS: 28, // 图像编辑需要更多步数确保质量
  },

  // FLUX Krea 特定配置 - 摄影美学优化
  KREA: {
    CFG: 3.5, // 摄影真实感使用 3.5 或更低
    STEPS: 15, // 快速高质量生成，15 步足够
  },

  NOISE: {
    SEED: 0, // Use 0 as default, will be overridden by SDK's seed() function when needed
  },

  SAMPLING: {
    // FLUX Dev: CFG 3.5 用于 Distilled CFG，常规 CFG 应设为 1
    // 更自然的效果可使用 CFG 2，但 3.5 提供更强的提示词遵循
    CFG: 3.5,
    DENOISE: 1,
    MAX_SHIFT: 1.15,
    SAMPLER: 'euler',
    SCHEDULER: 'simple',
    // FLUX Dev 最佳步数范围 20-30，25 步优化面部，30 步完善服装/手部
    STEPS: 25,
  },

  // FLUX Schnell 特定配置
  SCHNELL: {
    CFG: 1, // Schnell 应使用 CFG 1
    STEPS: 4, // Schnell 推荐 1-4 步，4 步最佳
  },
} as const;

/**
 * 风格关键词配置 - 按类别组织便于维护和扩展
 */
export const STYLE_KEYWORDS = {
  // 艺术家和平台
  ARTISTS: [
    'by greg rutkowski',
    'by artgerm',
    'trending on artstation',
    'concept art',
    'illustration',
    'artwork',
    'painting',
  ],

  // 艺术风格
  ART_STYLES: [
    'photorealistic',
    'photo realistic',
    'realistic',
    'anime',
    'cartoon',
    'oil painting',
    'watercolor',
    'sketch',
    'digital art',
    '3d render',
    'pixel art',
    'manga',
    'cinematic',
  ],

  // 光照效果
  LIGHTING: [
    'dramatic lighting',
    'soft lighting',
    'studio lighting',
    'golden hour',
    'neon lights',
    'rim lighting',
    'volumetric lighting',
    'natural lighting',
    'warm lighting',
    'cold lighting',
  ],

  // 摄影术语
  PHOTOGRAPHY: [
    'depth of field',
    'bokeh',
    'motion blur',
    'film grain',
    'macro',
    'wide angle',
    'telephoto',
    'portrait',
    'landscape',
    'close-up',
    'dof',
  ],

  // 质量描述
  QUALITY: [
    'high quality',
    'best quality',
    '4k',
    '8k',
    'ultra detailed',
    'highly detailed',
    'masterpiece',
    'professional',
    'sharp focus',
    'detailed',
    'intricate',
  ],

  // 渲染和效果
  RENDERING: [
    'octane render',
    'unreal engine',
    'ray tracing',
    'global illumination',
    'subsurface scattering',
    'bloom',
    'lens flare',
  ],
} as const;

/**
 * 获取所有风格关键词 - 扁平化数组
 */
export const getAllStyleKeywords = (): readonly string[] => {
  return Object.values(STYLE_KEYWORDS).flat();
};

/**
 * 权重数据类型配置
 */
export const WEIGHT_DTYPES = {
  AUTO: 'default',
  FP16: 'fp16',
  FP8_E4M3FN: 'fp8_e4m3fn',
  FP8_E5M2: 'fp8_e5m2',
} as const;

/**
 * 错误类型配置
 */
export const COMFYUI_ERROR_TYPES = {
  CONNECTION_FAILED: 'ComfyUIConnectionFailed',
  EMPTY_RESULT: 'ComfyUIEmptyResult',
  INVALID_CREDENTIALS: 'ComfyUIInvalidCredentials',
  UPLOAD_FAILED: 'ComfyUIUploadFailed',
  WORKFLOW_FAILED: 'ComfyUIWorkflowFailed',
} as const;
