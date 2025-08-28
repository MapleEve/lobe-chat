// @vitest-environment node
import { PromptBuilder } from '@saintno/comfyui-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowError } from '../../errors';
import { ComfyUIClientService } from '../../services/comfyuiClient';
import { ModelResolverService } from '../../services/modelResolver';
import { WorkflowContext } from '../../services/workflowBuilder';
import { buildSD35Workflow } from '../../workflows/sd35';

// Mock the system components to simulate having all encoders available
vi.mock('../../config/systemComponents', () => ({
  getAllComponentsWithNames: vi.fn((options) => {
    if (options?.type === 'clip') {
      return [
        { config: { priority: 1, modelFamily: 'SD3' }, name: 'clip_l.safetensors' },
        { config: { priority: 2, modelFamily: 'SD3' }, name: 'clip_g.safetensors' },
      ];
    }
    if (options?.type === 't5') {
      return [{ config: { priority: 1, modelFamily: 'SD3' }, name: 't5xxl_fp16.safetensors' }];
    }
    return [];
  }),
}));

// Mock services
vi.mock('../../services/comfyuiClient');
vi.mock('../../services/modelResolver');

// Mock PromptBuilder - capture constructor arguments for test access
vi.mock('@saintno/comfyui-sdk', () => ({
  PromptBuilder: vi.fn().mockImplementation((workflow, _inputs, _outputs) => {
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
  let mockContext: WorkflowContext;
  let mockModelResolver: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockModelResolver = {
      selectVAE: vi.fn(),
      selectComponents: vi.fn().mockResolvedValue({
        clip: ['clip_g.safetensors', 'clip_l.safetensors', 't5xxl_fp16.safetensors'],
      }),
    };

    mockContext = {
      clientService: {} as ComfyUIClientService,
      modelResolverService: mockModelResolver as ModelResolverService,
    };
  });

  it('should create SD3.5 workflow with default parameters', async () => {
    const modelName = 'sd35_large.safetensors';
    const params = {
      prompt: 'A beautiful landscape',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    expect(PromptBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        '1': expect.objectContaining({
          _meta: { title: 'Load Checkpoint' },
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: modelName },
        }),
        '2': expect.objectContaining({
          _meta: { title: 'Triple CLIP Loader' },
          class_type: 'TripleCLIPLoader',
          inputs: {
            clip_name1: 'clip_l.safetensors',
            clip_name2: 'clip_g.safetensors',
            clip_name3: 't5xxl_fp16.safetensors',
          },
        }),
        '3': expect.objectContaining({
          _meta: { title: 'Positive Prompt' },
          class_type: 'CLIPTextEncode',
          inputs: {
            clip: ['2', 0],
            text: 'A beautiful landscape',
          },
        }),
        '4': expect.objectContaining({
          _meta: { title: 'Negative Prompt' },
          class_type: 'CLIPTextEncode',
          inputs: {
            clip: ['2', 0],
            text: expect.stringContaining('worst quality'),
          },
        }),
        '5': expect.objectContaining({
          _meta: { title: 'Empty SD3 Latent Image' },
          class_type: 'EmptySD3LatentImage',
          inputs: {
            batch_size: 1,
            height: 1024,
            width: 1024,
          },
        }),
        '6': expect.objectContaining({
          _meta: { title: 'KSampler' },
          class_type: 'KSampler',
          inputs: expect.objectContaining({
            cfg: 4.5, // Default CFG value for SD3.5
            denoise: 1,
            latent_image: ['5', 0],
            model: ['12', 0], // Uses ModelSamplingSD3 output
            negative: ['4', 0],
            positive: ['3', 0],
            sampler_name: 'euler',
            scheduler: 'sgm_uniform',
            seed: expect.any(Number), // Generated seed value
            steps: undefined,
          }),
        }),
        '7': expect.objectContaining({
          _meta: { title: 'VAE Decode' },
          class_type: 'VAEDecode',
          inputs: {
            samples: ['6', 0],
            vae: ['1', 2],
          },
        }),
        '8': expect.objectContaining({
          _meta: { title: 'Save Image' },
          class_type: 'SaveImage',
          inputs: {
            filename_prefix: 'LobeChat/%year%-%month%-%day%/SD35',
            images: ['7', 0],
          },
        }),
        '12': expect.objectContaining({
          _meta: { title: 'ModelSamplingSD3' },
          class_type: 'ModelSamplingSD3',
          inputs: {
            model: ['1', 0],
            shift: 3, // Default shift value
          },
        }),
      }),
      [
        'prompt',
        'width',
        'height',
        'steps',
        'seed',
        'cfg',
        'sampler',
        'scheduler',
        'negativePrompt',
        'denoise',
        'shift',
      ],
      ['images'],
    );

    expect(result.setOutputNode).toHaveBeenCalledWith('images', '8');
    expect(result.setInputNode).toHaveBeenCalledWith('prompt', '3.inputs.text');
    expect(result.setInputNode).toHaveBeenCalledWith('width', '5.inputs.width');
    expect(result.setInputNode).toHaveBeenCalledWith('height', '5.inputs.height');
    expect(result.setInputNode).toHaveBeenCalledWith('steps', '6.inputs.steps');
    expect(result.setInputNode).toHaveBeenCalledWith('seed', '6.inputs.seed');
    expect(result.setInputNode).toHaveBeenCalledWith('cfg', '6.inputs.cfg');
  });

  it('should create workflow with custom parameters', async () => {
    const modelName = 'custom_sd35.safetensors';
    const params = {
      cfg: 7.5,
      height: 768,
      prompt: 'Custom prompt text',
      seed: 98_765,
      steps: 30,
      width: 512,
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['1'].inputs.ckpt_name).toBe(modelName);
    expect(workflow['3'].inputs.text).toBe('Custom prompt text');
    expect(workflow['5'].inputs.width).toBe(512);
    expect(workflow['5'].inputs.height).toBe(768);
    expect(workflow['6'].inputs.steps).toBe(30);
    expect(workflow['6'].inputs.seed).toBe(98_765);
    expect(workflow['6'].inputs.cfg).toBe(7.5);
  });

  it('should generate random seed when seed is null', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      prompt: 'Test prompt',
      seed: undefined,
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(typeof workflow['6'].inputs.seed).toBe('number'); // Generated seed value
  });

  it('should generate random seed when seed is undefined', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      prompt: 'Test prompt',
      seed: undefined,
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(typeof workflow['6'].inputs.seed).toBe('number'); // Generated seed value
  });

  it('should use seed value 0 when explicitly provided', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      prompt: 'Test prompt',
      seed: 0,
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['6'].inputs.seed).toBe(0); // Should use 0, not generate random
  });

  it('should use default CFG value when cfg is null', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: undefined,
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['6'].inputs.cfg).toBe(4); // Default value
  });

  it('should use default CFG value when cfg is undefined', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: undefined,
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['6'].inputs.cfg).toBe(4.5); // Default value for SD3.5
  });

  it('should use default CFG value when cfg is 0 (falsy)', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: 0,
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['6'].inputs.cfg).toBe(4.5); // Default value because 0 is falsy
  });

  it('should use default CFG value when cfg is false', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: 0,
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['6'].inputs.cfg).toBe(4.5); // Default value because false is falsy
  });

  it('should handle empty params object', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test prompt' };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['1'].inputs.ckpt_name).toBe(modelName);
    expect(workflow['3'].inputs.text).toBe('test prompt');
    expect(workflow['5'].inputs.width).toBeUndefined();
    expect(workflow['5'].inputs.height).toBeUndefined();
    expect(workflow['6'].inputs.steps).toBeUndefined();
    expect(typeof workflow['6'].inputs.seed).toBe('number'); // Generated seed value
    expect(workflow['6'].inputs.cfg).toBe(4); // Default
  });

  it('should always use default negative prompt', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      negativePrompt: 'This should be ignored',
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    // Should always use the hardcoded DEFAULT_NEGATIVE_PROMPT
    expect(workflow['4'].inputs.text).toContain('worst quality');
    expect(workflow['4'].inputs.text).toContain('low quality');
    expect(workflow['4'].inputs.text).toContain('blurry');
    expect(workflow['4'].inputs.text).not.toContain('This should be ignored');
  });

  it('should have correct workflow connections', async () => {
    const modelName = 'test_model.safetensors';
    const params = { prompt: 'test' };

    await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check key workflow connections
    expect(workflow['3'].inputs.clip).toEqual(['2', 0]); // Positive CLIP uses Triple CLIP Loader
    expect(workflow['4'].inputs.clip).toEqual(['2', 0]); // Negative CLIP uses Triple CLIP Loader
    expect(workflow['6'].inputs.model).toEqual(['1', 0]); // KSampler uses checkpoint model
    expect(workflow['6'].inputs.positive).toEqual(['3', 0]); // KSampler uses positive conditioning
    expect(workflow['6'].inputs.negative).toEqual(['4', 0]); // KSampler uses negative conditioning
    expect(workflow['6'].inputs.latent_image).toEqual(['5', 0]); // KSampler uses empty latent
    expect(workflow['7'].inputs.samples).toEqual(['6', 0]); // VAE decode uses sampler output
    expect(workflow['7'].inputs.vae).toEqual(['1', 2]); // VAE decode uses checkpoint VAE
    expect(workflow['8'].inputs.images).toEqual(['7', 0]); // Save uses decoded image
  });

  it('should have all required meta information', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check that all nodes have meta titles
    expect(workflow['1']._meta.title).toBe('Load Checkpoint');
    expect(workflow['2']._meta.title).toBe('Triple CLIP Loader');
    expect(workflow['3']._meta.title).toBe('Positive Prompt');
    expect(workflow['4']._meta.title).toBe('Negative Prompt');
    expect(workflow['5']._meta.title).toBe('Empty Latent');
    expect(workflow['6']._meta.title).toBe('KSampler');
    expect(workflow['7']._meta.title).toBe('VAE Decode');
    expect(workflow['8']._meta.title).toBe('Save Image');
  });

  it('should have correct KSampler fixed parameters', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check fixed KSampler parameters
    expect(workflow['6'].inputs.sampler_name).toBe('euler');
    expect(workflow['6'].inputs.scheduler).toBe('sgm_uniform');
    expect(workflow['6'].inputs.denoise).toBe(1);
  });

  it('should have correct EmptyLatentImage parameters', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check EmptyLatentImage fixed parameters
    expect(workflow['5'].inputs.batch_size).toBe(1);
  });

  it('should have correct SaveImage parameters', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check SaveImage parameters
    expect(workflow['8'].inputs.filename_prefix).toBe('SD35');
  });

  it('should call all PromptBuilder setup methods', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    // Should call setOutputNode once
    expect(result.setOutputNode).toHaveBeenCalledTimes(1);
    expect(result.setOutputNode).toHaveBeenCalledWith('images', '8');

    // Should call setInputNode 8 times for all input mappings
    expect(result.setInputNode).toHaveBeenCalledTimes(8);
    expect(result.setInputNode).toHaveBeenCalledWith('prompt', '3.inputs.text');
    expect(result.setInputNode).toHaveBeenCalledWith('width', '5.inputs.width');
    expect(result.setInputNode).toHaveBeenCalledWith('height', '5.inputs.height');
    expect(result.setInputNode).toHaveBeenCalledWith('steps', '6.inputs.steps');
    expect(result.setInputNode).toHaveBeenCalledWith('seed', '6.inputs.seed');
    expect(result.setInputNode).toHaveBeenCalledWith('cfg', '6.inputs.cfg');
    expect(result.setInputNode).toHaveBeenCalledWith('samplerName', '6.inputs.sampler_name');
    expect(result.setInputNode).toHaveBeenCalledWith('scheduler', '6.inputs.scheduler');
  });

  describe('Error Handling', () => {
    it('should throw WorkflowError when no encoder files are available', async () => {
      // Import the mocked module that was already mocked at the top of the file
      const systemComponents = await import('../../config/systemComponents');

      // Temporarily override the mock to return empty arrays (no encoders available)
      const originalMock = vi.mocked(systemComponents.getAllComponentsWithNames);
      originalMock.mockImplementation(() => []);

      const modelName = 'sd35_large.safetensors';
      const params = {
        prompt: 'A test prompt',
      };

      // Should throw WorkflowError with MISSING_ENCODER reason
      expect(() => buildSD35Workflow(modelName, params, mockContext)).toThrow(WorkflowError);
      expect(() => buildSD35Workflow(modelName, params, mockContext)).toThrow(
        'SD3.5 models require external CLIP/T5 encoder files',
      );

      // Additional assertion to verify error details
      try {
        await buildSD35Workflow(modelName, params, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(WorkflowError);
        expect((error as WorkflowError).reason).toBe(WorkflowError.Reasons.MISSING_ENCODER);
        expect((error as WorkflowError).details).toEqual({ model: modelName });
      }

      // Restore the original mock behavior
      originalMock.mockRestore();
    });
  });
});
