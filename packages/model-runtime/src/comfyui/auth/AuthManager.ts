import type { ComfyUIKeyVault } from '@lobechat/types';

export interface BasicCredentials {
  password: string;
  type: 'basic';
  username: string;
}

export interface BearerTokenCredentials {
  apiKey: string;
  type: 'bearer';
}

export interface CustomCredentials {
  customHeaders: Record<string, string>;
  type: 'custom';
}

/**
 * ComfyUI Authentication Manager
 * Handles authentication headers generation for ComfyUI requests
 */
export class AuthManager {
  private credentials: BasicCredentials | BearerTokenCredentials | CustomCredentials | undefined;
  private authHeaders: Record<string, string> | undefined;

  constructor(options: ComfyUIKeyVault) {
    // 🔑 完全保持原有实现，不做任何修改
    this.validateOptions(options);
    this.credentials = this.createCredentials(options);
    this.authHeaders = this.createAuthHeaders(options);
  }

  getAuthHeaders(): Record<string, string> | undefined {
    // 🔑 完全保持原有实现
    return this.authHeaders;
  }

  private validateOptions(options: ComfyUIKeyVault): void {
    const { authType = 'none', apiKey, username, password, customHeaders } = options;

    switch (authType) {
      case 'basic': {
        if (!username || !password) {
          throw new TypeError('Username and password are required for basic authentication');
        }
        break;
      }
      case 'bearer': {
        if (!apiKey) {
          throw new TypeError('API key is required for bearer token authentication');
        }
        break;
      }
      case 'custom': {
        if (!customHeaders || Object.keys(customHeaders).length === 0) {
          throw new TypeError('Custom headers are required for custom authentication');
        }
        break;
      }
      case 'none': {
        // No validation needed for none authentication
        break;
      }
      default: {
        throw new TypeError(`Unsupported authentication type: ${authType}`);
      }
    }
  }

  private createCredentials(
    options: ComfyUIKeyVault,
  ): BasicCredentials | BearerTokenCredentials | CustomCredentials | undefined {
    const { authType = 'none', apiKey, username, password, customHeaders } = options;

    switch (authType) {
      case 'basic': {
        return { password: password!, type: 'basic', username: username! };
      }
      case 'bearer': {
        return { apiKey: apiKey!, type: 'bearer' };
      }
      case 'custom': {
        return { customHeaders: customHeaders!, type: 'custom' };
      }
      case 'none': {
        return undefined;
      }
    }
  }

  private createAuthHeaders(options: ComfyUIKeyVault): Record<string, string> | undefined {
    const { authType = 'none', apiKey, username, password, customHeaders } = options;

    switch (authType) {
      case 'basic': {
        if (!username || !password) return undefined;
        const credentials = btoa(`${username}:${password}`);
        return { Authorization: `Basic ${credentials}` };
      }

      case 'bearer': {
        if (!apiKey) return undefined;
        return { Authorization: `Bearer ${apiKey}` };
      }

      case 'custom': {
        return customHeaders || undefined;
      }

      case 'none': {
        return undefined;
      }
    }
  }
}
