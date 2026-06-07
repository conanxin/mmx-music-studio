/**
 * Server-side security utilities.
 * No logging of API keys or Authorization headers.
 */

/**
 * Extract the session API key from request headers.
 * Returns undefined if not present — does NOT throw.
 */
export function getSessionApiKey(headers: Record<string, string | string[] | undefined>): string | undefined {
  const raw = headers['x-minimax-api-key'];
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Validate that a key looks plausible (not obviously fake/empty).
 * Returns a warning string if suspicious, undefined otherwise.
 * Does NOT log the key value.
 */
export function validateKeyLooksReasonable(key: string): string | undefined {
  if (!key || key.trim().length === 0) {
    return 'Key 为空';
  }
  if (key.startsWith('<') || key.includes('your_')) {
    return 'Key 看起来是占位符，请填入真实 Token Plan Key';
  }
  if (key.length < 16) {
    return 'Key 长度过短，请确认是否正确';
  }
  return undefined;
}

/**
 * Check if a URL is safe for internal use (no data:, javascript:, etc.).
 * Does NOT log the URL.
 */
export function isSafeAudioUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize a title for use in Content-Disposition header.
 * Uses RFC 5987 encoding for non-ASCII characters so Node.js doesn't reject
 * the header (which only accepts ASCII in header values by default).
 */
export function safeContentDisposition(fileName: string): string {
  // ASCII-safe name for the filename* parameter (RFC 5987)
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/__+/g, '_');
  // Encode the original for filename* (UTF-8 percent-encoding)
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

/**
 * Redact API keys and secrets from strings before logging.
 * Replaces patterns like sk-..., Bearer ..., etc. with [REDACTED].
 * Safe for console.error / server logs.
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/(sk_?)[a-zA-Z0-9]{8,}/g, '[REDACTED_KEY]')
    .replace(/(Bearer\s+)[a-zA-Z0-9_.-]{10,}/g, '$1[REDACTED]')
    .replace(/(x-minimax-api-key:\s*)[a-zA-Z0-9_.-]{10,}/gi, '$1[REDACTED]')
    .replace(/("api_key"\s*:\s*")[^"]{8,}/g, '$1[REDACTED]')
    .replace(/(MINIMAX_API_KEY\s*[=:]\s*)[^\s,}\]]{8,}/g, '$1[REDACTED]');
}