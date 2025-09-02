import type { ComfyUIKeyVault } from '@lobechat/types';
import debug from 'debug';

import { LobeRuntimeAI } from '../BaseAI';
import { AuthenticatedImageRuntime, CreateImagePayload, CreateImageResponse } from '../types/image';

const log = debug('lobe-image:comfyui');

/**
 * ComfyUI Runtime implementation
 * Supports text-to-image and image editing
 */
export class LobeComfyUI implements LobeRuntimeAI, AuthenticatedImageRuntime {
  private options: ComfyUIKeyVault;
  baseURL: string;

  constructor(options: ComfyUIKeyVault = {}) {
    log('🏗️ ComfyUI Runtime initialized');

    this.options = options;
    this.baseURL = options.baseURL || process.env.COMFYUI_DEFAULT_URL || 'http://localhost:8188';

    log('✅ ComfyUI Runtime ready - baseURL: %s', this.baseURL);
  }

  /**
   * Get authentication headers for image download
   * Used by framework for authenticated image downloads
   */
  getAuthHeaders(): Record<string, string> | undefined {
    log('🔐 Providing auth headers for image download');

    const { authType = 'none', apiKey, username, password, customHeaders } = this.options;

    switch (authType) {
      case 'basic': {
        if (username && password) {
          return { Authorization: `Basic ${btoa(`${username}:${password}`)}` };
        }
        return undefined;
      }

      case 'bearer': {
        if (apiKey) {
          return { Authorization: `Bearer ${apiKey}` };
        }
        return undefined;
      }

      case 'custom': {
        return customHeaders || undefined;
      }

      case 'none': {
        return undefined;
      }
    }
  }

  /**
   * Create image using integrated Framework services (no tRPC overhead)
   */
  async createImage(payload: CreateImagePayload): Promise<CreateImageResponse> {
    log('🎨 Creating image with model: %s', payload.model);

    try {
      // Import Framework services dynamically to avoid circular dependencies
      const { ComfyUIClientService } = await import(
        '@/server/services/comfyui/core/comfyUIClientService'
      );
      const { ModelResolverService } = await import(
        '@/server/services/comfyui/core/modelResolverService'
      );
      const { WorkflowBuilderService } = await import(
        '@/server/services/comfyui/core/workflowBuilderService'
      );
      const { ImageService } = await import('@/server/services/comfyui/core/imageService');

      // Initialize Framework layer services directly (no tRPC)
      const clientService = new ComfyUIClientService(this.options);
      const modelResolverService = new ModelResolverService(clientService);

      // Create workflow context
      const context = {
        clientService,
        modelResolverService,
      };

      const workflowBuilderService = new WorkflowBuilderService(context);

      // Initialize image service with all dependencies
      const imageService = new ImageService(
        clientService,
        modelResolverService,
        workflowBuilderService,
      );

      // Execute image creation
      const response = await imageService.createImage({
        model: payload.model,
        params: payload.params,
      });

      log('✅ Image creation completed successfully');
      return response;
    } catch (error) {
      log('❌ Image creation failed:', error);
      throw error;
    }
  }
}
