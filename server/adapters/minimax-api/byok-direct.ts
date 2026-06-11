/**
 * BYOK-F Direct HTTPS API Relay Adapter
 * Status: IMPLEMENTED — live path behind explicit env gates
 *
 * This module implements a direct HTTPS provider call to the official
 * MiniMax music generation API. No CLI spawn. No env injection.
 *
 * Safety constraints:
 * - No CLI spawn
 * - No MINIMAX_API_KEY env injection
 * - No --api-key flag
 * - No operator key usage
 * - User key only in per-request Authorization header
 * - No key persistence
 * - No key logging
 * - All errors redacted
 * - Live path disabled by default (requires explicit env gates)
 */

import { redactObject, redactSensitive } from "../../security/redaction";

// ---------------------------------------------------------------------------
// BYOK-E Verified Schema Types (from official mmx-cli v1.0.16 source)
// Source: /home/ubuntu/.npm-global/lib/node_modules/mmx-cli/dist/mmx.mjs
// Status: VERIFIED — endpoint, auth, request/response/error schema confirmed
// ---------------------------------------------------------------------------

/** Verified MiniMax music generation models */
export type MinimaxMusicModel = 'music-2.6' | 'music-2.5+' | 'music-2.5' | 'music-cover';

/** Verified audio format */
export type MinimaxAudioFormat = 'mp3' | 'wav' | 'flac';

/** Verified output format */
export type MinimaxOutputFormat = 'hex' | 'url';

/** Verified lyrics structure tags */
export type LyricsTag =
  | '[Intro]'
  | '[Verse]'
  | '[Pre Chorus]'
  | '[Chorus]'
  | '[Interlude]'
  | '[Bridge]'
  | '[Outro]'
  | '[Post Chorus]'
  | '[Transition]'
  | '[Break]'
  | '[Hook]'
  | '[Build Up]'
  | '[Inst]'
  | '[Solo]';

/** Verified request body for music generation */
export interface ByokDirectRequest {
  model: MinimaxMusicModel;
  prompt?: string;
  lyrics?: string;
  is_instrumental?: boolean;
  lyrics_optimizer?: boolean;
  audio_setting?: {
    format?: MinimaxAudioFormat;
    sample_rate?: number;
    bitrate?: number;
  };
  output_format?: MinimaxOutputFormat;
  stream?: boolean;
  aigc_watermark?: boolean;
  /** For cover generation (music-cover model) */
  audio_url?: string;
  audio_base64?: string;
  seed?: number;
}

/** Verified success response */
export interface ByokDirectSuccessResponse {
  data: {
    audio?: string;
    audio_url?: string;
    task_id?: string;
  };
  extra_info?: {
    audio_length?: number;
    audio_size?: number;
    audio_sample_rate?: number;
  };
  base_resp: {
    status_code: number;
    status_msg: string;
  };
}

/** Verified error response */
export interface ByokDirectErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
    http_code: string;
  };
  request_id: string;
}

// ---------------------------------------------------------------------------
// BYOK-F Adapter Types
// ---------------------------------------------------------------------------

export interface ByokDirectRequestOptions {
  /** User-provided API key (used only in Authorization header, never stored) */
  apiKey: string;
  /** Music generation prompt */
  prompt: string;
  /** Optional lyrics */
  lyrics?: string;
  /** Model identifier — verified models from BYOK-E */
  model?: MinimaxMusicModel;
  /** Optional voice/style parameters */
  voiceId?: string;
  /** Request timeout in ms (default: 120000) */
  timeoutMs?: number;
  /** Output format — 'url' recommended for browser playback */
  outputFormat?: MinimaxOutputFormat;
  /** Whether to generate instrumental music */
  isInstrumental?: boolean;
}

export interface ByokDirectSuccessResult {
  ok: true;
  code: 'byok_direct_live_ok';
  /** Audio URL from provider (24h expiry) or base64 hex content */
  audioUrl?: string;
  /** Provider task ID */
  taskId?: string;
  /** Provider model used */
  model: string;
  /** Generation metadata (redacted, safe fields only) */
  meta: Record<string, unknown>;
}

