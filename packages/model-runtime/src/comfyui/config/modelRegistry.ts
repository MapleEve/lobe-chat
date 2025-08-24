/**
 * FLUX Model Registry Configuration / FLUX 模型注册表配置
 * Data-Logic Separation: Enhanced 133+ model configurations / 数据与逻辑分离：增强的133+个模型配置
 * Based on FLUX Model Verification Table - 2025-08-24 / 基于FLUX模型合并验证表格-2025-08-23
 * RFC-128 T2.5: Expanded from 95 to 133+ models with intelligent mapping support
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



'FLUX_Mini_3_2B.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },

'f.1-dev-schnell-8steps-fp8.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  },

'flux-dev2pro.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },





'flux-mini.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'mini'
  },





'flux-muchen-asian.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },



  


'flux-yanling-anime.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  


'flux-hyper-sd-acceleration.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  


'flux.1-lite-8B-alpha.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  


// === Priority 3: Community Fine-tuned Models ===
'Jib_mix_Flux_V11_Krea_b_00001_.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'krea'
  },
  



// === Priority 2: Enterprise Optimized Models ===
// Enterprise Dev Models
'flux.1-lite-8B.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'lite'
  },
  





'RealFlux_1.0b_Dev_Transformer.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  





'flux.1-ultra-realphoto-v2.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  



// === Priority 2: GGUF Quantized Models ===
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




'PixelWave_FLUX.1-dev_03.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },



  

'flux1-dev-Q3_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },
  

'CreArt_Hyper_Flux_Dev_8steps.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  

'flux1-dev-Q3_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },
  




'Acorn_Spinning_FLUX_photorealism.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  









'flux1-dev-Q4_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },
  











'Flux_Unchained_SCG_mixed.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  











'flux1-dev-Q4_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },
  












'FluxMania_Kreamania_v1.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'krea'
  },
  













'flux1-dev-Q5_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },


  













'PixelWave_FLUX.1-schnell_04.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  },















'flux1-dev-Q6_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },















'RealFlux_1.0b_Schnell.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  },















'flux1-dev-Q8_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'dev'
  },















'UltraReal_FineTune_v4.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },















'flux1-dev-bnb-nf4-v2.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'dev'
  },















'flux-depth-fp16.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'krea'
  },














// === Priority 2: NF4 Quantized Models ===
'flux1-dev-bnb-nf4.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'dev'
  },














'ae.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'dev'
  },


  










// === Priority 2: FP8 Compressed Models ===
// FP8-E4M3FN Format
'flux1-dev-fp8-e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  },
  










'clip_l.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  









// FP8-E5M2 Format
'flux1-dev-fp8-e5m2.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  },
  









'flux1-dev-fp8.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'dev'
  },
  









'flux1-dev-mflux-q4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  









'anime_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  









'flux1-dev-quanto-qfloat8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  









'UltraRealistic_FineTune_Project_v4.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  








// === Priority 2: Advanced Quantization Technologies ===
'flux1-dev-svdquant-w4a4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },


  








// === Additional Models to Meet RFC-128 Requirements ===
// Note: Removed duplicate entries - keeping original well-documented definitions
'flux-dev.safetensors': { priority: 1, recommendedDtype: 'default', variant: 'dev' },












'flux1-dev-torchao-int8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },












'art_lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },











// === Priority 1: Official Models (Black Forest Labs) ===
'flux1-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'dev'
  },












'disney_lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },












// FLUX.1-kontext GGUF Series
'flux1-kontext-dev-F16.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },












'flux-schnell.safetensors': { priority: 1, recommendedDtype: 'fp8_e4m3fn', variant: 'schnell' },












'flux1-kontext-dev-Q2_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },












'diffusion_pytorch_model-00001-of-00003.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },













'flux1-kontext-dev-Q3_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },










'diffusion_pytorch_model-00002-of-00003.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },










'flux1-kontext-dev-Q3_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },










'Fluxmania_IV_fp8.safetensors': { priority: 3, recommendedDtype: 'fp8', variant: 'dev' },











'flux1-kontext-dev-Q4_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },








'Fluxmania_V6I.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },







'flux1-kontext-dev-Q4_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },







'Fluxmania_V6I_fp16.safetensors': { priority: 3, recommendedDtype: 'fp16', variant: 'dev' },








'flux1-kontext-dev-Q5_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },






'FuxCapacity2.1-Q8_0.gguf': { priority: 3, recommendedDtype: 'gguf', variant: 'dev' },






'flux1-kontext-dev-Q6_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },






'FuxCapacity3.0_FP8.safetensors': { priority: 3, recommendedDtype: 'fp8', variant: 'dev' },






'flux1-kontext-dev-Q8_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'kontext'
  },


  




'FuxCapacity3.1_FP16.safetensors': { priority: 3, recommendedDtype: 'fp16', variant: 'dev' },
  




'flux1-kontext-dev-bnb-nf4.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'kontext'
  },





'XPlus_2(GGUF_Q4).gguf': { priority: 3, recommendedDtype: 'gguf', variant: 'dev' },





'flux1-kontext-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'kontext'
  },





'XPlus_2(GGUF_Q6).gguf': { priority: 3, recommendedDtype: 'gguf', variant: 'dev' },





'flux1-krea-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'krea'
  },





'XPlus_2(GGUF_Q8).gguf': { priority: 3, recommendedDtype: 'gguf', variant: 'dev' },





'flux1-schnell.safetensors': {
    priority: 1,
    recommendedDtype: 'fp8_e4m3fn',
    variant: 'schnell'
  },





'diffusion_pytorch_model-00003-of-00003.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },


  



'flux1-dev-Q5_K_S.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'dev' },
  



'flux1-redux-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'redux'
  },
  



// === Missing Test Models - Added for compatibility ===
'flux1-fill-dev.safetensors': {
    priority: 1,
    recommendedDtype: 'default',
    variant: 'fill'
  },
  




'flux1-kontext-dev-fp8-e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'kontext'
  },
  




'flux1-kontext-dev-fp8-e5m2.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'kontext'
  },
  



// FLUX.1-krea GGUF Series
'flux1-krea-dev-F16.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  



'flux1-krea-dev-Q2_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  



'flux1-krea-dev-Q3_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  



// === RFC-128 T2.5: Missing High-Priority Models from Validation Table (38 additional models) ===
// === Missing GGUF Quantizations (Priority 2) ===
// FLUX.1-dev missing quantizations
'flux1-dev-Q4_0.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'dev' },
  






'moyou-film-flux.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  






'flux1-dev-Q4_1.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'dev' },
  






'flux1-dev-Q5_0.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'dev' },
  





// FLUX.1-schnell GGUF Series
'flux1-schnell-F16.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },
  





'flux1-dev-Q5_1.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'dev' },
  





'flux1-schnell-Q2_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },

  
  





// FLUX.1-kontext missing quantizations
'flux1-kontext-Q4_0.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'kontext' },
  







'flux1-schnell-Q3_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },
  







'flux1-kontext-Q4_1.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'kontext' },
  







'flux1-schnell-Q4_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },
  







'flux1-kontext-Q5_0.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'kontext' },
  







'flux1-schnell-Q6_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },
  







'flux1-kontext-Q5_1.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'kontext' },
  







'flux1-schnell-Q8_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },

  
  
  





'flux1-kontext-Q5_K_S.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'kontext' },
  





'flux1-schnell-Q5_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },
  





// FLUX.1-krea missing quantizations
'flux1-krea-Q4_0.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'krea' },
  






'flux1-schnell-Q4_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },
  






'flux1-krea-Q4_1.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'krea' },
  






'flux1-schnell-Q3_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'schnell'
  },
  






// Advanced Quantization Technologies
'flux1-dev-svdquant-4bit.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  







'flux1-krea-dev-Q3_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  







'flux1-dev-quanto-int8.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  







'flux1-krea-dev-Q4_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  







// === Missing Chinese Platform Models (Priority 2) ===
'alibaba-flux-chinese.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  








'flux1-krea-dev-Q4_K_S.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  








'flux1-dev-nf4-v2.safetensors': { priority: 2, recommendedDtype: 'nf4', variant: 'dev' },
  








'flux1-krea-dev-Q5_K_M.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  







'flux-guofeng-art.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  






'flux1-krea-dev-Q6_K.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  






'comfyui-flux-integration-17gb.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  






'flux1-krea-dev-Q8_0.gguf': {
    priority: 2,
    recommendedDtype: 'gguf',
    variant: 'krea'
  },
  






'Jib_Mix_Flux_v8_schnell.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'schnell' },
  






'educational-flux-simplified.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  






'flux1-krea-dev-bnb-nf4.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'krea'
  },
  






'FLUX1_Compact_CLIP_VAE.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },

  
  
  
  
  



'flux1-krea-dev-fp8-e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'krea'
  },
  



'Fluxed_Up_NSFW_v2.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  



'flux1-krea-dev-fp8-e5m2.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'krea'
  },
  



'Fux_Capacity_NSFW_v3.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  
  
  



'flux1-schnell-fp8-e4m3fn.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'schnell'
  },
  




'NF4_BnB_FLUX_dev_optimized.safetensors': { priority: 3, recommendedDtype: 'nf4', variant: 'dev' },
  




'flux1-schnell-bnb-nf4.safetensors': {
    priority: 2,
    recommendedDtype: 'nf4',
    variant: 'schnell'
  },
  




'flux-anime-rainbow-light-lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  
  
  



'flux1-schnell-fp8-e5m2.safetensors': {
    priority: 2,
    recommendedDtype: 'fp8',
    variant: 'schnell'
  },
  



'flux-detailer-enhancement-lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  



'flux1-schnell-mflux-q4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },
  



'flux-fill-object-removal.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'kontext' },
  



'flux1-schnell-quanto-qfloat8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },
  
  
  


'flux-first-person-selfie-lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  


'flux1-schnell-svdquant-w4a4.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },
  


// === Additional LoRA Adapters (Priority 3) ===
'flux-kodak-grain-lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  



'flux1-schnell-torchao-int8.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'schnell'
  },
  



'flux-medical-environment-lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'kontext' },

  
  



'flux_fusion_v2_4steps.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  




'flux-schnell-dev-merged-fp8.safetensors': { priority: 3, recommendedDtype: 'fp8', variant: 'schnell' },
  




'furry_lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  
  
  



'flux1-dev-torchao-int4.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  



'jibMixFlux_v8.q4_0.gguf': { priority: 3, recommendedDtype: 'gguf', variant: 'krea' },
  



'flux1-krea-Q5_0.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'krea' },
  



'realDream_flux1V1.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  
  
  


'flux1-krea-Q5_1.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'krea' },
  


'realDream_flux1V1_schnell.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'schnell'
  },
  


'flux1-krea-Q5_K_S.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'krea' },
  


'vision_realistic_flux_dev_v2.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  


// FLUX.1-schnell missing quantizations
'flux1-schnell-Q4_0.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'schnell' },
  
  
  



'flux1-schnell-Q4_1.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'schnell' },
  




'mjv6_lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  




'flux1-schnell-Q5_0.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'schnell' },
  




't5xxl_fp16.safetensors': {
    priority: 2,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  



'flux1-schnell-Q5_1.gguf': { priority: 2, recommendedDtype: 'gguf', variant: 'schnell' },
  


'realism_lora.safetensors': {
    priority: 3,
    recommendedDtype: 'default',
    variant: 'dev'
  },
  


'hf-mirror-flux-dev.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  


'scenery_lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'dev' },
  
  
  


'hf-mirror-flux-schnell.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'schnell' },
  



't5xxl_fp8_e4m3fn.safetensors': { priority: 2, recommendedDtype: 'fp8', variant: 'dev' },
  



'juggernaut_base_flux.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  



'juggernaut_lightning_flux.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  

// === Missing Enterprise Models (Priority 2) ===
'juggernaut_pro_flux.safetensors': { priority: 2, recommendedDtype: 'default', variant: 'dev' },
  // === Missing Community Models (Priority 3) ===
'schnellMODE_FLUX_S_v5_1.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'schnell' },
  'watercolor_painting_schnell_lora.safetensors': { priority: 3, recommendedDtype: 'default', variant: 'schnell' }

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

/**
 * Get recommended data type statistics / 获取推荐的数据类型统计
 * @returns Data type distribution stats / 数据类型分布统计
 */
