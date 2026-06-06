/**
 * Adapter-level errors. Never contain API keys or Authorization headers.
 */

export class MiniMaxNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MiniMaxNetworkError';
  }
}

export class MiniMaxResponseError extends Error {
  statusCode: number;
  traceId?: string;

  constructor(message: string, statusCode: number, traceId?: string) {
    super(message);
    this.name = 'MiniMaxResponseError';
    this.statusCode = statusCode;
    this.traceId = traceId;
  }
}

export class MiniMaxAudioDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MiniMaxAudioDownloadError';
  }
}

export class MiniMaxAudioDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MiniMaxAudioDecodeError';
  }
}

export class MiniMaxApiError extends Error {
  code: string;
  statusCode?: number;
  traceId?: string;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    traceId?: string,
  ) {
    super(message);
    this.name = 'MiniMaxApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.traceId = traceId;
  }
}