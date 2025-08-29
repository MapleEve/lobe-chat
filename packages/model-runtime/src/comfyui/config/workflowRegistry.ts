import type { PromptBuilder } from '@saintno/comfyui-sdk';
import type { WorkflowContext } from '../services/workflowBuilder';
import { FLUX_MODEL_CONFIG, SD_MODEL_CONFIG } from '../constants';

// Import all workflow builders
import { buildFluxDevWorkflow } from '../workflows/flux-dev';
import { buildFluxKontextWorkflow } from '../workflows/flux-kontext';
import { buildFluxSchnellWorkflow } from '../workflows/flux-schnell';
import { buildSD35Workflow } from '../workflows/sd35';
import { buildSimpleSDWorkflow } from '../workflows/simple-sd';

// Workflow builder type
type WorkflowBuilder = (
  modelFileName: string,
  params: Record<string, any>,
  context: WorkflowContext,
) => Promise<PromptBuilder<any, any, any>>;

/**
 * Variant to Workflow mapping
 * Based on actual model registry variant values
 */
/* eslint-disable sort-keys-fix/sort-keys-fix */
export const VARIANT_WORKFLOW_MAP: Record<string, WorkflowBuilder> = {
  // FLUX variants
  'dev': buildFluxDevWorkflow,
  'schnell': buildFluxSchnellWorkflow,
  'kontext': buildFluxKontextWorkflow,
  'krea': buildFluxDevWorkflow,

  // SD3 variants
  'sd35': buildSD35Workflow,           // needs external encoders
  'sd35-inclclip': buildSimpleSDWorkflow,  // built-in encoders

  // SD1/SDXL variants
  'sd15-t2i': buildSimpleSDWorkflow,
  'sdxl-t2i': buildSimpleSDWorkflow,
  'sdxl-i2i': buildSimpleSDWorkflow,
  'custom-sd': buildSimpleSDWorkflow,
};

/**
 * Architecture default workflows (when variant not matched)
 */
export const ARCHITECTURE_DEFAULT_MAP: Record<string, WorkflowBuilder> = {
  'FLUX': buildFluxDevWorkflow,
  'SD3': buildSD35Workflow,
  'SD1': buildSimpleSDWorkflow,
  'SDXL': buildSimpleSDWorkflow,
};
/* eslint-enable sort-keys-fix/sort-keys-fix */


/**
 * Get the appropriate workflow builder for a given architecture and variant
 *
 * @param architecture - Model architecture (FLUX, SD3, SD1, SDXL)
 * @param variant - Model variant (dev, schnell, kontext, sd35, etc.)
 * @returns Workflow builder function or undefined if not found
 */
export function getWorkflowBuilder(
  architecture: string,
  variant?: string,
): WorkflowBuilder | undefined {
  // Prefer variant mapping
  if (variant && VARIANT_WORKFLOW_MAP[variant]) {
    return VARIANT_WORKFLOW_MAP[variant];
  }

  // Fallback to architecture default
  return ARCHITECTURE_DEFAULT_MAP[architecture];
}

// workflow 函数到默认文件名类型的映射
/* eslint-disable sort-keys-fix/sort-keys-fix */
const WORKFLOW_DEFAULT_TYPE: Record<string, string> = {
  'buildFluxDevWorkflow': 'DEV',
  'buildFluxSchnellWorkflow': 'SCHNELL',
  'buildFluxKontextWorkflow': 'KONTEXT',
  'buildSD35Workflow': 'SD35',
  'buildSimpleSDWorkflow': 'SD15',
} as const;

// 变体覆盖规则
const VARIANT_TYPE_OVERRIDE: Record<string, string> = {
  // FLUX 特殊变体
  'krea': 'KREA',  // 覆盖 buildFluxDevWorkflow 的默认输出

  // SD 特殊变体
  'sd35': 'SD35',
  'sd35-inclclip': 'SD35',
  'sdxl-t2i': 'SDXL',
  'sdxl-i2i': 'SDXL',
  'custom-sd': 'CUSTOM',

  // 模型族
  'FLUX': 'DEV',
  'SD3': 'SD35',
  'SD1': 'SD15',
  'SDXL': 'SDXL',
} as const;
/* eslint-enable sort-keys-fix/sort-keys-fix */

// 获取文件名前缀的函数
export function getWorkflowFilenamePrefix(
  workflowName: string,
  variant?: string
): string {
  // 1. 优先使用变体覆盖
  const type = variant && VARIANT_TYPE_OVERRIDE[variant]
    ? VARIANT_TYPE_OVERRIDE[variant]
    : WORKFLOW_DEFAULT_TYPE[workflowName];

  if (!type) {
    return 'LobeChat/%year%-%month%-%day%/Unknown';
  }

  // 2. 根据类型获取文件名前缀
  if (type in FLUX_MODEL_CONFIG.FILENAME_PREFIXES) {
    return FLUX_MODEL_CONFIG.FILENAME_PREFIXES[type as keyof typeof FLUX_MODEL_CONFIG.FILENAME_PREFIXES];
  }

  if (type in SD_MODEL_CONFIG.FILENAME_PREFIXES) {
    return SD_MODEL_CONFIG.FILENAME_PREFIXES[type as keyof typeof SD_MODEL_CONFIG.FILENAME_PREFIXES];
  }

  return 'LobeChat/%year%-%month%-%day%/Unknown';
}
