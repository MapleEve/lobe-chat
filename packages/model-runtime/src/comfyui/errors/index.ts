/**
 * ComfyUI Internal Error System / ComfyUI 内部错误系统
 *
 * All ComfyUI internal layers (config, workflow, utils) should use these
 * internal error classes instead of framework errors to maintain proper
 * architectural boundaries.
 */

/**
 * Base class for all ComfyUI internal errors / ComfyUI 内部错误基类
 */
export abstract class ComfyUIInternalError extends Error {
  public readonly reason: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, reason: string, details?: Record<string, any>) {
    super(message);
    this.reason = reason;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ComfyUIInternalError);
    }
  }
}

/**
 * Config layer error / 配置层错误
 * Thrown when configuration issues occur
 */
export class ConfigError extends ComfyUIInternalError {
  constructor(message: string, reason: string, details?: Record<string, any>) {
    super(message, reason, details);
    this.name = 'ConfigError';
  }

  static readonly Reasons = {
    CONFIG_PARSE_ERROR: 'CONFIG_PARSE_ERROR',
    INVALID_CONFIG: 'INVALID_CONFIG',
    MISSING_CONFIG: 'MISSING_CONFIG',
    REGISTRY_ERROR: 'REGISTRY_ERROR',
  } as const;
}

/**
 * Workflow layer error / 工作流层错误
 * Thrown when workflow construction fails
 */
export class WorkflowError extends ComfyUIInternalError {
  constructor(message: string, reason: string, details?: Record<string, any>) {
    super(message, reason, details);
    this.name = 'WorkflowError';
  }

  static readonly Reasons = {
    INVALID_CONFIG: 'INVALID_CONFIG',
    INVALID_PARAMS: 'INVALID_PARAMS',
    MISSING_COMPONENT: 'MISSING_COMPONENT',
    MISSING_ENCODER: 'MISSING_ENCODER',
    UNSUPPORTED_MODEL: 'UNSUPPORTED_MODEL',
  } as const;
}

/**
 * Utils layer error / 工具层错误
 * Thrown by utility functions
 */
export class UtilsError extends ComfyUIInternalError {
  constructor(message: string, reason: string, details?: Record<string, any>) {
    super(message, reason, details);
    this.name = 'UtilsError';
  }

  static readonly Reasons = {
    CONNECTION_ERROR: 'CONNECTION_ERROR',
    // Detector reasons
    DETECTION_FAILED: 'DETECTION_FAILED',
    INVALID_API_KEY: 'INVALID_API_KEY',
    INVALID_MODEL_FORMAT: 'INVALID_MODEL_FORMAT',
    // Model resolver reasons
    MODEL_NOT_FOUND: 'MODEL_NOT_FOUND',
    NO_BUILDER_FOUND: 'NO_BUILDER_FOUND',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    // Router reasons
    ROUTING_FAILED: 'ROUTING_FAILED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  } as const;
}

/**
 * Type guards for error checking / 错误检查类型守卫
 */
export function isComfyUIInternalError(error: unknown): error is ComfyUIInternalError {
  return error instanceof ComfyUIInternalError;
}

export function isConfigError(error: unknown): error is ConfigError {
  return error instanceof ConfigError;
}

export function isWorkflowError(error: unknown): error is WorkflowError {
  return error instanceof WorkflowError;
}

export function isUtilsError(error: unknown): error is UtilsError {
  return error instanceof UtilsError;
}
