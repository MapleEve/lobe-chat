import debug from 'debug';

import type { ComfyUIKeyVault } from '../../../types/src/user/settings/keyVaults';
import { LobeRuntimeAI } from '../BaseAI';
import { CreateImagePayload, CreateImageResponse } from '../types/image';
import { COMFYUI_DEFAULTS } from './constants';
import { ComfyUIClientService } from './services/comfyuiClient';
import { ImageService } from './services/imageService';
import { ModelResolverService } from './services/modelResolver';
import { WorkflowBuilderService, WorkflowContext } from './services/workflowBuilder';

const log = debug('lobe-image:comfyui');

/**
 * ComfyUI Runtime implementation
 * Supports text-to-image and image editing
 */
// Export ComfyUI utilities and types
export type { CreateImagePayload, CreateImageResponse } from '../types/image';
export { ModelResolverService as ComfyUIModelResolver } from './services/modelResolver';
export * from './workflows';

export class LobeComfyUI implements LobeRuntimeAI {
  private imageService: ImageService;
  private clientService: ComfyUIClientService;
  private options: ComfyUIKeyVault;

  baseURL: string;

  constructor(options: ComfyUIKeyVault = {}) {
    log('🏗️ ComfyUI Constructor called with options:', {
      authType: options.authType,
      baseURL: options.baseURL,
    });

    this.options = options;
    this.baseURL = options.baseURL || process.env.COMFYUI_DEFAULT_URL || COMFYUI_DEFAULTS.BASE_URL;

    // Initialize services
    this.clientService = new ComfyUIClientService(options);
    const modelResolverService = new ModelResolverService(this.clientService);

    // Create workflow context
    const context: WorkflowContext = {
      clientService: this.clientService,
      modelResolverService: modelResolverService,
    };

    const workflowBuilderService = new WorkflowBuilderService(context);

    // Initialize image service with all dependencies
    this.imageService = new ImageService(
      this.clientService,
      modelResolverService,
      workflowBuilderService,
    );
  }

  /**
   * Create image
   * Entry point that delegates all business logic to ImageService
   */
  async createImage(payload: CreateImagePayload): Promise<CreateImageResponse> {
    // All logic including connection validation delegated to ImageService
    return this.imageService.createImage(payload);
  }
}
