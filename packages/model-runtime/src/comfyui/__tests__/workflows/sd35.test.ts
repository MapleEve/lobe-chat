// @vitest-environment node
import { PromptBuilder } from '@saintno/comfyui-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WORKFLOW_DEFAULTS } from '../../constants';
import { TEST_SD35_MODELS } from '../constants/testModels';
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

    // Get the actual workflow object passed to PromptBuilder
    const workflowArg = (PromptBuilder as any).mock.calls[0][0];
    
    // Test individual nodes
    expect(workflowArg['1']).toMatchObject({
      _meta: { title: 'Load Checkpoint' },
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: modelName },
    });
    
    expect(workflowArg['2']).toMatchObject({
      _meta: { title: 'Triple CLIP Loader' },
      class_type: 'TripleCLIPLoader',
      inputs: {
        clip_name1: 'clip_l.safetensors',
        clip_name2: 'clip_g.safetensors',
        clip_name3: 't5xxl_fp16.safetensors',
      },
    });
    
    expect(workflowArg['3']).toMatchObject({
      _meta: { title: 'Positive Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 0],
        text: 'A beautiful landscape',
      },
    });
    
    expect(workflowArg['4']).toMatchObject({
      _meta: { title: 'Negative Prompt' },
      class_type: 'CLIPTextEncode',
      inputs: {
        clip: ['2', 0],
        text: expect.stringContaining('worst quality'),
      },
    });
    
    expect(workflowArg['5']).toMatchObject({
          _meta: { title: 'Empty SD3 Latent Image' },
          class_type: 'EmptySD3LatentImage',
          inputs: {
            batch_size: 1,
            height: 1024,
            width: 1024,
          },
    });
    
    // Test KSampler node inputs individually
    expect(workflowArg['6']._meta.title).toBe('KSampler');
    expect(workflowArg['6'].class_type).toBe('KSampler');
    expect(workflowArg['6'].inputs.cfg).toBe(WORKFLOW_DEFAULTS.SD35.CFG);
    expect(workflowArg['6'].inputs.denoise).toBe(1);
    expect(workflowArg['6'].inputs.latent_image).toEqual(['5', 0]);
    expect(workflowArg['6'].inputs.model).toEqual(['12', 0]);
    expect(workflowArg['6'].inputs.negative).toEqual(['4', 0]);
    expect(workflowArg['6'].inputs.positive).toEqual(['3', 0]);
    expect(workflowArg['6'].inputs.sampler_name).toBe('euler');
    expect(workflowArg['6'].inputs.scheduler).toBe(WORKFLOW_DEFAULTS.SAMPLING.SCHEDULER); // Using actual default from WORKFLOW_DEFAULTS
    expect(typeof workflowArg['6'].inputs.seed).toBe('number');
    expect(workflowArg['6'].inputs.steps).toBe(WORKFLOW_DEFAULTS.SD35.STEPS);
    
    expect(workflowArg['7']).toMatchObject({
          _meta: { title: 'VAE Decode' },
          class_type: 'VAEDecode',
          inputs: {
            samples: ['6', 0],
            vae: ['1', 2],
          },
    });
    
    expect(workflowArg['8']).toMatchObject({
          _meta: { title: 'Save Image' },
          class_type: 'SaveImage',
          inputs: {
            filename_prefix: 'LobeChat/%year%-%month%-%day%/SD35',
            images: ['7', 0],
          },
    });
    
    expect(workflowArg['12']).toMatchObject({
          _meta: { title: 'ModelSamplingSD3' },
          class_type: 'ModelSamplingSD3',
          inputs: {
            model: ['1', 0],
            shift: 3, // Default shift value
          },
    });
    
    // Check that PromptBuilder was called with correct inputs/outputs
    const inputsArg = (PromptBuilder as any).mock.calls[0][1];
    const outputsArg = (PromptBuilder as any).mock.calls[0][2];
    
    expect(inputsArg).toEqual([
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
      ]);
      
    expect(outputsArg).toEqual(['images']);

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

  it('should generate random seed when seed is not provided', async () => {
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

  it('should use default CFG value when cfg is not provided', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: undefined,
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['6'].inputs.cfg).toBe(WORKFLOW_DEFAULTS.SD35.CFG); // Default value for SD3.5
  });

  it('should use default CFG value when cfg is 0 (falsy)', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      cfg: 0,
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['6'].inputs.cfg).toBe(WORKFLOW_DEFAULTS.SD35.CFG); // Default value because 0 is falsy
  });

  // Removed duplicate test - already covered by 'cfg is 0' test

  it('should handle empty params object', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test prompt' };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    expect(workflow['1'].inputs.ckpt_name).toBe(modelName);
    expect(workflow['3'].inputs.text).toBe('test prompt');
    expect(workflow['5'].inputs.width).toBe(WORKFLOW_DEFAULTS.IMAGE.WIDTH); // Default width from WORKFLOW_DEFAULTS
    expect(workflow['5'].inputs.height).toBe(WORKFLOW_DEFAULTS.IMAGE.HEIGHT); // Default height from WORKFLOW_DEFAULTS
    expect(workflow['6'].inputs.steps).toBe(WORKFLOW_DEFAULTS.SD35.STEPS); // Default steps for SD3.5
    expect(typeof workflow['6'].inputs.seed).toBe('number'); // Generated seed value
    expect(workflow['6'].inputs.cfg).toBe(WORKFLOW_DEFAULTS.SD35.CFG); // Default CFG for SD3.5
    expect(workflow['6'].inputs.denoise).toBe(1); // Default denoise from WORKFLOW_DEFAULTS
  });

  it('should use custom negative prompt when provided', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      negativePrompt: 'Custom negative prompt',
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    // Should use the provided negative prompt
    expect(workflow['4'].inputs.text).toBe('Custom negative prompt');
  });

  it('should use default negative prompt when not provided', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = {
      prompt: 'Test prompt',
    };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (result as any).workflow;

    // Should use DEFAULT_NEGATIVE_PROMPT when not provided
    expect(workflow['4'].inputs.text).toContain('worst quality');
    expect(workflow['4'].inputs.text).toContain('low quality');
    expect(workflow['4'].inputs.text).toContain('blurry');
  });

  it('should have correct workflow connections', async () => {
    const modelName = TEST_SD35_MODELS.LARGE;
    const params = { prompt: 'test' };

    await buildSD35Workflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check key workflow connections
    expect(workflow['3'].inputs.clip).toEqual(['2', 0]); // Positive CLIP uses Triple CLIP Loader
    expect(workflow['4'].inputs.clip).toEqual(['2', 0]); // Negative CLIP uses Triple CLIP Loader
    expect(workflow['6'].inputs.model).toEqual(['12', 0]); // KSampler uses ModelSamplingSD3 output
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
    expect(workflow['5']._meta.title).toBe('Empty SD3 Latent Image');
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
    expect(workflow['6'].inputs.scheduler).toBe(WORKFLOW_DEFAULTS.SAMPLING.SCHEDULER);
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
    expect(workflow['8'].inputs.filename_prefix).toBe('LobeChat/%year%-%month%-%day%/SD35');
  });

  it('should call all PromptBuilder setup methods', async () => {
    const modelName = 'sd35_model.safetensors';
    const params = { prompt: 'test' };

    const result = await buildSD35Workflow(modelName, params, mockContext);

    // Should call setOutputNode once
    expect(result.setOutputNode).toHaveBeenCalledTimes(1);
    expect(result.setOutputNode).toHaveBeenCalledWith('images', '8');

    // Should call setInputNode 11 times for all input mappings (includes negativePrompt, denoise, shift)
    expect(result.setInputNode).toHaveBeenCalledTimes(11);
    expect(result.setInputNode).toHaveBeenCalledWith('prompt', '3.inputs.text');
    expect(result.setInputNode).toHaveBeenCalledWith('negativePrompt', '4.inputs.text');
    expect(result.setInputNode).toHaveBeenCalledWith('width', '5.inputs.width');
    expect(result.setInputNode).toHaveBeenCalledWith('height', '5.inputs.height');
    expect(result.setInputNode).toHaveBeenCalledWith('steps', '6.inputs.steps');
    expect(result.setInputNode).toHaveBeenCalledWith('seed', '6.inputs.seed');
    expect(result.setInputNode).toHaveBeenCalledWith('cfg', '6.inputs.cfg');
    expect(result.setInputNode).toHaveBeenCalledWith('sampler', '6.inputs.sampler_name');
    expect(result.setInputNode).toHaveBeenCalledWith('scheduler', '6.inputs.scheduler');
    expect(result.setInputNode).toHaveBeenCalledWith('denoise', '6.inputs.denoise');
    expect(result.setInputNode).toHaveBeenCalledWith('shift', '12.inputs.shift');
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
      await expect(buildSD35Workflow(modelName, params, mockContext)).rejects.toThrow(WorkflowError);
      await expect(buildSD35Workflow(modelName, params, mockContext)).rejects.toThrow(
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
