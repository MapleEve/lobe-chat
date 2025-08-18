import { ModelParamsSchema } from '@/libs/standard-parameters';
import { AIImageModelCard } from '@/types/aiModel';

/**
 * FLUX.1 Schnell 模型参数配置
 * 超快速文生图模式，1-4 步即可生成，Apache 2.0 许可证
 */
export const fluxSchnellParamsSchema: ModelParamsSchema = {
  height: { default: 1024, max: 1536, min: 512, step: 8 },
  prompt: { default: '' },
  seed: { default: -1 },
  steps: { default: 4, max: 4, min: 1, step: 1 },
  width: { default: 1024, max: 1536, min: 512, step: 8 },
};

/**
 * FLUX.1 Dev 模型参数配置
 * 高质量文生图模式，支持 guidance scale 调节，非商业许可证
 */
export const fluxDevParamsSchema: ModelParamsSchema = {
  cfg: { default: 3.5, max: 10, min: 1, step: 0.5 },
  height: { default: 1024, max: 2048, min: 512, step: 8 },
  prompt: { default: '' },
  seed: { default: -1 },
  steps: { default: 20, max: 50, min: 10, step: 1 },
  width: { default: 1024, max: 2048, min: 512, step: 8 },
};

/**
 * FLUX.1 Krea-dev 模型参数配置
 * 增强安全的文生图模式，与 Krea 合作开发，非商业许可证
 */
export const fluxKreaDevParamsSchema: ModelParamsSchema = {
  cfg: { default: 4.5, max: 10, min: 1, step: 0.5 },
  height: { default: 1024, max: 2048, min: 512, step: 8 },
  prompt: { default: '' },
  seed: { default: -1 },
  steps: { default: 20, max: 50, min: 10, step: 1 },
  width: { default: 1024, max: 2048, min: 512, step: 8 },
};

/**
 * FLUX.1 Kontext-dev 模型参数配置
 * 图像编辑模式，支持基于文本指令修改现有图像，非商业许可证
 */
export const fluxKontextDevParamsSchema: ModelParamsSchema = {
  cfg: { default: 3.5, max: 10, min: 1, step: 0.5 },
  height: { default: 1024, max: 2048, min: 512, step: 8 },
  imageUrl: { default: '' }, // 输入图像 URL（必需）
  prompt: { default: '' },
  seed: { default: -1 },
  steps: { default: 20, max: 50, min: 10, step: 1 },
  // strength 参数用于控制编辑强度，但目前 standard-parameters 中未定义
  // TODO: 需要扩展 standard-parameters 以支持 strength 参数
  width: { default: 1024, max: 2048, min: 512, step: 8 },
};

/**
 * ComfyUI 支持的图像生成模型列表
 * 第一阶段支持完整的 FLUX 系列模型
 */
const comfyuiImageModels: AIImageModelCard[] = [
  {
    description:
      'FLUX.1 Schnell 是超快速文生图模型，1-4步即可生成高质量图像，适合实时应用。Apache 2.0 开源许可。',
    displayName: 'FLUX.1 Schnell',
    enabled: true,
    id: 'flux/schnell',
    parameters: fluxSchnellParamsSchema,
    releasedAt: '2024-08-01',
    type: 'image',
  },
  {
    description:
      'FLUX.1 Dev 是高质量文生图模型，支持 guidance scale 调节，适合生成高质量作品。非商业许可。',
    displayName: 'FLUX.1 Dev',
    enabled: true,
    id: 'flux/dev',
    parameters: fluxDevParamsSchema,
    releasedAt: '2024-08-01',
    type: 'image',
  },
  {
    description:
      'FLUX.1 Krea-dev 是增强安全的文生图模型，与 Krea 合作开发，内置安全过滤。非商业许可。',
    displayName: 'FLUX.1 Krea-dev',
    enabled: true,
    id: 'flux/krea-dev',
    parameters: fluxKreaDevParamsSchema,
    releasedAt: '2024-08-01',
    type: 'image',
  },
  {
    description: 'FLUX.1 Kontext-dev 是图像编辑模型，支持基于文本指令修改现有图像。非商业许可。',
    displayName: 'FLUX.1 Kontext-dev',
    enabled: true,
    id: 'flux/kontext-dev',
    parameters: fluxKontextDevParamsSchema,
    releasedAt: '2024-08-01',
    type: 'image',
  },
];

export const allModels = [...comfyuiImageModels];

export default allModels;
