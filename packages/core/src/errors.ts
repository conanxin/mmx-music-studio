// ─── Core Errors ───────────────────────────────────────────────────────────────

export class MusicValidationError extends Error {
  readonly name = 'MusicValidationError'
  readonly code = 'VALIDATION_ERROR'
  constructor(
    message: string,
    readonly errors: Array<{ field: string; message: string; code: string }> = [],
    readonly warnings: Array<{ field: string; message: string; code: string }> = []
  ) {
    super(message)
  }
}

export class MissingApiKeyError extends Error {
  readonly name = 'MissingApiKeyError'
  readonly code = 'MISSING_API_KEY'
}

export class MiniMaxApiError extends Error {
  readonly name = 'MiniMaxApiError'
  readonly code = 'API_ERROR'
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly details?: unknown
  ) {
    super(message)
  }
}

export class UnsupportedAdapterError extends Error {
  readonly name = 'UnsupportedAdapterError'
  readonly code = 'UNSUPPORTED_ADAPTER'
  constructor(message: string) {
    super(message)
  }
}
