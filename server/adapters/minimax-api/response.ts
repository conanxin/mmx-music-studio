/**
 * server/adapters/minimax-api/response.ts
 *
 * Structured response parser for MiniMax music_generation API responses.
 *
 * Supports:
 * - direct_audio: audio URL in response (synchronous completion)
 * - hex_audio: audio as hex string (synchronous completion)
 * - async_task: task_id returned for async polling (polling not implemented)
 * - failure: API-level error
 * - unknown: unexpected shape (logged for diagnostics, no secrets)
 *
 * Security: never logs full raw response, never logs apiKey/Bearer/token.
 */

import type { MiniMaxResult } from '../../call-minimax.js';

// ── Types ───────────────────────────────────────────────────────────────────

export type ResponseKind =
  | 'direct_audio'
  | 'hex_audio'
  | 'async_task'
  | 'failure'
  | 'unknown';

export interface DirectAudio {
  kind: 'direct_audio';
  audioUrl: string;
  durationMs?: number;
  sampleRate?: number;
  bitrate?: number;
  sizeBytes?: number;
  traceId?: string;
}

export interface HexAudio {
  kind: 'hex_audio';
  audioHex: string;
  durationMs?: number;
  traceId?: string;
}

export interface AsyncTask {
  kind: 'async_task';
  /** The task ID to poll — NOT YET IMPLEMENTED as polling endpoint */
  taskId: string;
  /** Human-readable status if present */
  status?: string;
  /**
   * True: caller must NOT attempt to download audio directly.
   * Caller should surface an error telling the user polling is not configured.
   */
  pollingRequired: true;
  traceId?: string;
}

export interface FailureResponse {
  kind: 'failure';
  code?: string | number;
  message: string;
  traceId?: string;
}

export interface UnknownResponse {
  kind: 'unknown';
  message: string;
  /** Keys present in the response data object (sanitized, no secrets) */
  knownKeys: string[];
}

export type ParsedResponse =
  | DirectAudio
  | HexAudio
  | AsyncTask
  | FailureResponse
  | UnknownResponse;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively collect top-level keys from a value (max depth 2).
 * Used for unknown-response diagnostics — never logs values.
 */
function collectKeys(value: unknown, depth = 0): string[] {
  if (depth > 2 || value === null || value === undefined) return [];
  if (Array.isArray(value)) return ['<array>'];
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>);
  }
  return [];
}

/** Returns true when str looks like a hex audio string (>32 chars, only hex+spaces) */
function looksLikeHex(str: string): boolean {
  return /^[0-9a-fA-F\s]+$/.test(str) && str.replace(/\s/g, '').length > 32;
}

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a raw MiniMax music_generation API JSON response.
 *
 * Does NOT make network calls. Does NOT log secrets.
 *
 * @param raw - parsed JSON object from API response body
 */
