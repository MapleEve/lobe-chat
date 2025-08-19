/**
 * FLUX 双CLIP提示词智能分割工具
 * 将单一prompt分离为T5-XXL和CLIP-L的不同输入
 */
export function splitPromptForDualCLIP(prompt: string): {
  // 完整描述，给T5-XXL理解语义
  clipLPrompt: string; 
  t5xxlPrompt: string; // 风格关键词，给CLIP-L理解视觉概念
} {
  if (!prompt) {
    return { clipLPrompt: '', t5xxlPrompt: '' };
  }

  // 风格关键词库（涵盖摄影、艺术、质量、光照等）
  const styleKeywords = [
    // 艺术风格
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

    // 光照效果
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

    // 质量描述
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

    // 摄影术语
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

    // 艺术家和平台
    'by greg rutkowski',
    'by artgerm',
    'trending on artstation',
    'concept art',
    'illustration',
    'artwork',
    'painting',

    // 渲染和效果
    'octane render',
    'unreal engine',
    'ray tracing',
    'global illumination',
    'subsurface scattering',
    'bloom',
    'lens flare',
  ];

  // 分离风格关键词
  const words = prompt.toLowerCase().split(/[\s,]+/);
  const styleWords: string[] = [];
  const contentWords: string[] = [];

  // 匹配风格关键词
  const originalWords = prompt.split(/[\s,]+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let isStyleWord = false;

    // 检查单词匹配
    for (const keyword of styleKeywords) {
      const keywordWords = keyword.toLowerCase().split(/\s+/);

      // 检查单词序列匹配
      if (keywordWords.length === 1 && word.includes(keywordWords[0])) {
        styleWords.push(originalWords[i]);
        isStyleWord = true;
        break;
      } else if (keywordWords.length > 1) {
        // 检查多词短语匹配
        const sequence = words.slice(i, i + keywordWords.length).join(' ');
        if (sequence === keyword.toLowerCase()) {
          styleWords.push(...originalWords.slice(i, i + keywordWords.length));
          i += keywordWords.length - 1; // 跳过已匹配的词
          isStyleWord = true;
          break;
        }
      }
    }

    if (!isStyleWord) {
      contentWords.push(originalWords[i]);
    }
  }

  // 构建结果
  if (styleWords.length > 0) {
    return {
      // T5-XXL接收完整context以理解语义关系
clipLPrompt: styleWords.join(' '), 
      t5xxlPrompt: prompt, // CLIP-L专注风格和视觉概念
    };
  }

  // 无风格词时的fallback：提取形容词
  const adjectives = originalWords.filter((word) =>
    /ly$|ful$|ous$|ive$|ing$|ed$|al$|ic$/.test(word.toLowerCase()),
  );

  if (adjectives.length > 0) {
    return {
      clipLPrompt: adjectives.join(' '),
      t5xxlPrompt: prompt,
    };
  }

  // 最终fallback：相同prompt（保证兼容性）
  return {
    clipLPrompt: prompt,
    t5xxlPrompt: prompt,
  };
}
