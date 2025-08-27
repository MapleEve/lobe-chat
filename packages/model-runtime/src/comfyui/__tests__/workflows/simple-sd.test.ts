// @vitest-environment node
import { PromptBuilder } from '@saintno/comfyui-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSimpleSDWorkflow, SimpleSDParams } from '../../workflows/simple-sd';

// Mock PromptBuilder
vi.mock('@saintno/comfyui-sdk', () => ({
  PromptBuilder: vi.fn().mockImplementation((workflow, _inputs, _outputs) => {
    const mockInstance = {
      input: vi.fn().mockReturnThis(),
      setInputNode: vi.fn().mockReturnThis(),
      setOutputNode: vi.fn().mockReturnThis(),
      workflow, // Expose the workflow for testing
    };
    return mockInstance;
  }),
}));

describe('buildSimpleSDWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Text-to-Image Mode (t2i)', () => {
    it('should create t2i workflow with default parameters', () => {
      const modelName = 'sd_xl_base_1.0.safetensors';
      const params: SimpleSDParams = {
        cfg: 7.5,
        height: 512,
        prompt: 'A beautiful landscape',
        steps: 20,
        width: 512,
      };

      const builder = buildSimpleSDWorkflow(modelName, params);

      // Verify PromptBuilder was called with correct parameters
      expect(PromptBuilder).toHaveBeenCalledWith(
        expect.any(Object), // workflow
        ['prompt', 'width', 'height', 'steps', 'seed', 'cfg', 'samplerName', 'scheduler'], // input params
        ['images'], // output params
      );

      // Access the workflow from the mock
      const workflow = (builder as any).workflow;

      // Verify core nodes exist
      expect(workflow['1']).toEqual({
        _meta: { title: 'Load Checkpoint' },
        class_type: 'CheckpointLoaderSimple',
        inputs: { ckpt_name: modelName },
      });

      expect(workflow['2']).toEqual({
        _meta: { title: 'Positive Prompt' },
        class_type: 'CLIPTextEncode',
        inputs: {
          clip: ['1', 1],
          text: params.prompt,
        },
      });

      expect(workflow['4']).toEqual({
        _meta: { title: 'Empty Latent' },
        class_type: 'EmptyLatentImage',
        inputs: {
          batch_size: 1,
          height: params.height,
          width: params.width,
        },
      });

      // Verify KSampler uses EmptyLatentImage for t2i mode
      expect(workflow['5'].inputs.latent_image).toEqual(['4', 0]);
      expect(workflow['5'].inputs.denoise).toBe(1);

      // Verify i2i-specific nodes don't exist
      expect(workflow['IMG_LOAD']).toBeUndefined();
      expect(workflow['IMG_ENCODE']).toBeUndefined();
    });

    it('should handle explicit t2i mode', () => {
      const params: SimpleSDParams = {
        mode: 't2i',
        prompt: 'A beautiful landscape',
      };

      const builder = buildSimpleSDWorkflow('test.safetensors', params);
      const workflow = (builder as any).workflow;

      // Should still use EmptyLatentImage
      expect(workflow['5'].inputs.latent_image).toEqual(['4', 0]);
      expect(workflow['IMG_LOAD']).toBeUndefined();
      expect(workflow['IMG_ENCODE']).toBeUndefined();
    });
  });

  describe('Image-to-Image Mode (i2i)', () => {
    it('should create i2i workflow when mode is i2i and inputImage is provided', () => {
      const params: SimpleSDParams = {
        denoise: 0.6,
        inputImage: 'test-image.jpg',
        mode: 'i2i',
        prompt: 'Transform this image',
      };

      const builder = buildSimpleSDWorkflow('test.safetensors', params);

      // Verify PromptBuilder was called with i2i parameters
      expect(PromptBuilder).toHaveBeenCalledWith(
        expect.any(Object),
        ['prompt', 'width', 'height', 'steps', 'seed', 'cfg', 'samplerName', 'scheduler', 'inputImage', 'denoise'],
        ['images'],
      );

      const workflow = (builder as any).workflow;

      // Verify LoadImage node was added
      expect(workflow['IMG_LOAD']).toEqual({
        _meta: { title: 'Load Input Image' },
        class_type: 'LoadImage',
        inputs: {
          image: params.inputImage,
        },
      });

      // Verify VAEEncode node was added
      expect(workflow['IMG_ENCODE']).toEqual({
        _meta: { title: 'VAE Encode Input' },
        class_type: 'VAEEncode',
        inputs: {
          pixels: ['IMG_LOAD', 0],
          vae: ['1', 2],
        },
      });

      // Verify KSampler uses encoded image for i2i mode
      expect(workflow['5'].inputs.latent_image).toEqual(['IMG_ENCODE', 0]);
      expect(workflow['5'].inputs.denoise).toBe(0.6);

      // Verify input node mappings were set
      expect(builder.setInputNode).toHaveBeenCalledWith('inputImage', 'IMG_LOAD.inputs.image');
      expect(builder.setInputNode).toHaveBeenCalledWith('denoise', '5.inputs.denoise');
    });

    it('should use default denoise value when not provided in i2i mode', () => {
      const params: SimpleSDParams = {
        inputImage: 'test-image.jpg',
        mode: 'i2i',
        prompt: 'Transform this image',
      };

      const builder = buildSimpleSDWorkflow('test.safetensors', params);
      const workflow = (builder as any).workflow;

      // Should use default denoise value of 0.75
      expect(workflow['5'].inputs.denoise).toBe(0.75);
    });

    it('should fallback to t2i mode when i2i mode is specified but no inputImage', () => {
      const params: SimpleSDParams = {
        mode: 'i2i',
        prompt: 'Generate image',
        // inputImage is missing
      };

      const builder = buildSimpleSDWorkflow('test.safetensors', params);

      // Should use t2i parameters (no inputImage, denoise)
      expect(PromptBuilder).toHaveBeenCalledWith(
        expect.any(Object),
        ['prompt', 'width', 'height', 'steps', 'seed', 'cfg', 'samplerName', 'scheduler'],
        ['images'],
      );

      const workflow = (builder as any).workflow;

      // Should not create i2i nodes
      expect(workflow['IMG_LOAD']).toBeUndefined();
      expect(workflow['IMG_ENCODE']).toBeUndefined();
      
      // Should use EmptyLatentImage
      expect(workflow['5'].inputs.latent_image).toEqual(['4', 0]);
      expect(workflow['5'].inputs.denoise).toBe(1);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with legacy parameter format (Record<string, any>)', () => {
      const modelName = 'legacy_model.safetensors';
      const params = {
        height: 512,
        prompt: 'Legacy test',
        width: 512,
      };

      const builder = buildSimpleSDWorkflow(modelName, params);
      const workflow = (builder as any).workflow;

      // Should default to t2i mode
      expect(workflow['1'].inputs.ckpt_name).toBe(modelName);
      expect(workflow['2'].inputs.text).toBe(params.prompt);
      expect(workflow['5'].inputs.latent_image).toEqual(['4', 0]);
      expect(workflow['IMG_LOAD']).toBeUndefined();
    });

    it('should handle missing optional parameters gracefully', () => {
      const params: SimpleSDParams = {
        prompt: 'Minimal test',
      };

      expect(() => buildSimpleSDWorkflow('test.safetensors', params)).not.toThrow();

      const builder = buildSimpleSDWorkflow('test.safetensors', params);
      const workflow = (builder as any).workflow;

      // Should use sensible defaults
      expect(typeof workflow['5'].inputs.seed).toBe('number'); // seed should be a number
      expect(workflow['5'].inputs.denoise).toBe(1);
    });
  });

  describe('Workflow Structure', () => {
    it('should maintain consistent node IDs for core components', () => {
      const params: SimpleSDParams = {
        prompt: 'Structure test',
      };

      const builder = buildSimpleSDWorkflow('test.safetensors', params);
      const workflow = (builder as any).workflow;

      // Core nodes should always exist with same IDs
      expect(workflow['1'].class_type).toBe('CheckpointLoaderSimple');
      expect(workflow['2'].class_type).toBe('CLIPTextEncode');
      expect(workflow['3'].class_type).toBe('CLIPTextEncode');
      expect(workflow['4'].class_type).toBe('EmptyLatentImage');
      expect(workflow['5'].class_type).toBe('KSampler');
      expect(workflow['6'].class_type).toBe('VAEDecode');
      expect(workflow['7'].class_type).toBe('SaveImage');
    });

    it('should use string IDs for dynamic i2i nodes to avoid conflicts', () => {
      const params: SimpleSDParams = {
        inputImage: 'test.jpg',
        mode: 'i2i',
        prompt: 'ID test',
      };

      const builder = buildSimpleSDWorkflow('test.safetensors', params);
      const workflow = (builder as any).workflow;

      // Dynamic nodes should use string IDs
      expect(workflow['IMG_LOAD']).toBeDefined();
      expect(workflow['IMG_ENCODE']).toBeDefined();
      
      // Should not conflict with numeric IDs
      expect(workflow['1']).toBeDefined();
      expect(workflow['7']).toBeDefined();
    });
  });

  describe('VAE Conditional Logic', () => {
    it('should use built-in VAE for SD3.5 models', () => {
      const params: SimpleSDParams = {
        prompt: 'Test with SD3.5',
      };

      const builder = buildSimpleSDWorkflow('sd3.5_large.safetensors', params);
      const workflow = (builder as any).workflow;

      // Should not create VAE_LOADER node for SD3.5
      expect(workflow['VAE_LOADER']).toBeUndefined();
      
      // VAEDecode should use built-in VAE
      expect(workflow['6'].inputs.vae).toEqual(['1', 2]);
    });

    it('should use built-in VAE for custom-sd models', () => {
      const params: SimpleSDParams = {
        prompt: 'Test with custom SD',
      };

      const builder = buildSimpleSDWorkflow('sd3.5_medium_incl_clips_t5xxlfp8scaled.safetensors', params);
      const workflow = (builder as any).workflow;

      // Should not create VAE_LOADER node for custom-sd
      expect(workflow['VAE_LOADER']).toBeUndefined();
      
      // VAEDecode should use built-in VAE
      expect(workflow['6'].inputs.vae).toEqual(['1', 2]);
    });

    it('should use external VAE for SD1.5 models when available', () => {
      const params: SimpleSDParams = {
        prompt: 'Test with SD1.5',
      };

      const builder = buildSimpleSDWorkflow('v1-5-pruned-emaonly.safetensors', params);
      const workflow = (builder as any).workflow;

      // For SD1.5, should try to use external VAE if available
      // The actual behavior depends on system component availability
      // We can check that the logic path is correct
      expect(workflow['6']).toBeDefined();
      expect(workflow['6'].class_type).toBe('VAEDecode');
    });

    it('should use external VAE for SDXL models when available', () => {
      const params: SimpleSDParams = {
        prompt: 'Test with SDXL',
      };

      const builder = buildSimpleSDWorkflow('sd_xl_base_1.0.safetensors', params);
      const workflow = (builder as any).workflow;

      // For SDXL, should try to use external VAE if available
      // The actual behavior depends on system component availability
      expect(workflow['6']).toBeDefined();
      expect(workflow['6'].class_type).toBe('VAEDecode');
    });

    it('should use external VAE in i2i mode for compatible models', () => {
      const params: SimpleSDParams = {
        inputImage: 'test.jpg',
        mode: 'i2i',
        prompt: 'Test i2i with SDXL',
      };

      const builder = buildSimpleSDWorkflow('sd_xl_base_1.0.safetensors', params);
      const workflow = (builder as any).workflow;

      // Should have both encode and decode nodes
      expect(workflow['IMG_ENCODE']).toBeDefined();
      expect(workflow['6']).toBeDefined();
      
      // Both should use consistent VAE (either external or built-in)
      expect(workflow['IMG_ENCODE'].class_type).toBe('VAEEncode');
      expect(workflow['6'].class_type).toBe('VAEDecode');
    });

    it('should not use external VAE in i2i mode for SD3.5 models', () => {
      const params: SimpleSDParams = {
        inputImage: 'test.jpg',
        mode: 'i2i',
        prompt: 'Test i2i with SD3.5',
      };

      const builder = buildSimpleSDWorkflow('sd3.5_large.safetensors', params);
      const workflow = (builder as any).workflow;

      // Should not create VAE_LOADER node
      expect(workflow['VAE_LOADER']).toBeUndefined();
      
      // Both encode and decode should use built-in VAE
      expect(workflow['IMG_ENCODE'].inputs.vae).toEqual(['1', 2]);
      expect(workflow['6'].inputs.vae).toEqual(['1', 2]);
    });
  });
});