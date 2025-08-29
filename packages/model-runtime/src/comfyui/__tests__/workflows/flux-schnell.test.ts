// @vitest-environment node
import { PromptBuilder } from '@saintno/comfyui-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WORKFLOW_DEFAULTS } from '../../constants';
import { buildFluxSchnellWorkflow } from '../../workflows/flux-schnell';
import { mockContext } from '../helpers/mockContext';

// Mock the model resolver that the WorkflowDetector uses
vi.mock('../../utils/modelResolver', () => ({
  resolveModel: vi.fn((modelName: string) => {
    const cleanName = modelName.replace(/^comfyui\//, '');

    // Mock configuration mapping for FLUX Schnell test models
    if (cleanName.includes('flux_schnell') || cleanName.includes('flux-schnell')) {
      return {
        modelFamily: 'FLUX',
        variant: 'schnell',
        family: 'flux',
      };
    }

    return null;
  }),
}));

// Mock the utility functions
vi.mock('../../utils/promptSplitter', () => ({
  splitPromptForDualCLIP: vi.fn((prompt: string) => ({
    clipLPrompt: prompt,
    t5xxlPrompt: prompt,
  })),
}));

vi.mock('../../utils/weightDType', () => ({
  selectOptimalWeightDtype: vi.fn(() => 'default'),
}));

// Mock PromptBuilder and seed function - capture constructor arguments for test access
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
  seed: vi.fn(() => 42),
}));

