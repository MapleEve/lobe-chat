// @vitest-environment node
import { PromptBuilder } from '@saintno/comfyui-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSD35Workflow } from './sd35';

// Mock the utility function
vi.mock('@/utils/number', () => ({
  generateUniqueSeeds: vi.fn(() => [12345]),
}));

// Mock PromptBuilder - capture constructor arguments for test access
vi.mock('@saintno/comfyui-sdk', () => ({
  PromptBuilder: vi.fn().mockImplementation((workflow, inputs, outputs) => {
    // Store the workflow reference so modifications are reflected
    const mockInstance = {
      input: vi.fn().mockReturnThis(),
      setInputNode: vi.fn().mockReturnThis(),
      setOutputNode: vi.fn().mockReturnThis(),
      workflow, // Expose the workflow for testing
    };
    return mockInstance;
  }),
}));

describe('buildSD35Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create SD3.5 workflow with default parameters', () => {
    const modelName = 'sd35_large.safetensors';
    const params = {
      prompt: 'A beautiful landscape',
    };

    const result = buildSD35Workflow(modelName, params);

    expect(PromptBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        '1': expect.objectContaining({
          _meta: { title: 'Load Checkpoint' },
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: modelName },
        }),
        '2': expect.objectContaining({
          _meta: { title: 'Positive Prompt' },
          class_type: 'CLIPTextEncode',
          inputs: {
            clip: ['1', 1],
            text: 'A beautiful landscape',
          },
        }),
        '3': expect.objectContaining({
          _meta: { title: 'Negative Prompt' },
          class_type: 'CLIPTextEncode',
          inputs: {
            clip: ['1', 1],
            text: expect.stringContaining('worst quality'),
          },
        }),
        '4': expect.objectContaining({
          _meta: { title: 'Empty Latent' },
          class_type: 'EmptyLatentImage',
          inputs: {
            batch_size: 1,
            height: undefined,
            width: undefined,
          },
        }),
        '5': expect.objectContaining({
          _meta: { title: 'KSampler' },
          class_type: 'KSampler',
          inputs: expect.objectContaining({
            cfg: 4, // Default CFG value
            denoise: 1,
            latent_image: ['4', 0],
            model: ['1', 0],
            negative: ['3', 0],
            positive: ['2', 0],
            sampler_name: 'euler',
            scheduler: 'sgm_uniform',
            seed: 12345, // Mocked value from generateUniqueSeeds
            steps: undefined,
          }),
        }),
        '6': expect.objectContaining({
          _meta: { title: 'VAE Decode' },
          class_type: 'VAEDecode',
          inputs: {
            samples: ['5', 0],
            vae: ['1', 2],
          },
        }),
        '7': expect.objectContaining({
          _meta: { title: 'Save Image' },
          class_type: 'SaveImage',
          inputs: {
            filename_prefix: 'SD35',
            images: ['6', 0],
          },
        }),
      }),
      ['prompt', 'width', 'height', 'steps', 'seed', 'cfg'],
      ['images'],
    );

    expect(result.setOutputNode).toHaveBeenCalledWith('images', '7');
    expect(result.setInputNode).toHaveBeenCalledWith('prompt', '2.inputs.text');
    expect(result.setInputNode).toHaveBeenCalledWith('width', '4.inputs.width');
    expect(result.setInputNode).toHaveBeenCalledWith('height', '4.inputs.height');
    expect(result.setInputNode).toHaveBeenCalledWith('steps', '5.inputs.steps');
    expect(result.setInputNode).toHaveBeenCalledWith('seed', '5.inputs.seed');
    expect(result.setInputNode).toHaveBeenCalledWith('cfg', '5.inputs.cfg');
  });

  it('should create workflow with custom parameters', () => {
    const modelName = 'custom_sd35.safetensors';
    const params = {
      cfg: 7.5,
      height: 768,
      prompt: 'Custom prompt text',
      seed: 98765,
      steps: 30,
      width: 512,
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['1'].inputs.ckpt_name).toBe(modelName);
    expect(workflow['2'].inputs.text).toBe('Custom prompt text');
    expect(workflow['4'].inputs.width).toBe(512);
    expect(workflow['4'].inputs.height).toBe(768);
    expect(workflow['5'].inputs.steps).toBe(30);
    expect(workflow['5'].inputs.seed).toBe(98765);
    expect(workflow['5'].inputs.cfg).toBe(7.5);
  });

  it('should generate random seed when seed is null', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      prompt: 'Test prompt',
      seed: null,
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['5'].inputs.seed).toBe(12345); // Mocked value
  });

  it('should generate random seed when seed is undefined', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      prompt: 'Test prompt',
      seed: undefined,
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['5'].inputs.seed).toBe(12345); // Mocked value
  });

  it('should use seed value 0 when explicitly provided', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      prompt: 'Test prompt',
      seed: 0,
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['5'].inputs.seed).toBe(0); // Should use 0, not generate random
  });

  it('should use default CFG value when cfg is null', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: null,
      prompt: 'Test prompt',
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['5'].inputs.cfg).toBe(4); // Default value
  });

  it('should use default CFG value when cfg is undefined', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: undefined,
      prompt: 'Test prompt',
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['5'].inputs.cfg).toBe(4); // Default value
  });

  it('should use default CFG value when cfg is 0 (falsy)', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: 0,
      prompt: 'Test prompt',
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['5'].inputs.cfg).toBe(4); // Default value because 0 is falsy
  });

  it('should use default CFG value when cfg is false', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: false,
      prompt: 'Test prompt',
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['5'].inputs.cfg).toBe(4); // Default value because false is falsy
  });

  it('should handle empty params object', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {};

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    expect(workflow['1'].inputs.ckpt_name).toBe(modelName);
    expect(workflow['2'].inputs.text).toBeUndefined();
    expect(workflow['4'].inputs.width).toBeUndefined();
    expect(workflow['4'].inputs.height).toBeUndefined();
    expect(workflow['5'].inputs.steps).toBeUndefined();
    expect(workflow['5'].inputs.seed).toBe(12345); // Generated
    expect(workflow['5'].inputs.cfg).toBe(4); // Default
  });

  it('should always use default negative prompt', () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      negativePrompt: 'This should be ignored',
      prompt: 'Test prompt',
    };

    const result = buildSD35Workflow(modelName, params);

    const workflow = (result as any).workflow;

    // Should always use the hardcoded DEFAULT_NEGATIVE_PROMPT
    expect(workflow['3'].inputs.text).toContain('worst quality');
    expect(workflow['3'].inputs.text).toContain('low quality');
    expect(workflow['3'].inputs.text).toContain('blurry');
    expect(workflow['3'].inputs.text).not.toContain('This should be ignored');
  });

  it('should have correct workflow connections', () => {
    const modelName = 'test_model.safetensors';
    const params = { prompt: 'test' };

    buildSD35Workflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check key workflow connections
    expect(workflow['2'].inputs.clip).toEqual(['1', 1]); // Positive CLIP uses checkpoint CLIP
    expect(workflow['3'].inputs.clip).toEqual(['1', 1]); // Negative CLIP uses checkpoint CLIP
    expect(workflow['5'].inputs.model).toEqual(['1', 0]); // KSampler uses checkpoint model
    expect(workflow['5'].inputs.positive).toEqual(['2', 0]); // KSampler uses positive conditioning
    expect(workflow['5'].inputs.negative).toEqual(['3', 0]); // KSampler uses negative conditioning
    expect(workflow['5'].inputs.latent_image).toEqual(['4', 0]); // KSampler uses empty latent
    expect(workflow['6'].inputs.samples).toEqual(['5', 0]); // VAE decode uses sampler output
    expect(workflow['6'].inputs.vae).toEqual(['1', 2]); // VAE decode uses checkpoint VAE
    expect(workflow['7'].inputs.images).toEqual(['6', 0]); // Save uses decoded image
  });

  it('should have all required meta information', () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    buildSD35Workflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check that all nodes have meta titles
    expect(workflow['1']._meta.title).toBe('Load Checkpoint');
    expect(workflow['2']._meta.title).toBe('Positive Prompt');
    expect(workflow['3']._meta.title).toBe('Negative Prompt');
    expect(workflow['4']._meta.title).toBe('Empty Latent');
    expect(workflow['5']._meta.title).toBe('KSampler');
    expect(workflow['6']._meta.title).toBe('VAE Decode');
    expect(workflow['7']._meta.title).toBe('Save Image');
  });

  it('should have correct KSampler fixed parameters', () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    buildSD35Workflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check fixed KSampler parameters
    expect(workflow['5'].inputs.sampler_name).toBe('euler');
    expect(workflow['5'].inputs.scheduler).toBe('sgm_uniform');
    expect(workflow['5'].inputs.denoise).toBe(1);
  });

  it('should have correct EmptyLatentImage parameters', () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    buildSD35Workflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check EmptyLatentImage fixed parameters
    expect(workflow['4'].inputs.batch_size).toBe(1);
  });

  it('should have correct SaveImage parameters', () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    buildSD35Workflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check SaveImage parameters
    expect(workflow['7'].inputs.filename_prefix).toBe('SD35');
  });

  it('should call all PromptBuilder setup methods', () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    const result = buildSD35Workflow(modelName, params);

    // Should call setOutputNode once
    expect(result.setOutputNode).toHaveBeenCalledTimes(1);
    expect(result.setOutputNode).toHaveBeenCalledWith('images', '7');

    // Should call setInputNode 6 times for all input mappings
    expect(result.setInputNode).toHaveBeenCalledTimes(6);
    expect(result.setInputNode).toHaveBeenCalledWith('prompt', '2.inputs.text');
    expect(result.setInputNode).toHaveBeenCalledWith('width', '4.inputs.width');
    expect(result.setInputNode).toHaveBeenCalledWith('height', '4.inputs.height');
    expect(result.setInputNode).toHaveBeenCalledWith('steps', '5.inputs.steps');
    expect(result.setInputNode).toHaveBeenCalledWith('seed', '5.inputs.seed');
    expect(result.setInputNode).toHaveBeenCalledWith('cfg', '5.inputs.cfg');
  });
});
