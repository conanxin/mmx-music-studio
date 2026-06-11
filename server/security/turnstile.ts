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

export interface VerifyTurnstileOptions {
  token: string;
  secret: string;
  remoteIp?: string;
  expectedHostname?: string;
  expectedAction?: string;
  timeoutMs?: number;
}

export interface VerifyTurnstileResult {
  ok: boolean;
  /** Redacted error code for client consumption */
  errorCode?: string;
  /** Redacted details for logging (no secret, no raw response) */
  details?: string;
}

/**
 * Verify a Turnstile token with Cloudflare Siteverify.
 *
 * Returns a normalized result with no secret material.
 */
export async function verifyTurnstileToken(
  options: VerifyTurnstileOptions,
): Promise<VerifyTurnstileResult> {
  const { token, secret, remoteIp, expectedHostname, expectedAction, timeoutMs } = options;

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
  };

  if (result.success !== true) {
    const codes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
    return {
      ok: false,
      errorCode: 'turnstile_invalid',
      details: `siteverify rejected: ${codes.join(', ') || 'unknown'}`,
    };
  }

  // Optional hostname validation
  if (expectedHostname && result.hostname !== expectedHostname) {
    return {
      ok: false,
      errorCode: 'turnstile_invalid',
      details: `hostname mismatch: expected=${expectedHostname}, got=${result.hostname ?? 'missing'}`,
    };
  }

  // Optional action validation
  if (expectedAction && result.action !== expectedAction) {
    return {
      ok: false,
      errorCode: 'turnstile_invalid',
      details: `action mismatch: expected=${expectedAction}, got=${result.action ?? 'missing'}`,
    };
  }

  return { ok: true, details: 'siteverify success' };
}
