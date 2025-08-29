/**
 * ComfyUI Client Service
 *
 * Central service layer for all ComfyUI SDK interactions
 * Provides unified error handling and abstraction over SDK
 */
import { CallWrapper, ComfyApi, PromptBuilder } from '@saintno/comfyui-sdk';
import type {
  BasicCredentials,
  BearerTokenCredentials,
  CustomCredentials,
} from '@saintno/comfyui-sdk';
import debug from 'debug';

import type { ComfyUIKeyVault } from '../../../../types/src/user/settings/keyVaults';
import { parseComfyUIErrorMessage } from '../../utils/comfyuiErrorParser';
import { COMFYUI_DEFAULTS } from '../constants';
import { ServicesError } from '../errors';
import { ModelResolverError } from '../errors/modelResolverError';
import { ErrorHandlerService } from './errorHandler';

const log = debug('lobe-image:comfyui:client');

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  images?: {
    images?: Array<{
      data: string;
      mimeType: string;
    }>;
  };
}

/**
 * Progress callback type
 */
export type ProgressCallback = (info: any) => void;

/**
 * ComfyUI Client Service
 * Encapsulates all SDK interactions
 */
export class ComfyUIClientService {
  private client: ComfyApi;
  private baseURL: string;
  private connectionValidated: boolean = false;
  private nodeDefsCache: any = null;
  private nodeDefsCacheTime: number = 0;
  private checkpointsCache: string[] | null = null;
  private checkpointsCacheTime: number = 0;
  private lorasCache: string[] | null = null;
  private lorasCacheTime: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute (unified TTL)
  private errorHandler: ErrorHandlerService;

  constructor(options: ComfyUIKeyVault = {}) {
    this.errorHandler = new ErrorHandlerService();

    try {
      // Validate configuration
      this.validateOptions(options);

      // Setup base URL
      this.baseURL =
        options.baseURL || process.env.COMFYUI_DEFAULT_URL || COMFYUI_DEFAULTS.BASE_URL;

      // Create credentials
      const credentials = this.createCredentials(options);

      // Initialize client
      this.client = new ComfyApi(this.baseURL, undefined, { credentials });
      this.client.init();

      log('Client initialized with baseURL:', this.baseURL);
    } catch (error) {
      // Use ErrorHandlerService to transform internal errors to framework errors
      this.errorHandler.handleError(error);
    }
  }

  /**
   * Get the path for an image result
   */
  getPathImage(imageInfo: any): string {
    return this.client.getPathImage(imageInfo);
  }