export function parseMiniMaxMusicResponse(raw: unknown): ParsedResponse {
  if (typeof raw !== 'object' || raw === null) {
    return { kind: 'unknown', message: 'Response is not a JSON object', knownKeys: [] };
  }

  const obj = raw as Record<string, unknown>;
  const data = (obj.data || obj) as Record<string, unknown>;
  const traceId = typeof obj.trace_id === 'string' ? obj.trace_id : undefined;

  // ── 1. Check for async task response ─────────────────────────────────────
  // task_id can appear at top level or nested in data
  const rawTaskId =
    (typeof obj.task_id === 'string' ? obj.task_id : undefined) ||
    (typeof (obj as Record<string, unknown>).taskId === 'string' ? (obj as Record<string, unknown>).taskId as string : undefined) ||
    (typeof data.task_id === 'string' ? data.task_id : undefined) ||
    (typeof data.taskId === 'string' ? data.taskId as string : undefined);

  const rawStatus = typeof obj.status === 'string' ? obj.status : undefined;

  if (rawTaskId) {
    return {
      kind: 'async_task',
      taskId: rawTaskId,
      status: rawStatus,
      pollingRequired: true,
      traceId,
    };
  }

  // ── 2. Check for API-level failure ─────────────────────────────────────
  const baseResp = obj.base_resp as Record<string, unknown> | undefined;
  if (baseResp) {
    const statusCode = baseResp.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
      const code: string | number = typeof statusCode === 'number' || typeof statusCode === 'string' ? statusCode : 0;
      return {
        kind: 'failure',
        code,
        message: typeof baseResp.status_msg === 'string' ? baseResp.status_msg : `status_code=${code}`,
        traceId,
      };
    }
  }

  // ── 3. Check for direct audio URL ───────────────────────────────────────
  if (typeof data.audio === 'string') {
    const audioStr = data.audio;
    if (audioStr.startsWith('http')) {
      const extra = data.extra_info as Record<string, unknown> | undefined;
      const durRaw = extra?.music_duration ?? extra?.duration;
      const durationMs = typeof durRaw === 'number' ? Math.round(durRaw * 1000) : undefined;
      return {
        kind: 'direct_audio',
        audioUrl: audioStr,
        durationMs,
        sampleRate: typeof extra?.music_sample_rate === 'number' ? (extra.music_sample_rate as number) : undefined,
        bitrate: typeof extra?.bitrate === 'number' ? (extra.bitrate as number) : undefined,
        sizeBytes: typeof extra?.music_size === 'number' ? (extra.music_size as number) : undefined,
        traceId,
      };
    }
    if (looksLikeHex(audioStr)) {
      return { kind: 'hex_audio', audioHex: audioStr, traceId };
    }
  }

  if (typeof data.audio_url === 'string') {
    return {
      kind: 'direct_audio',
      audioUrl: data.audio_url,
      traceId,
    };
  }

  if (typeof data.url === 'string') {
    return {
      kind: 'direct_audio',
      audioUrl: data.url,
      traceId,
    };
  }

  // ── 4. Unknown response ─────────────────────────────────────────────────
  return {
    kind: 'unknown',
    message: 'Response did not contain audio URL, hex, or task_id',
    knownKeys: collectKeys(obj, 1),
  };
}

// ── MiniMaxResult bridge ─────────────────────────────────────────────────────

/**
 * Convert a ParsedResponse to the MiniMaxResult shape used by call-minimax.ts.
 * Only handles direct_audio and hex_audio — async_task/failure/unknown throw.
 */
export function parsedToResult(parsed: ParsedResponse): MiniMaxResult {
  switch (parsed.kind) {
    case 'direct_audio':
      return {
        audioKind: 'url',
        audioValue: parsed.audioUrl,
        durationMs: parsed.durationMs,
        sampleRate: parsed.sampleRate,
        bitrate: parsed.bitrate,
        sizeBytes: parsed.sizeBytes,
        traceId: parsed.traceId,
      };

    case 'hex_audio':
      return {
        audioKind: 'hex',
        audioValue: parsed.audioHex,
        traceId: parsed.traceId,
      };

    case 'async_task':
      throw Object.assign(
        new Error(
          'MiniMax API returned an async task response (task_id=' +
            parsed.taskId +
            '), but task polling is not configured yet. ' +
            'To complete generation, either provide a status polling endpoint or use backend=cli.',
        ),
        {
          code: 'MINIMAX_API_ASYNC_POLLING_REQUIRED',
          taskId: parsed.taskId,
          traceId: parsed.traceId,
        },
      );

    case 'failure':
      throw Object.assign(new Error('MiniMax API error: ' + parsed.message), {
        code: 'MINIMAX_ERROR',
        statusCode: parsed.code,
        traceId: parsed.traceId,
      });

    case 'unknown':
      throw Object.assign(
        new Error('MiniMax response format unexpected: ' + parsed.message + '; keys=' + parsed.knownKeys.join(', ')),
        { code: 'PARSE_ERROR' },
      );
  }
}