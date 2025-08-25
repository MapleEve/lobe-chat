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
 * 清理ComfyUI错误消息，移除格式化字符和多余的空格
 * @param message - 原始错误消息
 * @returns 清理后的错误消息
 */
export function cleanComfyUIErrorMessage(message: string): string {
  return message
    .replaceAll(/^\*\s*/g, '') // 移除开头的星号和空格
    .replaceAll('\\n', '\n') // 转换转义的换行符
    .replaceAll(/\n+/g, ' ') // 将多个换行符替换为单个空格
    .trim(); // 去除首尾空格
}

/**
 * 检查是否为网络连接错误
 * @param error - 错误对象
 * @returns 是否为网络连接错误
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
 * 检查是否为模型相关错误
 * @param error - 错误对象
 * @returns 是否为模型错误
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
 * 检查是否为ComfyUI工作流错误
 * @param error - 错误对象
 * @returns 是否为工作流错误
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
 * 从错误对象中提取结构化信息
 * @param error - 原始错误对象
 * @returns 结构化的ComfyUI错误信息
 */
function extractComfyUIErrorInfo(error: any): ComfyUIError {
  // 处理字符串错误
  if (typeof error === 'string') {
    return {
      message: cleanComfyUIErrorMessage(error),
    };
  }

  // 处理Error对象（优先级高于通用对象检查）
  if (error instanceof Error) {
    return {
      code: (error as any).code,
      message: cleanComfyUIErrorMessage(error.message),
      status: (error as any).status || (error as any).statusCode,
      type: error.name,
    };
  }

  // 如果error已经是结构化的ComfyUIError（但不是嵌套的error对象）
  if (error && typeof error === 'object' && error.message && !error.error) {
    return {
      code: error.code,
      details: error.details,
      message: cleanComfyUIErrorMessage(error.message),
      status: error.status || error.statusCode,
      type: error.type,
    };
  }

  // 处理其他对象类型
  if (error && typeof error === 'object') {
    const message =
      error.message ||
      error.error?.message ||
      error.response?.data?.message ||
      error.response?.data?.error?.message ||
      String(error);

    const status =
      error.status ||
      error.statusCode ||
      error.error?.status ||
      error.response?.status ||
      error.response?.statusCode;

    const code = error.code || error.error?.code || error.response?.data?.code;

    const details = error.response?.data || error.error || undefined;

    return {
      code,
      details,
      message: cleanComfyUIErrorMessage(message),
      status: Number.isInteger(status) ? status : undefined,
      type: error.type || error.name || error.constructor?.name,
    };
  }

  // 兜底处理
  return {
    message: cleanComfyUIErrorMessage(String(error)),
  };
}

/**
 * 解析ComfyUI错误消息并返回结构化错误信息
 * @param error - 原始错误对象
 * @returns 解析后的错误对象和错误类型
 */
export function parseComfyUIErrorMessage(error: any): ParsedError {
  console.log('🔍 ComfyUI Error Parser DEBUG:', {
    error,
    errorCode: error?.code,
    errorMessage: error?.message,
    errorName: error?.name,
    errorStatus: error?.status,
    errorStatusCode: error?.statusCode,
    errorType: typeof error,
  });
  const comfyError = extractComfyUIErrorInfo(error);

  // 1. 网络连接错误
  if (isNetworkError(error)) {
    return {
      error: comfyError,
      errorType: AgentRuntimeErrorType.ComfyUIServiceUnavailable,
    };
  }

  // 2. HTTP状态码错误
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

    // 404 表示服务端点不存在，说明 ComfyUI 服务不可用或地址错误
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

  // 3. 模型相关错误
  if (isModelError(error)) {
    return {
      error: comfyError,
      errorType: AgentRuntimeErrorType.ModelNotFound,
    };
  }

  // 4. 工作流错误
  if (isWorkflowError(error)) {
    return {
      error: comfyError,
      errorType: AgentRuntimeErrorType.ComfyUIBizError,
    };
  }

  // 5. 其他ComfyUI业务错误（默认）
  return {
    error: comfyError,
    errorType: AgentRuntimeErrorType.ComfyUIBizError,
  };
}