export interface ByokDirectErrorResult {
  ok: false;
  code: ByokDirectErrorCode;
  message: string;
  /** Redacted provider error detail (never includes key material) */
  detail?: Record<string, unknown>;
}

export type ByokDirectResult = ByokDirectSuccessResult | ByokDirectErrorResult;

export type ByokDirectErrorCode =
  | "byok_direct_api_not_verified"
  | "byok_direct_invalid_key"
  | "byok_direct_provider_error"
  | "byok_direct_timeout"
  | "byok_direct_network_error"
  | "byok_direct_rate_limited"
  | "byok_direct_auth_failed"
  | "byok_direct_unexpected";

// ---------------------------------------------------------------------------
// Redaction helpers
// ---------------------------------------------------------------------------

/**
 * Redact any sensitive fields from a provider response or error object.
 * Never allows apiKey, Authorization, or token-like values to pass through.
 */
function redactProviderPayload(payload: unknown): unknown {
  return redactObject(payload);
}

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

/**
 * Build the HTTPS request payload for the direct provider call.
 *
 * Constructs Authorization header with the user key. The header is built
 * inside this function and never stored, logged, or returned.
 */
export function buildByokDirectRequest(
  options: ByokDirectRequestOptions
): { url: string; method: string; headers: Record<string, string>; body: ByokDirectRequest } {
  const url = "https://api.minimaxi.com/v1/music_generation";
  const method = "POST";

  // Authorization header is the only place the user key appears.
  // It is constructed here and never stored or logged.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${options.apiKey}`,
  };

  const body: ByokDirectRequest = {
    model: options.model ?? "music-2.6",
    prompt: options.prompt,
  };

  if (options.lyrics) {
    body.lyrics = options.lyrics;
  }

  if (options.isInstrumental !== undefined) {
    body.is_instrumental = options.isInstrumental;
  }

  if (options.outputFormat) {
    body.output_format = options.outputFormat;
  }

  // Default audio settings for quality
  body.audio_setting = {
    format: "mp3",
    sample_rate: 44100,
    bitrate: 256000,
  };

  return { url, method, headers, body };
}

// ---------------------------------------------------------------------------
// Response normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a provider success response into our internal result shape.
 *
 * Extracts audio URL or hex content, task ID, and safe metadata.
 * Never includes the apiKey or Authorization header.
 */
export function normalizeByokDirectResponse(
  providerResponse: unknown
): ByokDirectResult {
  const redacted = redactProviderPayload(providerResponse);

  // Type guard for the verified response shape
  const resp = providerResponse as Record<string, unknown> | undefined;
  if (!resp || typeof resp !== "object") {
    return {
      ok: false,
      code: "byok_direct_unexpected",
      message: "Provider returned an unexpected response format.",
      detail: typeof redacted === "object" && redacted !== null
        ? (redacted as Record<string, unknown>)
        : undefined,
    };
  }

  // Check base_resp.status_code for success (0 = success per BYOK-E)
  const baseResp = resp.base_resp as Record<string, unknown> | undefined;
  const statusCode = baseResp?.status_code;
  if (statusCode !== 0) {
    // Provider returned an error wrapped in success HTTP status
    return {
      ok: false,
      code: "byok_direct_provider_error",
      message: String(baseResp?.status_msg ?? "Provider returned an error."),
      detail: typeof redacted === "object" && redacted !== null
        ? (redacted as Record<string, unknown>)
        : undefined,
    };
  }

  // Extract data fields
  const data = resp.data as Record<string, unknown> | undefined;
  const audioUrl = data?.audio_url as string | undefined;
  const audioHex = data?.audio as string | undefined;
  const taskId = data?.task_id as string | undefined;

  // Extract safe extra_info fields
  const extraInfo = resp.extra_info as Record<string, unknown> | undefined;
  const safeMeta: Record<string, unknown> = {};
  if (extraInfo?.audio_length !== undefined) {
    safeMeta.audioLength = extraInfo.audio_length;
  }
  if (extraInfo?.audio_size !== undefined) {
    safeMeta.audioSize = extraInfo.audio_size;
  }
  if (extraInfo?.audio_sample_rate !== undefined) {
    safeMeta.audioSampleRate = extraInfo.audio_sample_rate;
  }

  return {
    ok: true,
    code: "byok_direct_live_ok",
    audioUrl: audioUrl || audioHex,
    taskId,
    model: "music-2.6", // Will be overridden by caller if needed
    meta: safeMeta,
  };
}

