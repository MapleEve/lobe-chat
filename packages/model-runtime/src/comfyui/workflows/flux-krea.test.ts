// @vitest-environment node
import { PromptBuilder } from '@saintno/comfyui-sdk';
import { describe, expect, it, vi } from 'vitest';

import { buildFluxKreaWorkflow } from './flux-krea';

// Mock the utility functions
vi.mock('../utils/prompt-splitter', () => ({
  splitPromptForDualCLIP: vi.fn((prompt: string) => ({
    t5xxlPrompt: prompt,
    clipLPrompt: prompt,
  })),
}));

vi.mock('../utils/weight-dtype', () => ({
  selectOptimalWeightDtype: vi.fn(() => 'default'),
}));

// Mock PromptBuilder - capture constructor arguments for test access
vi.mock('@saintno/comfyui-sdk', () => ({
  PromptBuilder: vi.fn().mockImplementation((workflow, inputs, outputs) => {
    return {
      setOutputNode: vi.fn().mockReturnThis(),
    };
  }),
}));

describe('buildFluxKreaWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create FLUX Krea workflow with default parameters', () => {
    const modelName = 'flux_krea.safetensors';
    const params = {
      prompt: 'A beautiful landscape',
    };

    const result = buildFluxKreaWorkflow(modelName, params);

    expect(PromptBuilder).toHaveBeenCalledWith(
      expect.objectContaining({
        '1': expect.objectContaining({
          class_type: 'DualCLIPLoader',
        }),
        '2': expect.objectContaining({
          class_type: 'UNETLoader',
          inputs: expect.objectContaining({
            unet_name: modelName,
          }),
        }),
        '3': expect.objectContaining({
          class_type: 'VAELoader',
        }),
      }),
      expect.any(Array),
      expect.any(Array),
    );

    expect(result.setOutputNode).toHaveBeenCalled();
  });

  it('should create workflow with custom parameters', () => {
    const modelName = 'custom_flux_krea.safetensors';
    const params = {
      prompt: 'Custom prompt',
      width: 512,
      height: 768,
      steps: 18,
      cfg: 2.5,
    };

    buildFluxKreaWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];
    expect(workflow['2'].inputs.unet_name).toBe(modelName);
  });

  it('should handle empty prompt', () => {
    const modelName = 'flux_krea.safetensors';
    const params = {};

    buildFluxKreaWorkflow(modelName, params);

    // Should not throw and should create valid workflow
    expect(PromptBuilder).toHaveBeenCalled();
  });

  it('should use correct default steps for Krea model', () => {
    const modelName = 'flux_krea.safetensors';
    const params = { prompt: 'test' };

    buildFluxKreaWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Krea typically uses 15 steps by default
    const schedulerNode = Object.values(workflow).find(
      (node: any) => node.class_type === 'BasicScheduler',
    ) as any;

    if (schedulerNode) {
      expect(schedulerNode.inputs.steps).toBe(15);
    }
  });

  it('should have correct workflow structure', () => {
    const modelName = 'flux_krea.safetensors';
    const params = { prompt: 'test' };

    buildFluxKreaWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Should have essential nodes for FLUX Krea workflow
    const hasRequiredNodes = ['DualCLIPLoader', 'UNETLoader', 'VAELoader', 'SaveImage'].every(
      (nodeType) => Object.values(workflow).some((node: any) => node.class_type === nodeType),
    );

    expect(hasRequiredNodes).toBe(true);
  });

  it('should have all meta information', () => {
    const modelName = 'flux_krea.safetensors';
    const params = { prompt: 'test' };

    buildFluxKreaWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check that nodes have meta titles
    Object.values(workflow).forEach((node: any) => {
      expect(node._meta).toBeDefined();
      expect(node._meta.title).toBeDefined();
      expect(typeof node._meta.title).toBe('string');
    });
  });
});
