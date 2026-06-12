/**
 * Cloudflare Turnstile server-side verification helper.
 *
 * Phase Deploy-CF-D: Turnstile protection for BYOK generation.
 *
 * Security guarantees:
 * - Secret is never logged.
 * - Raw provider response is never returned to the client.
 * - Provider errors are redacted.
 * - Timeout is enforced.
 *
 * No live calls, no music generation, no broad public BYOK launch.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const DEFAULT_TIMEOUT_MS = 10_000;

import { createHash } from 'node:crypto';

/**
 * Phase H1-Hotfix-C: redacted Siteverify diagnostics toggle.
 * Default: off. Enable only when debugging token freshness / payload structure.
 * When true, callers passing `requestId` get a populated `redacted` field.
 * When false (or unset), the field is `undefined` — no behaviour change.
 */
function isRedactedDebugEnabled(): boolean {
  const v = process.env.TURNSTILE_DEBUG_REDACTED;
  return v === 'true' || v === '1';
}

function fingerprintToken(token: string): { tokenLength: number; tokenSha256_8: string } {
  return {
    tokenLength: token.length,
    tokenSha256_8: createHash('sha256').update(token).digest('hex').slice(0, 8),
  };
}

export interface VerifyTurnstileOptions {
  token: string;
  secret: string;
  remoteIp?: string;
  expectedHostname?: string;
  expectedAction?: string;
  timeoutMs?: number;
  /**
   * Optional request ID. When provided AND the runtime has
   * TURNSTILE_DEBUG_REDACTED=true, the returned `redacted` field is populated.
   * The ID is **opaque** — call sites should not pass any secret-shaped value
   * (e.g. token, apiKey, secret). The diagnostic block is empty otherwise.
   */
  requestId?: string;
}

export interface VerifyTurnstileResult {
  ok: boolean;
  /** Redacted error code for client consumption */
  errorCode?: string;
  /** Redacted details for logging (no secret, no raw response) */
  details?: string;
  /**
   * Redacted diagnostics (Phase H1-Hotfix-C).
   *
   * Only populated when the caller supplies `requestId` and the runtime
   * enables TURNSTILE_DEBUG_REDACTED=true. Contains **no token, no secret,
   * no user key** — only length, sha256_8 fingerprint, Cloudflare flags,
   * and hostname/action/cdata. Safe to log.
   */
  redacted?: {
    requestId: string;
    tokenLength: number;
    tokenSha256_8: string;
    cloudflareSuccess: boolean;
    cloudflareErrorCodes: string[];
    hostname?: string;
    action?: string;
    cdata?: string;
  };
}

/**
 * Verify a Turnstile token with Cloudflare Siteverify.
 *
 * Returns a normalized result with no secret material.
 */
export async function verifyTurnstileToken(
  options: VerifyTurnstileOptions,
): Promise<VerifyTurnstileResult> {
  const { token, secret, remoteIp, expectedHostname, expectedAction, timeoutMs, requestId } = options;

  // Phase H1-Hotfix-C: redacted diagnostics accumulator. Only populated
  // when the runtime has TURNSTILE_DEBUG_REDACTED=true AND requestId is set.
  const debugEnabled = isRedactedDebugEnabled() && typeof requestId === 'string' && requestId.length > 0;
  const fp = debugEnabled ? fingerprintToken(token) : null;
  const redactedPartial: {
    requestId: string;
    tokenLength: number;
    tokenSha256_8: string;
    cloudflareSuccess: boolean;
    cloudflareErrorCodes: string[];
    hostname?: string;
    action?: string;
    cdata?: string;
  } = debugEnabled && fp
    ? {
        requestId: requestId as string,
        tokenLength: fp.tokenLength,
        tokenSha256_8: fp.tokenSha256_8,
        cloudflareSuccess: false,
        cloudflareErrorCodes: [],
      }
    : ({} as never);

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { ok: false, errorCode: 'turnstile_required', details: 'token missing' };
  }

  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return { ok: false, errorCode: 'turnstile_verification_error', details: 'secret not configured' };
  }

  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token);
  if (remoteIp) {
    params.append('remoteip', remoteIp);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : 'unknown fetch error';
    return {
      ok: false,
      errorCode: 'turnstile_verification_error',
      details: `siteverify fetch failed: ${message}`,
    };
  }
  clearTimeout(timer);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      errorCode: 'turnstile_verification_error',
      details: `siteverify non-JSON response, status=${response.status}`,
    };
  }

  // Narrow to expected shape without importing heavy validation libs
  const result = data as {
    success?: boolean;
    hostname?: string;
    'error-codes'?: string[];
    action?: string;
    cdata?: string;
  };

  const codes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
  const cloudflareOk = result.success === true;

  if (debugEnabled) {
    redactedPartial.cloudflareSuccess = cloudflareOk;
    redactedPartial.cloudflareErrorCodes = codes;
    if (typeof result.hostname === 'string') redactedPartial.hostname = result.hostname;
    if (typeof result.action === 'string') redactedPartial.action = result.action;
    if (typeof result.cdata === 'string') redactedPartial.cdata = result.cdata;
  }

  if (!cloudflareOk) {
    return {
      ok: false,
      errorCode: 'turnstile_invalid',
      details: `siteverify rejected: ${codes.join(', ') || 'unknown'}`,
      ...(debugEnabled ? { redacted: redactedPartial } : {}),
    };
  }

  // Optional hostname validation
  if (expectedHostname && result.hostname !== expectedHostname) {
    return {
      ok: false,
      errorCode: 'turnstile_invalid',
      details: `hostname mismatch: expected=${expectedHostname}, got=${result.hostname ?? 'missing'}`,
      ...(debugEnabled ? { redacted: redactedPartial } : {}),
    };
  }

  // Optional action validation
  if (expectedAction && result.action !== expectedAction) {
    return {
      ok: false,
      errorCode: 'turnstile_invalid',
      details: `action mismatch: expected=${expectedAction}, got=${result.action ?? 'missing'}`,
      ...(debugEnabled ? { redacted: redactedPartial } : {}),
    };
  }

  return {
    ok: true,
    details: 'siteverify success',
    ...(debugEnabled ? { redacted: redactedPartial } : {}),
  };
}
