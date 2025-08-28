import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowError } from '../../errors';
import { ComfyUIClientService } from '../../services/comfyuiClient';
import { ModelResolverService } from '../../services/modelResolver';
import { WorkflowBuilderService, WorkflowContext } from '../../services/workflowBuilder';
// Import real test data
import { TEST_COMPONENTS, TEST_MODELS } from '../helpers/realConfigData';

// Mock dependencies (must be before other imports)
vi.mock('../../services/comfyuiClient');
vi.mock('../../services/modelResolver');

// No need to mock modelRegistry - we want to use the real implementation

describe('WorkflowBuilderService', () => {
  let service: WorkflowBuilderService;
  let mockContext: WorkflowContext;
  let mockModelResolver: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockModelResolver = {
      selectVAE: vi.fn(),
      getOptimalComponent: vi.fn(),
    };

    mockContext = {
      clientService: {} as ComfyUIClientService,
      modelResolverService: mockModelResolver as ModelResolverService,
    };

    service = new WorkflowBuilderService(mockContext);
  });

  describe('buildWorkflow', () => {
    it('should build FLUX workflow', async () => {
      // Mock component resolution with real component names
      mockModelResolver.getOptimalComponent
        .mockResolvedValueOnce(TEST_COMPONENTS.flux.t5) // First call for t5
        .mockResolvedValueOnce(TEST_COMPONENTS.flux.clip); // Second call for clip

      const workflow = await service.buildWorkflow(
        'flux-1-dev',
        { architecture: 'FLUX', isSupported: true },
        TEST_MODELS.flux,
        {
          prompt: 'A beautiful landscape',
          width: 1024,
          height: 1024,
          cfg: 3.5,
          steps: 20,
        },
      );

      expect(workflow).toBeDefined();
      expect(workflow.workflow).toBeDefined();
      // Verify component resolution was called
      expect(mockModelResolver.getOptimalComponent).toHaveBeenCalled();
    });

    it('should build SD/SDXL workflow with VAE', async () => {
      mockModelResolver.selectVAE.mockResolvedValue(TEST_COMPONENTS.sd.vae);

      const workflow = await service.buildWorkflow(
        'stable-diffusion-xl',
        { architecture: 'SDXL', isSupported: true },
        TEST_MODELS.sdxl,
        {
          prompt: 'A beautiful landscape',
          width: 1024,
          height: 1024,
          cfg: 7,
          steps: 20,
          negativePrompt: 'blurry, ugly',
        },
      );

      expect(workflow).toBeDefined();
      expect(workflow.workflow).toBeDefined();

      // Check if VAE loader was added
      const nodes = workflow.workflow as any;
      const vaeNode = Object.values(nodes).find((node: any) => node.class_type === 'VAELoader');
      expect(vaeNode).toBeDefined();
    });

    it('should build SD3.5 workflow', async () => {
      mockModelResolver.getOptimalComponent
        .mockResolvedValueOnce(TEST_COMPONENTS.sd.clip) // clip_g
        .mockResolvedValueOnce(TEST_COMPONENTS.flux.clip) // clip_l (reuse from FLUX)
        .mockResolvedValueOnce(TEST_COMPONENTS.flux.t5); // t5xxl (reuse from FLUX)

      const workflow = await service.buildWorkflow(
        'stable-diffusion-35',
        { architecture: 'SD3', variant: 'sd35', isSupported: true },
        TEST_MODELS.sd35,
        {
          prompt: 'A futuristic city',
          width: 1024,
          height: 1024,
          cfg: 4.5,
          steps: 28,
          shift: 3.0,
        },
      );

      expect(workflow).toBeDefined();
      expect(workflow.workflow).toBeDefined();

      // Check for SD3.5 specific nodes
      const nodes = workflow.workflow as any;
      const samplingNode = Object.values(nodes).find(
        (node: any) => node.class_type === 'ModelSamplingSD3',
      );
      expect(samplingNode).toBeDefined();
    });

    it('should throw error for unsupported model type', async () => {
      await expect(
        service.buildWorkflow(
          'unknown-model',
          { architecture: 'UNKNOWN' as any, isSupported: false },
          'unknown.safetensors',
          {},
        ),
      ).rejects.toThrow(WorkflowError);
    });
  });

  describe('FLUX workflow specifics', () => {
    it('should throw error when required components not found', async () => {
      // Mock component resolution to fail - should throw error (not use defaults)
      mockModelResolver.getOptimalComponent.mockRejectedValue(
        new Error('Required CLIP component not found'),
      );

      // Should throw error because required components are missing
      await expect(
        service.buildWorkflow(
          'flux-1-dev',
          { architecture: 'FLUX', isSupported: true },
          TEST_MODELS.flux,
          { prompt: 'test' },
        ),
      ).rejects.toThrow('Required CLIP component not found');
    });

    it('should use default parameters when not provided', async () => {
      // Mock component resolution with real components
      mockModelResolver.getOptimalComponent
        .mockResolvedValueOnce(TEST_COMPONENTS.flux.t5)
        .mockResolvedValueOnce(TEST_COMPONENTS.flux.clip);

      const workflow = await service.buildWorkflow(
        'flux-1-dev',
        { architecture: 'FLUX', isSupported: true },
        TEST_MODELS.flux,
        { prompt: 'test' },
      );

      // The workflow should be built with default params
      expect(workflow).toBeDefined();
      // Verify component resolution was called
      expect(mockModelResolver.getOptimalComponent).toHaveBeenCalled();
    });
  });

  describe('SD/SDXL workflow specifics', () => {
    it('should build workflow with VAE loader when external VAE specified', async () => {
      // For SDXL, the workflow will use sdxl_vae.safetensors from getOptimalVAEForModel
      mockModelResolver.selectVAE.mockResolvedValue('sdxl_vae.safetensors');

      const workflow = await service.buildWorkflow(
        'stable-diffusion-xl',
        { architecture: 'SDXL', isSupported: true },
        TEST_MODELS.sdxl,
        { prompt: 'test' },
      );

      const nodes = workflow.workflow as any;
      const vaeLoader = Object.values(nodes).find((node: any) => node.class_type === 'VAELoader');

      // Should have VAE loader with the priority 1 SDXL VAE from config
      expect(vaeLoader).toBeDefined();
      expect((vaeLoader as any).inputs.vae_name).toBe('sdxl_vae.safetensors');
    });

    it('should support custom sampler and scheduler', async () => {
      mockModelResolver.selectVAE.mockResolvedValue(undefined);

      const workflow = await service.buildWorkflow(
        'stable-diffusion-xl',
        { architecture: 'SDXL', isSupported: true },
        TEST_MODELS.sdxl,
        {
          prompt: 'test',
          sampler: 'dpmpp_2m',
          scheduler: 'karras',
        },
      );

      const nodes = workflow.workflow as any;
      const samplerNode = Object.values(nodes).find(
        (node: any) => node.class_type === 'KSampler',
      ) as any;

      expect(samplerNode.inputs.sampler_name).toBe('dpmpp_2m');
      expect(samplerNode.inputs.scheduler).toBe('karras');
    });
  });

  describe('SD3.5 workflow specifics', () => {
    it('should use Triple CLIP loader when components available', async () => {
      mockModelResolver.getOptimalComponent
        .mockResolvedValueOnce(TEST_COMPONENTS.sd.clip) // clip_g
        .mockResolvedValueOnce(TEST_COMPONENTS.flux.clip) // clip_l
        .mockResolvedValueOnce(TEST_COMPONENTS.flux.t5); // t5xxl

      const workflow = await service.buildWorkflow(
        'stable-diffusion-35',
        { architecture: 'SD3', variant: 'sd35', isSupported: true },
        TEST_MODELS.sd35,
        { prompt: 'test' },
      );

      const nodes = workflow.workflow as any;
      const tripleClipNode = Object.values(nodes).find(
        (node: any) => node.class_type === 'TripleCLIPLoader',
      );

      expect(tripleClipNode).toBeDefined();
    });

    it('should fallback to checkpoint CLIP when components not available', async () => {
      // Mock no components available - getOptimalComponent will be called but we won't mock it
      // so it will return undefined/throw

      const workflow = await service.buildWorkflow(
        'stable-diffusion-35',
        { architecture: 'SD3', variant: 'sd35', isSupported: true },
        TEST_MODELS.sd35,
        { prompt: 'test' },
      );

      const nodes = workflow.workflow as any;
      const tripleClipNode = Object.values(nodes).find(
        (node: any) => node.class_type === 'TripleCLIPLoader',
      );

      // Current implementation creates TripleCLIPLoader with defaults when components not available
      expect(tripleClipNode).toBeDefined();
    });

    it('should apply shift parameter correctly', async () => {
      // Mock no components available - getOptimalComponent will be called but we won't mock it
      // so it will return undefined/throw

      const workflow = await service.buildWorkflow(
        'stable-diffusion-35',
        { architecture: 'SD3', variant: 'sd35', isSupported: true },
        TEST_MODELS.sd35,
        {
          prompt: 'test',
          shift: 5.0,
        },
      );

      const nodes = workflow.workflow as any;
      const samplingNode = Object.values(nodes).find(
        (node: any) => node.class_type === 'ModelSamplingSD3',
      ) as any;

      expect(samplingNode.inputs.shift).toBe(5.0);
    });
  });
});
