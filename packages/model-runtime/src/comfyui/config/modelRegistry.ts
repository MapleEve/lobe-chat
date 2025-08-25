/**
 * FLUX Model Registry Configuration / FLUX 模型注册表配置
 * Data-Logic Separation: Enhanced 224+ model configurations / 数据与逻辑分离：增强的224+个模型配置
 * Based on FLUX Model Verification Table - 2025-08-24 / 基于FLUX模型合并验证表格-2025-08-24
 * RFC-128 T2.5: Expanded and reorganized with proper priority sorting
 */

export interface ModelConfig {
  /** Priority level: 1=Official, 2=Enterprise, 3=Community / 优先级：1=官方，2=企业，3=社区 */
  priority: number;
  /** Recommended data type / 推荐数据类型 */
  recommendedDtype: 'default' | 'gguf' | 'fp8' | 'nf4' | 'fp8_e4m3fn' | 'fp16';
  /** Model variant / 模型变体 */
  variant: 'dev' | 'schnell' | 'kontext' | 'krea' | 'fill' | 'redux' | 'lite' | 'mini';
}

export const MODEL_REGISTRY: Record<string, ModelConfig> = {

'flux-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'dev'
  },

// ===================================================================
// === PRIORITY 2: ENTERPRISE MODELS ===
// ===================================================================
// === GGUF Quantized ===
// FLUX.1-dev GGUF Series
'flux1-dev-F16.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

'flux1-dev-Q2_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

'flux1-dev-Q3_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

'flux1-dev-Q3_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },








// ===================================================================
// === PRIORITY 1: OFFICIAL MODELS (Black Forest Labs) ===
// ===================================================================
// === FLUX 1.0 Dev ===
'flux1-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-dev-Q4_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

'flux1-fill-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'fill'
  },

'flux1-dev-Q4_1.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

// === FLUX 1.0 Variants ===
'flux1-kontext-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'kontext'
  },

'flux1-dev-Q4_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

// === FLUX 1.0 Schnell ===
'flux1-schnell.safetensors': {
    priority: 1,
    recommendedDtype: 'fp8_e4m3fn',
    variant: 'schnell'
  },

  'flux1-dev-Q4_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

  'flux1-krea-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'krea'
  },

  'flux1-dev-Q5_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

  'flux1-redux-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'redux'
  },

  'flux1-dev-Q5_1.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

  'flux1-dev-Q5_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

  'flux1-dev-Q5_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

  'flux1-dev-Q6_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

  'flux1-dev-Q8_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

  // FLUX.1-schnell GGUF Series
  'flux1-schnell-F16.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },

  'flux1-schnell-Q2_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },

  'flux1-schnell-Q3_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },
  // FLUX.1-kontext GGUF Series
'flux1-kontext-dev-F16.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },

'flux1-schnell-Q3_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },

'flux1-kontext-dev-Q2_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },

'flux1-schnell-Q4_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },

'flux1-kontext-dev-Q3_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },

'flux1-schnell-Q4_1.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },

'flux1-kontext-Q4_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },

'flux1-schnell-Q4_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },

'flux1-kontext-Q4_1.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },

'flux1-schnell-Q4_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },


  'flux1-kontext-Q5_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  }

'flux1-schnell-Q5_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  }

'flux1-kontext-Q5_1.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  }

'flux1-schnell-Q5_1.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  }

'flux1-kontext-Q5_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  }

'flux1-schnell-Q5_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  }

'flux1-kontext-dev-Q3_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  }

'flux1-schnell-Q6_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  }

'flux1-kontext-dev-Q4_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  }

'flux1-schnell-Q8_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  }

'flux1-kontext-dev-Q4_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  }

'flux1-kontext-dev-Q5_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  }

'flux1-kontext-dev-Q6_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  }

'flux1-kontext-dev-Q8_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },


  'flux1-krea-Q4_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux1-krea-Q4_1.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux1-krea-Q5_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux1-krea-Q5_1.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux1-krea-Q5_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  // FLUX.1-krea GGUF Series
'flux1-krea-dev-F16.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  // === FP8 Optimized ===
'flux1-dev-fp8.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  },

'flux1-krea-dev-Q2_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux1-dev-fp8-e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  },

'flux1-krea-dev-Q3_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux1-dev-fp8-e5m2.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  },

'flux1-krea-dev-Q3_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux1-kontext-dev-fp8-e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'kontext'
  },

'flux1-krea-dev-Q4_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },


  'flux1-kontext-dev-fp8-e5m2.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'kontext'
  }

'flux1-krea-dev-Q4_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  // === NF4 Quantized ===
'flux1-dev-bnb-nf4.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'dev'
  },

'flux1-dev-bnb-nf4-v2.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'dev'
  },

'flux1-krea-dev-Q5_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux1-dev-nf4-v2.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'dev'
  },

// === Enterprise Optimized ===
'flux.1-lite-8B.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'lite'
  },

'flux1-krea-dev-Q6_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'flux-mini.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'mini'
  },



'flux1-krea-dev-Q8_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },

'FLUX_Mini_3_2B.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'mini'
  },

'flux.1-lite-8B-alpha.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'lite'
  },

'flux1-schnell-fp8-e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'schnell'
  },

'flux1-dev-svdquant-4bit.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-schnell-fp8-e5m2.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'schnell'
  },


  // === Advanced Quantization Technologies ===
'flux1-dev-svdquant-w4a4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-krea-dev-fp8-e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'krea'
  },

'flux1-dev-quanto-qfloat8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-krea-dev-fp8-e5m2.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'krea'
  },



'flux1-dev-quanto-int8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-kontext-dev-bnb-nf4.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'kontext'
  }

'flux1-dev-mflux-q4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'flux1-schnell-bnb-nf4.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'schnell'
  }

