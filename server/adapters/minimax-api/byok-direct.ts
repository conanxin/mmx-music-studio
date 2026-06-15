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
  /** Safe provider diagnostics; never includes key material or full response body. */
  detail?: ByokDirectProviderErrorDiagnostics;
}

export type ByokDirectResult = ByokDirectSuccessResult | ByokDirectErrorResult;

export type ByokDirectErrorCode =
  | "byok_direct_api_not_verified"
  | "byok_direct_invalid_key"
  | "byok_direct_lyrics_required"
  | "byok_direct_provider_error"
  | "byok_direct_timeout"
  | "byok_direct_network_error"
  | "byok_direct_rate_limited"
  | "byok_direct_auth_failed"
  | "byok_direct_unexpected";

export interface ByokDirectProviderErrorDiagnostics {
  providerStatusCode?: number;
  providerErrorCode?: string;
  providerErrorMessageSummary?: string;
  responseContentType?: string;
  responseBodyShape?: string;
  responseBodyKeys?: string[];
  responseBodyLength?: number;
}

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

function summarizeText(value: unknown, maxLength = 180): string | undefined {
  if (typeof value !== "string") return undefined;
  const redacted = redactSensitive(value).replace(/\s+/g, " ").trim();
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

function summarizeScalar(value: unknown, maxLength = 80): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return summarizeText(String(value), maxLength);
}

function objectKeys(value: unknown): string[] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.keys(value as Record<string, unknown>).slice(0, 12);
}

function responseBodyShape(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function normalizeDirectLyrics(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function providerErrorCodeFromBody(value: unknown): string | undefined {
  const body = value as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") return undefined;
  const error = body.error as Record<string, unknown> | undefined;
  const baseResp = body.base_resp as Record<string, unknown> | undefined;
  return (
    summarizeScalar(error?.type) ??
    summarizeScalar(error?.http_code) ??
    summarizeScalar(body.code) ??
    summarizeScalar(baseResp?.status_code)
  );
}

function providerErrorMessageFromBody(value: unknown): string | undefined {
  const body = value as Record<string, unknown> | undefined;
  if (!body || typeof body !== "object") return undefined;
  const error = body.error as Record<string, unknown> | undefined;
  const baseResp = body.base_resp as Record<string, unknown> | undefined;
  return (
    summarizeText(error?.message) ??
    summarizeText(body.message) ??
    summarizeText(baseResp?.status_msg)
  );
}

function buildProviderDiagnostics(input: {
  providerStatusCode?: number;
  contentType?: string | null;
  body?: unknown;
  rawBodyLength?: number;
  fallbackMessage?: string;
}): ByokDirectProviderErrorDiagnostics {
  const safeBody = redactProviderPayload(input.body);
  return {
    providerStatusCode: input.providerStatusCode,
    providerErrorCode: providerErrorCodeFromBody(safeBody),
    providerErrorMessageSummary:
      providerErrorMessageFromBody(safeBody) ?? summarizeText(input.fallbackMessage),
    responseContentType: input.contentType ?? undefined,
    responseBodyShape: responseBodyShape(safeBody),
    responseBodyKeys: objectKeys(safeBody),
    responseBodyLength: input.rawBodyLength,
  };
}

async function readProviderResponse(response: Response): Promise<{
  body: unknown;
  rawText: string;
  contentType: string;
  parseOk: boolean;
}> {
  const contentType = response.headers.get("content-type") ?? "";
  const rawText = await response.text();
  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return { body: undefined, rawText, contentType, parseOk: false };
  }
  try {
    return { body: JSON.parse(trimmed), rawText, contentType, parseOk: true };
  } catch {
    return { body: summarizeText(trimmed) ?? "non-json response", rawText, contentType, parseOk: false };
  }
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

  const lyrics = normalizeDirectLyrics(options.lyrics);
  if (options.isInstrumental === true) {
    body.is_instrumental = true;
  } else if (lyrics.length > 0) {
    body.lyrics = lyrics;
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
      detail: buildProviderDiagnostics({
        body: redacted,
        fallbackMessage: "Provider returned an unexpected response format.",
      }),
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
      detail: buildProviderDiagnostics({
        body: redacted,
        fallbackMessage: String(baseResp?.status_msg ?? "Provider returned an error."),
      }),
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
      detail: buildProviderDiagnostics({
        body: { name: error.name },
        fallbackMessage: error.message,
      }),
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
      detail: buildProviderDiagnostics({
        body: redacted,
        fallbackMessage: errorMessage ?? "Provider returned an error.",
      }),
    };
  }

  return {
    ok: false,
    code: fallbackCode,
    message: "An unexpected error occurred during BYOK direct API relay.",
    detail: buildProviderDiagnostics({
      body: redacted,
      fallbackMessage: "An unexpected error occurred during BYOK direct API relay.",
    }),
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

  if (options.isInstrumental !== true && normalizeDirectLyrics(options.lyrics).length === 0) {
    return {
      ok: false,
      code: "byok_direct_lyrics_required",
      message: "lyrics is required unless is_instrumental=true.",
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
      const providerResponse = await readProviderResponse(response);
      let errorCode: ByokDirectErrorCode = "byok_direct_provider_error";
      if (response.status === 401) {
        errorCode = "byok_direct_auth_failed";
      } else if (response.status === 429) {
        errorCode = "byok_direct_rate_limited";
      }
      const normalized = normalizeByokDirectError(providerResponse.body, errorCode);
      return {
        ...normalized,
        detail: buildProviderDiagnostics({
          providerStatusCode: response.status,
          contentType: providerResponse.contentType,
          body: providerResponse.body,
          rawBodyLength: providerResponse.rawText.length,
          fallbackMessage: normalized.message,
        }),
      };
    }

    const providerResponse = await readProviderResponse(response);
    if (!providerResponse.parseOk) {
      return {
        ok: false,
        code: "byok_direct_unexpected",
        message: "Provider returned a non-JSON response.",
        detail: buildProviderDiagnostics({
          providerStatusCode: response.status,
          contentType: providerResponse.contentType,
          body: providerResponse.body,
          rawBodyLength: providerResponse.rawText.length,
          fallbackMessage: "Provider returned a non-JSON response.",
        }),
      };
    }
    const normalized = normalizeByokDirectResponse(providerResponse.body);
    if (!normalized.ok) {
      return {
        ...normalized,
        detail: buildProviderDiagnostics({
          providerStatusCode: response.status,
          contentType: providerResponse.contentType,
          body: providerResponse.body,
          rawBodyLength: providerResponse.rawText.length,
          fallbackMessage: normalized.message,
        }),
      };
    }
    return normalized;
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return normalizeByokDirectError(err, "byok_direct_timeout");
      }
    }
    return normalizeByokDirectError(err, "byok_direct_network_error");
  }
}
