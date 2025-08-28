/**
 * Workflow Builder Service
 *
 * Coordinator service for routing workflow requests to specific implementations
 * Maintains clean separation between coordination and business logic
 */
import { PromptBuilder } from '@saintno/comfyui-sdk';
import debug from 'debug';

import { WorkflowError } from '../errors';
import type { WorkflowDetectionResult } from '../utils/workflowDetector';
import {
  buildFluxDevWorkflow,
  buildFluxKontextWorkflow,
  buildFluxSchnellWorkflow,
  buildSD35Workflow,
  buildSimpleSDWorkflow,
} from '../workflows';
import type { SD35WorkflowParams } from '../workflows/sd35';
import { ComfyUIClientService } from './comfyuiClient';
import { ModelResolverService } from './modelResolver';

const log = debug('lobe-image:comfyui:workflow-builder');

/**
 * Workflow context for builders
 */
export interface WorkflowContext {
  clientService: ComfyUIClientService;
  modelResolverService: ModelResolverService;
}

/**
 * Workflow Builder Service - Coordinator Only
 * Routes workflow requests to appropriate implementations
 */
export class WorkflowBuilderService {
  private context: WorkflowContext;

  constructor(context: WorkflowContext) {
    this.context = context;
  }

  /**
   * Build workflow based on model detection result
   * Routes to appropriate workflow implementation
   */
  async buildWorkflow(
    modelId: string,
    detectionResult: WorkflowDetectionResult,
    modelFileName: string,
    params: Record<string, any>,
  ): Promise<PromptBuilder<any, any, any>> {
    log('Routing workflow for:', modelId, 'architecture:', detectionResult.architecture);

    // Route based on architecture and variant
    const { architecture, variant } = detectionResult;

    // FLUX models
    if (architecture === 'FLUX') {
      if (modelFileName.toLowerCase().includes('schnell')) {
        return buildFluxSchnellWorkflow(modelFileName, params, this.context);
      }
      if (variant === 'kontext') {
        return buildFluxKontextWorkflow(modelFileName, params, this.context);
      }
      return buildFluxDevWorkflow(modelFileName, params, this.context);
    }

    // SD3.5 models
    if (architecture === 'SD3' && variant?.includes('sd35')) {
      return buildSD35Workflow(modelFileName, params as SD35WorkflowParams, this.context);
    }

    // SD1.x and SDXL models
    if (architecture === 'SD1' || architecture === 'SDXL') {
      return buildSimpleSDWorkflow(modelFileName, params, this.context);
    }

    // Unsupported architecture
    throw new WorkflowError(
      WorkflowError.Reasons.UNSUPPORTED_MODEL,
      `Unsupported model architecture: ${architecture}`,
      { architecture, variant },
    );
  }
}