'flux1-dev-torchao-int4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'flux1-krea-dev-bnb-nf4.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'krea'
  }

'flux1-dev-torchao-int8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  // === Chinese Platform Models ===
'alibaba-flux-chinese.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-schnell-mflux-q4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },

'flux-guofeng-art.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-schnell-quanto-qfloat8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },



'comfyui-flux-integration-17gb.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-schnell-svdquant-w4a4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },

'flux-muchen-asian.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux-hyper-sd-acceleration.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux1-schnell-torchao-int8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },



'f.1-dev-schnell-8steps-fp8.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  },
  // === Platform Variants ===
'hf-mirror-flux-dev.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  // === Component Models ===
'clip_l.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'hf-mirror-flux-schnell.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },

'flux-dev2pro.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'juggernaut_base_flux.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'diffusion_pytorch_model-00001-of-00003.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'juggernaut_lightning_flux.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'diffusion_pytorch_model-00002-of-00003.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'juggernaut_pro_flux.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },


  // ===================================================================
// === PRIORITY 3: COMMUNITY MODELS ===
// ===================================================================
// === Community Fine-tunes - Dev Base ===
'CreArt_Hyper_Flux_Dev_8steps.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'Acorn_Spinning_FLUX_photorealism.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'moyou-film-flux.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'Flux_Unchained_SCG_mixed.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'PixelWave_FLUX.1-dev_03.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux-yanling-anime.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'RealFlux_1.0b_Dev_Transformer.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'flux.1-ultra-realphoto-v2.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'Fluxmania_V6I.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'Fluxmania_IV_fp8.safetensors': {
    priority: 3,
    recommendedDtype: 'fp8',
    variant: 'dev'
  }

't5xxl_fp16.safetensors': {
    priority: 2,
    recommendedDtype: 'fp16',
    variant: 'dev'
  }

'Fluxmania_V6I_fp16.safetensors': {
    priority: 3,
    recommendedDtype: 'fp16',
    variant: 'dev'
  }

't5xxl_fp8_e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  }

'FuxCapacity2.1-Q8_0.gguf': {
    priority: 3,
    recommendedDtype: 'gguf',
    variant: 'dev'
  }

'Fluxed_Up_NSFW_v2.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'diffusion_pytorch_model-00003-of-00003.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'FLUX1_Compact_CLIP_VAE.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'FuxCapacity3.0_FP8.safetensors': {
    priority: 3,
    recommendedDtype: 'fp8',
    variant: 'dev'
  }

'UltraReal_FineTune_v4.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'FuxCapacity3.1_FP16.safetensors': {
    priority: 3,
    recommendedDtype: 'fp16',
    variant: 'dev'
  }

'UltraRealistic_FineTune_Project_v4.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'Fux_Capacity_NSFW_v3.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'realDream_flux1V1.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'NF4_BnB_FLUX_dev_optimized.safetensors': {
    priority: 3,
    recommendedDtype: 'nf4',
    variant: 'dev'
  }

'vision_realistic_flux_dev_v2.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'Jib_Mix_Flux_v8_schnell.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  },

// === Community Fine-tunes - Schnell Base ===
'PixelWave_FLUX.1-schnell_04.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  },

// === Community Fine-tunes - Krea Base ===
'Jib_mix_Flux_V11_Krea_b_00001_.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'krea'
  },

'RealFlux_1.0b_Schnell.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  },

'FluxMania_Kreamania_v1.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'krea'
  },



'XPlus_2(GGUF_Q4).gguf': {
    priority: 3,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

'XPlus_2(GGUF_Q6).gguf': {
    priority: 3,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

'XPlus_2(GGUF_Q8).gguf': {
    priority: 3,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },

'educational-flux-simplified.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

// === Community Fine-tunes - Kontext Base ===
'flux-depth-fp16.safetensors': {
    priority: 3,
    recommendedDtype: 'fp16',
    variant: 'kontext'
  },


// === LoRA Adapters ===
'anime_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },



'flux_fusion_v2_4steps.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'art_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux-fill-object-removal.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'kontext'
  },



'disney_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'flux-schnell-dev-merged-fp8.safetensors': {
    priority: 3,
    recommendedDtype: 'fp8',
    variant: 'schnell'
  },

'flux-anime-rainbow-light-lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },


  'realDream_flux1V1_schnell.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  }

'flux-detailer-enhancement-lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'flux-first-person-selfie-lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'schnellMODE_FLUX_S_v5_1.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  }

'flux-kodak-grain-lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'flux-medical-environment-lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'kontext'
  }

'jibMixFlux_v8.q4_0.gguf': {
    priority: 3,
    recommendedDtype: 'gguf',
    variant: 'krea'
  }

'furry_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'mjv6_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'realism_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'scenery_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  }

'watercolor_painting_schnell_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  }

} as const;

/**
 * Get model configuration / 获取模型配置
 * @param modelName Model file name / 模型文件名
 * @returns Model configuration object or undefined / 模型配置对象或undefined
 */
export function getModelConfig(modelName: string): ModelConfig | undefined {
  return MODEL_REGISTRY[modelName];
}

/**
 * Get models by variant / 根据变体获取模型列表
 * @param variant Model variant / 模型变体
 * @returns Array of matching model names / 匹配的模型名称列表
 */
export function getModelsByVariant(variant: ModelConfig['variant']): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, config]) => config.variant === variant)
    .map(([modelName]) => modelName);
}

/**
 * Get models by priority / 根据优先级获取模型列表
 * @param priority Priority level / 优先级
 * @returns Array of matching model names / 匹配的模型名称列表
 */
export function getModelsByPriority(priority: number): string[] {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, config]) => config.priority === priority)
    .map(([modelName]) => modelName);
}
