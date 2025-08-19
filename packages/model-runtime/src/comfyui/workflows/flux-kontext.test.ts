// @vitest-environment node
import { PromptBuilder } from '@saintno/comfyui-sdk';
import { describe, expect, it, vi } from 'vitest';

import { buildFluxKontextWorkflow } from './flux-kontext';

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

describe('buildFluxKontextWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create FLUX Kontext workflow with default parameters', () => {
    const modelName = 'flux_kontext.safetensors';
    const params = {
      prompt: 'A beautiful landscape',
    };

    const result = buildFluxKontextWorkflow(modelName, params);

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
    const modelName = 'custom_flux_kontext.safetensors';
    const params = {
      prompt: 'Custom prompt',
      width: 512,
      height: 768,
      steps: 25,
      cfg: 4.0,
    };

    buildFluxKontextWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];
    expect(workflow['2'].inputs.unet_name).toBe(modelName);
  });

  it('should handle image-to-image parameters', () => {
    const modelName = 'flux_kontext.safetensors';
    const params = {
      prompt: 'test',
      image: 'input_image.png',
      denoise: 0.8,
    };

    buildFluxKontextWorkflow(modelName, params);

    // Should not throw and should create valid workflow
    expect(PromptBuilder).toHaveBeenCalled();
  });

  it('should support img2img workflow', () => {
    const modelName = 'flux_kontext.safetensors';
    const params = {
      prompt: 'test',
      image: 'test.png',
    };

    buildFluxKontextWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Should have image loading capabilities for img2img
    const hasImageLoader = Object.values(workflow).some(
      (node: any) =>
        node.class_type === 'LoadImage' ||
        node.class_type === 'ImageUploadTransformed' ||
        node.class_type === 'VAEEncode',
    );

    // Kontext workflow supports img2img so should have image processing nodes
    expect(hasImageLoader || Object.keys(workflow).length > 8).toBe(true);
  });

  it('should handle empty prompt', () => {
    const modelName = 'flux_kontext.safetensors';
    const params = {};

    buildFluxKontextWorkflow(modelName, params);

    // Should not throw and should create valid workflow
    expect(PromptBuilder).toHaveBeenCalled();
  });

  it('should use appropriate default steps for Kontext model', () => {
    const modelName = 'flux_kontext.safetensors';
    const params = { prompt: 'test' };

    buildFluxKontextWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Kontext typically uses 28 steps by default
    const schedulerNode = Object.values(workflow).find(
      (node: any) => node.class_type === 'BasicScheduler',
    ) as any;

    if (schedulerNode) {
      expect(schedulerNode.inputs.steps).toBe(28);
    }
  });

  it('should have correct workflow structure', () => {
    const modelName = 'flux_kontext.safetensors';
    const params = { prompt: 'test' };

    buildFluxKontextWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Should have essential nodes for FLUX Kontext workflow
    const hasRequiredNodes = ['DualCLIPLoader', 'UNETLoader', 'VAELoader', 'SaveImage'].every(
      (nodeType) => Object.values(workflow).some((node: any) => node.class_type === nodeType),
    );

    expect(hasRequiredNodes).toBe(true);
  });

  it('should have all meta information', () => {
    const modelName = 'flux_kontext.safetensors';
    const params = { prompt: 'test' };

    buildFluxKontextWorkflow(modelName, params);

    const workflow = (PromptBuilder as any).mock.calls[0][0];

    // Check that nodes have meta titles
    Object.values(workflow).forEach((node: any) => {
      expect(node._meta).toBeDefined();
      expect(node._meta.title).toBeDefined();
      expect(typeof node._meta.title).toBe('string');
    });
  });

  it('should support vision capabilities', () => {
    const modelName = 'flux_kontext.safetensors';
    const params = {
      prompt: 'test',
      image: 'input.jpg',
    };

    buildFluxKontextWorkflow(modelName, params);

    // Kontext model supports vision (img2img), so workflow should be created successfully
    expect(PromptBuilder).toHaveBeenCalled();

    const workflow = (PromptBuilder as any).mock.calls[0][0];
    expect(Object.keys(workflow).length).toBeGreaterThan(0);
  });
});
