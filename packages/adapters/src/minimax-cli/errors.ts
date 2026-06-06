export class MmxCliError extends Error {
  readonly code: string;
  readonly stderrPreview?: string;

  constructor(message: string, code: string, stderrPreview?: string) {
    super(message);
    this.name = 'MmxCliError';
    this.code = code;
    this.stderrPreview = stderrPreview;
  }
}

export class MmxCliNotFoundError extends MmxCliError {
  constructor() {
    super('mmx CLI 未安装或不在 PATH 中', 'CLI_NOT_FOUND');
  }
}

export class MmxCliTimeoutError extends MmxCliError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, stderrPreview?: string) {
    super(`mmx CLI 生成超时（${Math.round(timeoutMs / 1000)}s）`, 'TIMEOUT', stderrPreview);
    this.timeoutMs = timeoutMs;
  }
}

export class MmxCliAuthError extends MmxCliError {
  constructor(stderrPreview?: string) {
    super('mmx CLI 未登录或认证已过期', 'AUTH_FAILED', stderrPreview);
  }
}

export class MmxCliUnsupportedModeError extends MmxCliError {
  constructor(mode: string) {
    super(`CLI Adapter 不支持该模式: ${mode}`, 'UNSUPPORTED_MODE');
  }
}

export class MmxCliGenerationError extends MmxCliError {
  constructor(message: string, stderrPreview?: string) {
    super(`mmx CLI 生成失败: ${message}`, 'GENERATION_FAILED', stderrPreview);
  }
}

/**
 * Redact common secrets from text (stdout/stderr).
 * Does NOT use regex for API keys — only obvious patterns.
 */
export function redactCliOutput(text: string): string {
  return text
    .replace(/sk-[A-Za-z0-9_\-]{20,}/g, '<REDACTED_KEY>')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer <REDACTED>')
    .replace(/Authorization\s*:\s*[^\s]+/gi, 'Authorization: <REDACTED>')
    .replace(/MINIMAX_API_KEY\s*=\s*[^\s]+/gi, 'MINIMAX_API_KEY=<REDACTED>')
    .replace(/api[_-]?key["\s:=]+[^\s,"]+/gi, 'api_key=<REDACTED>')
    .replace(/"token"\s*:\s*"[^"]+"/g, '"token": "<REDACTED>"')
    .slice(0, 2000);
}