// ---------------------------------------------------------------------------
// Error normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a provider or network error into our internal error shape.
 * All sensitive data is redacted before returning.
 */
export function normalizeByokDirectError(
  error: unknown,
  fallbackCode: ByokDirectErrorCode = "byok_direct_unexpected"
): ByokDirectErrorResult {
  const redacted = redactProviderPayload(error);

  if (error instanceof Error) {
    return {
      ok: false,
      code: fallbackCode,
      message: redactSensitive(error.message),
      detail: typeof redacted === "object" && redacted !== null
        ? (redacted as Record<string, unknown>)
        : undefined,
    };
  }

  // Handle provider structured error responses
  const errObj = error as Record<string, unknown> | undefined;
  if (errObj && typeof errObj === "object") {
    const errorType = (errObj.error as Record<string, unknown> | undefined)?.type as string | undefined;
    const errorMessage = (errObj.error as Record<string, unknown> | undefined)?.message as string | undefined;
    const httpCode = (errObj.error as Record<string, unknown> | undefined)?.http_code as string | undefined;

    // Map known error types to codes
    let code: ByokDirectErrorCode = fallbackCode;
    if (errorType === "authorized_error" || httpCode === "401") {
      code = "byok_direct_auth_failed";
    } else if (httpCode === "429") {
      code = "byok_direct_rate_limited";
    } else if (errorType) {
      code = "byok_direct_provider_error";
    }

    return {
      ok: false,
      code,
      message: redactSensitive(errorMessage ?? "Provider returned an error."),
      detail: typeof redacted === "object" && redacted !== null
        ? (redacted as Record<string, unknown>)
        : undefined,
    };
  }

  return {
    ok: false,
    code: fallbackCode,
    message: "An unexpected error occurred during BYOK direct API relay.",
    detail: typeof redacted === "object" && redacted !== null
      ? (redacted as Record<string, unknown>)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Main entry point — live direct API call
// ---------------------------------------------------------------------------

/**
 * Generate music via direct HTTPS API relay.
 *
 * BEHAVIOR:
 * - Validates the user key format
 * - Builds the request with per-request Authorization header
 * - Calls the official MiniMax API endpoint
 * - Normalizes the response
 * - All errors are redacted
 *
 * SAFETY:
 * - The apiKey only exists in the local Authorization header variable
 * - Never logged, never stored, never returned
 * - Provider errors are redacted before returning
 */
export async function generateByokDirectMusic(
  options: ByokDirectRequestOptions
): Promise<ByokDirectResult> {
  // Validate key format (basic length check, no live validation)
  if (!options.apiKey || options.apiKey.length < 8) {
    return {
      ok: false,
      code: "byok_direct_invalid_key",
      message: "Invalid API key format.",
    };
  }

  const { url, method, headers, body } = buildByokDirectRequest(options);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 120000
    );

    const response = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // HTTP error (4xx, 5xx)
      const errorBody = await response.json().catch(() => ({}));
      let errorCode: ByokDirectErrorCode = "byok_direct_provider_error";
      if (response.status === 401) {
        errorCode = "byok_direct_auth_failed";
      } else if (response.status === 429) {
        errorCode = "byok_direct_rate_limited";
      }
      return normalizeByokDirectError(errorBody, errorCode);
    }

    const data = await response.json();
    return normalizeByokDirectResponse(data);
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return normalizeByokDirectError(err, "byok_direct_timeout");
      }
    }
    return normalizeByokDirectError(err, "byok_direct_network_error");
  }
}
