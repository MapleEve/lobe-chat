import { AgentRuntimeErrorType, ILobeAgentRuntimeErrorType } from '../error';

export interface ComfyUIError {
  code?: number | string;
  details?: any;
  message: string;
  status?: number;
  type?: string;
}

export interface ParsedError {
  error: ComfyUIError;
  errorType: ILobeAgentRuntimeErrorType;
}

/**
 * Clean ComfyUI error message by removing formatting characters and extra spaces
 * @param message - Original error message
 * @returns Cleaned error message
 */
export function cleanComfyUIErrorMessage(message: string): string {
  return message
    .replaceAll(/^\*\s*/g, '') // Remove leading asterisks and spaces
    .replaceAll('\\n', '\n') // Convert escaped newlines
    .replaceAll(/\n+/g, ' ') // Replace multiple newlines with single space
    .trim(); // Remove leading and trailing spaces
}

/**
 * Check if the error is a network connection error
 * @param error - Error object
 * @returns Whether it's a network connection error
 */
function isNetworkError(error: any): boolean {
  const message = error?.message || String(error);
  const lowerMessage = message.toLowerCase();

  return (
    message === 'fetch failed' ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('etimedout') ||
    lowerMessage.includes('network error') ||
    lowerMessage.includes('connection refused') ||
    lowerMessage.includes('connection timeout') ||
    lowerMessage.includes('websocket') ||
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ENOTFOUND' ||
    error?.code === 'ETIMEDOUT'
  );
}

/**
 * Check if the error is model-related
 * @param error - Error object
 * @returns Whether it's a model error
 */
function isModelError(error: any): boolean {
  const message = error?.message || String(error);
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes('model not found') ||
    lowerMessage.includes('checkpoint not found') ||
    lowerMessage.includes('model file not found') ||
    lowerMessage.includes('ckpt_name') ||
    lowerMessage.includes('no models available') ||
    lowerMessage.includes('safetensors') ||
    error?.code === 'MODEL_NOT_FOUND'
  );
}

/**
 * Check if the error is a ComfyUI workflow error
 * @param error - Error object
 * @returns Whether it's a workflow error
 */
function isWorkflowError(error: any): boolean {
  const message = error?.message || String(error);
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes('node') ||
    lowerMessage.includes('workflow') ||
    lowerMessage.includes('execution') ||
    lowerMessage.includes('prompt') ||
    lowerMessage.includes('queue') ||
    lowerMessage.includes('invalid input') ||
    lowerMessage.includes('missing required') ||
    error?.type === 'workflow_error'
  );
}

/**
 * Extract structured information from error object
 * @param error - Original error object
 * @returns Structured ComfyUI error information
 */
function extractComfyUIErrorInfo(error: any): ComfyUIError {
  // Handle string errors
  if (typeof error === 'string') {
    return {
      message: cleanComfyUIErrorMessage(error),
    };
  }

  // Handle Error objects (higher priority than generic object check)
  if (error instanceof Error) {
    return {
      code: (error as any).code,
      message: cleanComfyUIErrorMessage(error.message),
      status: (error as any).status || (error as any).statusCode,
      type: error.name,
    };
  }

  // If error is already a structured ComfyUIError (but not a nested error object)
  if (error && typeof error === 'object' && error.message && !error.error) {
    return {
      code: error.code,
      details: error.details,
      message: cleanComfyUIErrorMessage(error.message),
      status: error.status || error.statusCode,
      type: error.type,
    };
  }

  // Handle other object types - restore more comprehensive status code extraction
  if (error && typeof error === 'object') {
    // Enhanced message extraction from various possible sources (restore original logic)
    const possibleMessage = [
      error.message,
      error.error?.message,
      error.error?.error, // Add deeply nested error.error.error path
      error.details, // Restore: original version had this path
      error.data?.message,
      error.body?.message,
      error.response?.data?.message,
      error.response?.data?.error?.message,
      error.response?.text,
      error.response?.body,
      error.statusText, // Restore: original version had this path
    ].find(Boolean);

    const message = possibleMessage || String(error);

    // Restore more comprehensive status code extraction logic
    const possibleStatus = [
      error.status,
      error.statusCode,
      error.response?.status,
      error.response?.statusCode,
      error.error?.status,
      error.error?.statusCode,
    ].find(Number.isInteger);

    const code = error.code || error.error?.code || error.response?.data?.code;

    const details = error.response?.data || error.error || undefined;

    return {
      code,
      details,
      message: cleanComfyUIErrorMessage(message),
      status: possibleStatus,
      type: error.type || error.name || error.constructor?.name,
    };
  }

  // Fallback handling
  return {
    message: cleanComfyUIErrorMessage(String(error)),
  };
}

/**
 * Parse ComfyUI error message and return structured error information
 * @param error - Original error object
 * @returns Parsed error object and error type
 */
export function parseComfyUIErrorMessage(error: any): ParsedError {
  const comfyError = extractComfyUIErrorInfo(error);

  // 1. HTTP status code errors (priority check)
  const status = comfyError.status;
  if (status) {
    if (status === 401) {
      return {
        error: comfyError,
        errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
      };
    }

    if (status === 403) {
      return {
        error: comfyError,
        errorType: AgentRuntimeErrorType.PermissionDenied,
      };
    }

    // 404 indicates service endpoint does not exist, meaning ComfyUI service is unavailable or address is incorrect
    if (status === 404) {
      return {
        error: comfyError,
        errorType: AgentRuntimeErrorType.ComfyUIServiceUnavailable,
      };
    }

    if (status >= 500) {
      return {
        error: comfyError,
        errorType: AgentRuntimeErrorType.ComfyUIServiceUnavailable,
      };
    }
  }

  // 2. Network connection errors (only check when no HTTP status code)
  if (!status && isNetworkError(error)) {
    return {
      error: comfyError,
      errorType: AgentRuntimeErrorType.ComfyUIServiceUnavailable,
    };
  }

  // 2.5. Check HTTP status code from error message (when status field doesn't exist)
  const message = comfyError.message;
  if (!status && message) {
    if (message.includes('HTTP 401') || message.includes('401')) {
      return {
        error: comfyError,
        errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
      };
    }
    if (message.includes('HTTP 403') || message.includes('403')) {
      return {
        error: comfyError,
        errorType: AgentRuntimeErrorType.PermissionDenied,
      };
    }
    if (message.includes('HTTP 404') || message.includes('404')) {
      return {
        error: comfyError,
        errorType: AgentRuntimeErrorType.ComfyUIServiceUnavailable,
      };
    }
  }

  // 3. Model-related errors
  if (isModelError(error)) {
    return {
      error: comfyError,
      errorType: AgentRuntimeErrorType.ModelNotFound,
    };
  }

  // 4. Workflow errors
  if (isWorkflowError(error)) {
    return {
      error: comfyError,
      errorType: AgentRuntimeErrorType.ComfyUIBizError,
    };
  }

  // 5. Other ComfyUI business errors (default)
  return {
    error: comfyError,
    errorType: AgentRuntimeErrorType.ComfyUIBizError,
  };
}