  /**
   * Upload an image to ComfyUI server
   * @param file - The image data as Buffer or Blob
   * @param fileName - The name for the uploaded file
   * @returns The filename on ComfyUI server
   */
  async uploadImage(file: Buffer | Blob, fileName: string): Promise<string> {
    log('Uploading image to ComfyUI:', fileName);

    try {
      const result = await this.client.uploadImage(file, fileName);

      if (!result) {
        throw new ServicesError(
          'Failed to upload image to ComfyUI server',
          ServicesError.Reasons.UPLOAD_FAILED,
          { fileName, response: result },
        );
      }

      log('Image uploaded successfully:', result.info.filename);
      return result.info.filename;
    } catch (error) {
      log('Image upload failed:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflow: PromptBuilder<any, any, any>,
    onProgress?: ProgressCallback,
  ): Promise<WorkflowResult> {
    log('Executing workflow...');

    return new Promise<WorkflowResult>((resolve, reject) => {
      new CallWrapper(this.client, workflow)
        .onFinished((result: any) => {
          log('Workflow execution finished successfully');
          resolve(result);
        })
        .onFailed((error: any) => {
          log('Workflow execution failed:', error?.message || error);

          // If already a structured error, pass through
          if (error && typeof error === 'object' && 'errorType' in error) {
            reject(error);
            return;
          }

          // Parse error message and reject with ServicesError
          const parsedMessage = parseComfyUIErrorMessage(error);
          reject(
            new ServicesError(
              parsedMessage.error.message || 'Workflow execution failed',
              ServicesError.Reasons.EXECUTION_FAILED,
              {
                errorType: parsedMessage.errorType,
                originalError: error,
                parsedError: parsedMessage.error,
              },
            ),
          );
        })
        .onProgress((info: any) => {
          log('Progress:', info);
          onProgress?.(info);
        })
        .run();
    });
  }

  /**
   * Fetch API endpoint
   */
  // @deprecated This method should not be used directly
  // Use specific SDK methods instead (getCheckpoints, getNodeDefs, etc.)
  // Keeping for backward compatibility with tests only
  // Removed: Do not use fetchApi directly
  // All API calls should use specific SDK methods:
  // - getCheckpoints() for models
  // - getNodeDefs() for node definitions
  // - getLoras() for LoRA models
  // - getSamplerInfo() for samplers

  /**
  /**
   * Get available checkpoints from ComfyUI
   * Wraps SDK method to avoid Law of Demeter violation
   * Includes 1-minute TTL cache for performance optimization
   */
  async getCheckpoints(): Promise<string[]> {
    try {
      const now = Date.now();

      // Refresh cache if expired or doesn't exist
      if (!this.checkpointsCache || now - this.checkpointsCacheTime > this.CACHE_TTL) {
        this.checkpointsCache = await this.client.getCheckpoints();
        this.checkpointsCacheTime = now;
        log('Checkpoints cache refreshed');
      }

      return this.checkpointsCache;
    } catch (error) {
      log('Failed to get checkpoints:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Get available LoRAs from ComfyUI
   * Wraps SDK method to avoid Law of Demeter violation
   * Includes 1-minute TTL cache for performance optimization
   */
  async getLoras(): Promise<string[]> {
    try {
      const now = Date.now();

      // Refresh cache if expired or doesn't exist
      if (!this.lorasCache || now - this.lorasCacheTime > this.CACHE_TTL) {
        this.lorasCache = await this.client.getLoras();
        this.lorasCacheTime = now;
        log('LoRAs cache refreshed');
      }

      return this.lorasCache;
    } catch (error) {
      log('Failed to get LoRAs:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Get node definitions from ComfyUI
   * Wraps SDK method to avoid Law of Demeter violation
   * Includes 1-minute TTL cache for performance optimization
   * @param nodeName - Optional specific node name to query
   */
  async getNodeDefs(nodeName?: string): Promise<any> {
    try {
      const now = Date.now();

      // Refresh cache if expired or doesn't exist
      if (!this.nodeDefsCache || now - this.nodeDefsCacheTime > this.CACHE_TTL) {
        this.nodeDefsCache = await this.client.getNodeDefs();
        this.nodeDefsCacheTime = now;
        log('NodeDefs cache refreshed');
      }

      // Return specific node or all nodes
      return nodeName ? { [nodeName]: this.nodeDefsCache[nodeName] } : this.nodeDefsCache;
    } catch (error) {
      log('Failed to get node definitions:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Get sampler info from ComfyUI
   * Wraps SDK method to avoid Law of Demeter violation
   */
  async getSamplerInfo(): Promise<{ sampler: string[]; scheduler: string[] }> {
    try {
      const info = await this.client.getSamplerInfo();
      // Handle both string arrays and tuple arrays like ['euler', { tooltip: 'info' }]
      const extractStrings = (arr: any): string[] => {
        if (!Array.isArray(arr)) return [];
        return arr
          .map((item) => (Array.isArray(item) ? item[0] : item))
          .filter((item) => typeof item === 'string');
      };

      return {
        sampler: extractStrings(info.sampler),
        scheduler: extractStrings(info.scheduler),
      };
    } catch (error) {
      log('Failed to get sampler info:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Validate connection to ComfyUI server
   */
  async validateConnection(): Promise<boolean> {
    if (this.connectionValidated) {
      return true;
    }

    try {
      // Use SDK's getNodeDefs to validate connection
      // This returns node definitions if server is available
      const nodeDefs = await this.getNodeDefs();

      if (!nodeDefs || typeof nodeDefs !== 'object') {
        throw new ServicesError(
          'Invalid response from ComfyUI server',
          ServicesError.Reasons.CONNECTION_FAILED,
          { endpoint: 'getNodeDefs' },
        );
      }

      this.connectionValidated = true;
      log('Connection validated successfully');
      return true;
    } catch (error) {
      log('Connection validation failed:', error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Handle API errors uniformly
   */
  private handleApiError(error: unknown): Error {
    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ModelResolverError(
        ModelResolverError.Reasons.CONNECTION_ERROR,
        'Failed to connect to ComfyUI server',
        { baseURL: this.baseURL, error: error.message },
      );
    }

    // HTTP errors
    if (error instanceof Error && error.message.includes('status:')) {
      const status = parseInt(error.message.match(/status: (\d+)/)?.[1] || '0');

      if (status === 401 || status === 403) {
        throw new ModelResolverError(
          ModelResolverError.Reasons.PERMISSION_DENIED,
          'Authentication failed',
          { status },
        );
      }

      if (status >= 500) {
        throw new ModelResolverError(
          ModelResolverError.Reasons.SERVICE_UNAVAILABLE,
          'ComfyUI server error',
          { status },
        );
      }
    }

    // Default error
    if (error instanceof Error) {
      throw error;
    }

    throw new ServicesError('Unknown error occurred', ServicesError.Reasons.EXECUTION_FAILED, {
      originalError: error,
    });
  }

  /**
   * Validate options
   */
  private validateOptions(options: ComfyUIKeyVault): void {
    const { authType = 'none', apiKey, username, password, customHeaders } = options;

    if (authType === 'basic' && (!username || !password)) {
      throw new ServicesError(
        'Basic authentication requires username and password',
        ServicesError.Reasons.INVALID_ARGS,
        { authType },
      );
    }

    if (authType === 'bearer' && !apiKey) {
      throw new ServicesError(
        'Bearer token authentication requires API key',
        ServicesError.Reasons.INVALID_AUTH,
        { authType },
      );
    }

    if (authType === 'custom' && (!customHeaders || Object.keys(customHeaders).length === 0)) {
      throw new ServicesError(
        'Custom authentication requires custom headers',
        ServicesError.Reasons.INVALID_ARGS,
        { authType },
      );
    }
  }

  /**
   * Create authentication credentials
   */
  private createCredentials(
    options: ComfyUIKeyVault,
  ): BasicCredentials | BearerTokenCredentials | CustomCredentials | undefined {
    const { authType = 'none', apiKey, username, password, customHeaders } = options;

    switch (authType) {
      case 'basic': {
        return {
          password: password!,
          type: 'basic',
          username: username!,
        } as BasicCredentials;
      }

      case 'bearer': {
        return {
          token: apiKey!,
          type: 'bearer_token',
        } as BearerTokenCredentials;
      }

      case 'custom': {
        return {
          headers: customHeaders!,
          type: 'custom',
        } as CustomCredentials;
      }

      default: {
        return undefined;
      }
    }
  }
}
