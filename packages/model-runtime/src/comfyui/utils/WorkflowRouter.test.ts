import { describe, expect, it, vi } from 'vitest';

import { buildFluxDevWorkflow } from '../workflows/flux-dev';
import { buildFluxKontextWorkflow } from '../workflows/flux-kontext';
import { buildFluxKreaWorkflow } from '../workflows/flux-krea';
import { buildFluxSchnellWorkflow } from '../workflows/flux-schnell';
import {
  WorkflowDetectionResult,
  WorkflowRouter,
  WorkflowRoutingError,
} from './WorkflowRouter';

// Mock the workflow builders
vi.mock('../workflows/flux-dev', () => ({
  buildFluxDevWorkflow: vi.fn(),
}));

vi.mock('../workflows/flux-schnell', () => ({
  buildFluxSchnellWorkflow: vi.fn(),
}));

vi.mock('../workflows/flux-kontext', () => ({
  buildFluxKontextWorkflow: vi.fn(),
}));

vi.mock('../workflows/flux-krea', () => ({
  buildFluxKreaWorkflow: vi.fn(),
}));

describe('WorkflowRouter', () => {
  const mockWorkflow = { prompt: {}, input: vi.fn(), output: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    (buildFluxDevWorkflow as any).mockReturnValue(mockWorkflow);
    (buildFluxSchnellWorkflow as any).mockReturnValue(mockWorkflow);
    (buildFluxKontextWorkflow as any).mockReturnValue(mockWorkflow);
    (buildFluxKreaWorkflow as any).mockReturnValue(mockWorkflow);
  });

  describe('routeWorkflow', () => {
    it('应该通过精确模型名称匹配路由到正确的构建器', () => {
      const detectionResult: WorkflowDetectionResult = {
        architecture: 'flux',
        isSupported: true,
        variant: 'dev',
      };

      WorkflowRouter.routeWorkflow('flux-dev', detectionResult, 'flux1-dev.safetensors', {});

      expect(buildFluxDevWorkflow).toHaveBeenCalledWith('flux1-dev.safetensors', {});
    });

    it('应该通过变体匹配路由到正确的构建器', () => {
      const detectionResult: WorkflowDetectionResult = {
        architecture: 'flux',
        isSupported: true,
        variant: 'schnell',
      };

      WorkflowRouter.routeWorkflow('custom-flux-schnell', detectionResult, 'custom.safetensors', {});

      expect(buildFluxSchnellWorkflow).toHaveBeenCalledWith('custom.safetensors', {});
    });

    it('应该为所有支持的FLUX变体正确路由', () => {
      const testCases = [
        { variant: 'dev', builder: buildFluxDevWorkflow },
        { variant: 'schnell', builder: buildFluxSchnellWorkflow },
        { variant: 'kontext', builder: buildFluxKontextWorkflow },
        { variant: 'krea', builder: buildFluxKreaWorkflow },
      ];

      testCases.forEach(({ variant, builder }) => {
        const detectionResult: WorkflowDetectionResult = {
          architecture: 'flux',
          isSupported: true,
          variant: variant as any,
        };

        WorkflowRouter.routeWorkflow(
          `test-${variant}`,
          detectionResult,
          `test-${variant}.safetensors`,
          { test: true },
        );

        expect(builder).toHaveBeenCalledWith(`test-${variant}.safetensors`, { test: true });
      });
    });

    it('应该在模型不支持时抛出 WorkflowRoutingError', () => {
      const detectionResult: WorkflowDetectionResult = {
        architecture: 'sd',
        isSupported: false,
      };

      expect(() => {
        WorkflowRouter.routeWorkflow('unsupported-model', detectionResult, 'model.safetensors', {});
      }).toThrow(WorkflowRoutingError);
    });

    it('应该在无法找到匹配的构建器时抛出 WorkflowRoutingError', () => {
      const detectionResult: WorkflowDetectionResult = {
        architecture: 'flux',
        isSupported: true,
        variant: 'unknown' as any,
      };

      expect(() => {
        WorkflowRouter.routeWorkflow('unknown-model', detectionResult, 'model.safetensors', {});
      }).toThrow(WorkflowRoutingError);
    });

    it('应该在参数无效时抛出 WorkflowRoutingError', () => {
      expect(() => {
        WorkflowRouter.routeWorkflow('', {} as WorkflowDetectionResult, 'model.safetensors', {});
      }).toThrow(WorkflowRoutingError);
    });

    it('精确匹配应该优先于变体匹配', () => {
      const detectionResult: WorkflowDetectionResult = {
        architecture: 'flux',
        isSupported: true,
        variant: 'dev',
      };

      // 即使变体是 dev，也应该使用精确匹配的构建器
      WorkflowRouter.routeWorkflow('flux-schnell', detectionResult, 'model.safetensors', {});

      expect(buildFluxSchnellWorkflow).toHaveBeenCalled();
      expect(buildFluxDevWorkflow).not.toHaveBeenCalled();
    });
  });

  describe('getExactlySupportedModels', () => {
    it('应该返回所有精确支持的模型ID', () => {
      const models = WorkflowRouter.getExactlySupportedModels();
      
      expect(models).toContain('flux-dev');
      expect(models).toContain('flux-schnell');
      expect(models).toContain('flux-kontext-dev');
      expect(models).toContain('flux-krea-dev');
      expect(models).toHaveLength(4);
    });
  });

  describe('getSupportedFluxVariants', () => {
    it('应该返回所有支持的FLUX变体', () => {
      const variants = WorkflowRouter.getSupportedFluxVariants();
      
      expect(variants).toContain('dev');
      expect(variants).toContain('schnell');
      expect(variants).toContain('kontext');
      expect(variants).toContain('krea');
      expect(variants).toHaveLength(4);
    });
  });

  describe('hasExactSupport', () => {
    it('应该正确识别精确支持的模型', () => {
      expect(WorkflowRouter.hasExactSupport('flux-dev')).toBe(true);
      expect(WorkflowRouter.hasExactSupport('flux-schnell')).toBe(true);
      expect(WorkflowRouter.hasExactSupport('unknown-model')).toBe(false);
    });
  });

  describe('hasVariantSupport', () => {
    it('应该正确识别支持的变体', () => {
      expect(WorkflowRouter.hasVariantSupport('dev')).toBe(true);
      expect(WorkflowRouter.hasVariantSupport('schnell')).toBe(true);
      expect(WorkflowRouter.hasVariantSupport('unknown')).toBe(false);
    });
  });

  describe('getRoutingStats', () => {
    it('应该返回正确的路由统计信息', () => {
      const stats = WorkflowRouter.getRoutingStats();

      expect(stats.exactModelsCount).toBe(4);
      expect(stats.supportedVariantsCount).toBe(4);
      // totalBuilders 应该是唯一构建器的数量（因为有些构建器可能重复使用）
      expect(stats.totalBuilders).toBeGreaterThanOrEqual(4);
    });
  });

  describe('WorkflowRoutingError', () => {
    it('应该正确创建错误实例', () => {
      const error = new WorkflowRoutingError('Test error message', 'test-model');
      
      expect(error.name).toBe('WorkflowRoutingError');
      expect(error.message).toBe('Test error message');
      expect(error.modelId).toBe('test-model');
      expect(error instanceof Error).toBe(true);
    });

    it('modelId 参数应该是可选的', () => {
      const error = new WorkflowRoutingError('Test error message');
      
      expect(error.name).toBe('WorkflowRoutingError');
      expect(error.message).toBe('Test error message');
      expect(error.modelId).toBeUndefined();
    });
  });
});