describe('buildFluxSchnellWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create FLUX Schnell workflow with default parameters', async () => {
    const modelName = 'flux_schnell.safetensors';
    const params = {
      prompt: 'A beautiful landscape',
    };

    const result = await buildFluxSchnellWorkflow(modelName, params, mockContext);

    // Check the workflow object from the PromptBuilder call
    const workflow = (PromptBuilder as any).mock.calls[0][0];
    const inputs = (PromptBuilder as any).mock.calls[0][1];
    const outputs = (PromptBuilder as any).mock.calls[0][2];

    // Verify workflow structure
    expect(workflow['1']).toEqual({
      _meta: { title: 'DualCLIP Loader' },
      class_type: 'DualCLIPLoader',
      inputs: {
        clip_name1: 't5xxl_fp16.safetensors',
        clip_name2: 'clip_l.safetensors',
        type: 'flux',
      },
    });

    expect(workflow['2']).toEqual({
      _meta: { title: 'UNET Loader' },
      class_type: 'UNETLoader',
      inputs: {
        unet_name: modelName,
        weight_dtype: 'default',
      },
    });

    expect(workflow['4'].inputs.clip_l).toBe('A beautiful landscape');
    expect(workflow['4'].inputs.t5xxl).toBe('A beautiful landscape');
    expect(workflow['4'].inputs.guidance).toBe(WORKFLOW_DEFAULTS.SCHNELL.CFG);

    expect(workflow['6'].inputs.cfg).toBe(1);
    expect(workflow['6'].inputs.steps).toBe(WORKFLOW_DEFAULTS.SCHNELL.STEPS);
    expect(workflow['6'].inputs.seed).toBeGreaterThan(0); // Random seed

    // Check input/output parameters (prompt parameters removed as they're set directly)
    expect(inputs).toEqual(['width', 'height', 'steps', 'cfg', 'seed']);
    expect(outputs).toEqual(['images']);

    expect(result.setOutputNode).toHaveBeenCalledWith('images', '8');
  });

  it('should create workflow with custom parameters', async () => {
    const modelName = 'flux_schnell_custom.safetensors';
    const params = {
      height: 768,
      prompt: 'Custom prompt',
      samplerName: 'dpmpp_2m',
      scheduler: 'karras',
      seed: 12_345,
      steps: 8,
      width: 512,
    };

    const result = await buildFluxSchnellWorkflow(modelName, params, mockContext);

    // Check the modified workflow object from the PromptBuilder call
    const workflow = (PromptBuilder as any).mock.calls[0][0];

    expect(workflow['2'].inputs.unet_name).toBe(modelName);
    expect(workflow['5'].inputs.width).toBe(512);
    expect(workflow['5'].inputs.height).toBe(768);
    expect(workflow['6'].inputs.steps).toBe(8);
    expect(workflow['6'].inputs.seed).toBe(12_345);
    // samplerName and scheduler parameters are not currently supported in the Schnell implementation
    expect(workflow['6'].inputs.sampler_name).toBe('euler'); // Uses default value
    expect(workflow['6'].inputs.scheduler).toBe('simple'); // Uses default value
  });

  it('should handle empty prompt', async () => {
    const modelName = 'flux_schnell.safetensors';
    const params = {};

    await buildFluxSchnellWorkflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Should use default values
    expect(workflow['5'].inputs.width).toBe(1024);
    expect(workflow['5'].inputs.height).toBe(1024);
    expect(workflow['6'].inputs.steps).toBe(WORKFLOW_DEFAULTS.SCHNELL.STEPS);
    expect(workflow['6'].inputs.seed).toBeGreaterThan(0); // Random seed, not 0
    expect(workflow['6'].inputs.sampler_name).toBe('euler');
    expect(workflow['6'].inputs.scheduler).toBe('simple');
  });

  it('should have correct workflow structure', async () => {
    const modelName = 'flux_schnell_test.safetensors';
    const params = { prompt: 'test' };

    await buildFluxSchnellWorkflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check workflow connections
    expect(workflow['4'].inputs.clip).toEqual(['1', 0]); // CLIP encode uses DualCLIP output
    expect(workflow['6'].inputs.latent_image).toEqual(['5', 0]); // Sampler uses empty latent
    expect(workflow['6'].inputs.model).toEqual(['2', 0]); // Sampler uses UNET
    expect(workflow['6'].inputs.positive).toEqual(['4', 0]); // Sampler uses encoded text
    expect(workflow['6'].inputs.negative).toEqual(['4', 0]); // Sampler uses same for negative
    expect(workflow['7'].inputs.samples).toEqual(['6', 0]); // VAE decode uses sampler output
    expect(workflow['7'].inputs.vae).toEqual(['3', 0]); // VAE decode uses VAE
    expect(workflow['8'].inputs.images).toEqual(['7', 0]); // Save uses decoded image
  });

  it('should have fixed CFG for Schnell model', async () => {
    const modelName = 'flux_schnell.safetensors';
    const params = { cfg: 7, prompt: 'test' }; // CFG can be set but defaults to 1

    await buildFluxSchnellWorkflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // CFG is set from params but defaults to 1
    expect(workflow['6'].inputs.cfg).toBe(7); // Uses the passed value
    expect(workflow['4'].inputs.guidance).toBe(7); // Same value for guidance
  });

  it('should use correct default steps for Schnell', async () => {
    const modelName = 'flux_schnell.safetensors';
    const params = { prompt: 'test' };

    await buildFluxSchnellWorkflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Should default to 4 steps for Schnell
    expect(workflow['6'].inputs.steps).toBe(WORKFLOW_DEFAULTS.SCHNELL.STEPS);
  });

  it('should have all required meta information', async () => {
    const modelName = 'flux_schnell.safetensors';
    const params = { prompt: 'test' };

    await buildFluxSchnellWorkflow(modelName, params, mockContext);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check that all nodes have meta titles
    expect(workflow['1']._meta.title).toBe('DualCLIP Loader');
    expect(workflow['2']._meta.title).toBe('UNET Loader');
    expect(workflow['3']._meta.title).toBe('VAE Loader');
    expect(workflow['4']._meta.title).toBe('CLIP Text Encode (Flux)');
    expect(workflow['5']._meta.title).toBe('Empty SD3 Latent Image');
    expect(workflow['6']._meta.title).toBe('K Sampler');
    expect(workflow['7']._meta.title).toBe('VAE Decode');
    expect(workflow['8']._meta.title).toBe('Save Image');
  });
});