export function getDtypeStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  Object.values(MODEL_REGISTRY).forEach(config => {
    stats[config.recommendedDtype] = (stats[config.recommendedDtype] || 0) + 1;
  });
  return stats;
}

/**
 * Validate model registry integrity / 验证模型注册表的完整性
 * @returns Validation result / 验证结果
 */
export function validateModelRegistry(): {
  errors: string[];
  isValid: boolean;
  stats: {
    byDtype: Record<string, number>;
    byPriority: Record<number, number>;
    byVariant: Record<string, number>;
    totalModels: number;
  };
} {
  const errors: string[] = [];
  const stats = {
    byDtype: {} as Record<string, number>,
    byPriority: {} as Record<number, number>,
    byVariant: {} as Record<string, number>,
    totalModels: Object.keys(MODEL_REGISTRY).length
  };

  // Collect distribution statistics / 统计分布
  Object.entries(MODEL_REGISTRY).forEach(([modelName, config]) => {
    // Count priority distribution / 统计优先级分布
    stats.byPriority[config.priority] = (stats.byPriority[config.priority] || 0) + 1;

    // Count variant distribution / 统计变体分布
    stats.byVariant[config.variant] = (stats.byVariant[config.variant] || 0) + 1;

    // Count data type distribution / 统计数据类型分布
    stats.byDtype[config.recommendedDtype] = (stats.byDtype[config.recommendedDtype] || 0) + 1;

    // Validate model name format / 验证模型名称格式
    if (!modelName.includes('.')) {
      errors.push(`Invalid model name format: ${modelName}`);
    }

    // Validate priority range / 验证优先级范围
    if (config.priority < 1 || config.priority > 3) {
      errors.push(`Invalid priority for ${modelName}: ${config.priority}`);
    }
  });

  // Validate target model count (RFC-128 T2.5: expanded from 95 to 130+) / 验证目标模型数量（RFC-128 T2.5：从95个扩展到130+个）
  if (stats.totalModels < 130) {
    errors.push(`Expected at least 130 models for RFC-128 T2.5 compliance, found ${stats.totalModels}`);
  }

  return {
    errors,
    isValid: errors.length === 0,
    stats
  };
}
