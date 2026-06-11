/**
 * Redaction helpers — Phase BYOK-A
 *
 * Used by the BYOK relay endpoint and any error / audit path that might
 * touch user-supplied credentials. The goal is to make sure no API key,
 * Authorization header, or Bearer literal ever reaches logs, audit
 * records, error responses, or generated track metadata.
 *
 * Sibling module to server/security.ts which has the older redactSecrets()
 * used by the operator / admin paths. This module is specifically scoped
 * to the public BYOK relay surface.
 */

const REDACTED = "[REDACTED]";

/**
 * Sentinel key names whose values must never leak to logs / metadata.
 * Matched case-insensitively.
 */
const SENSITIVE_KEYS = [
  "apikey",
  "api_key",
  "apikeysecret",
  "authorization",
  "x-api-key",
  "x-minimax-api-key",
  "x_mm_api_key",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "bearer",
  "secret",
  "clientsecret",
  "client_secret",
  "password",
  "passwd",
  "pwd",
  "privatekey",
  "private_key",
] as const;

const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 256;

/**
 * Replace a sensitive string in any value.
 * - Bearer / key prefixes are stripped: "Bearer eyJ..." → "Bearer [REDACTED]"
 * - Key=value style is preserved: "apikey=abc" → "apikey=[REDACTED]"
 */
export function redactSensitive(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (typeof value === "string") {
    s = value;
  } else if (typeof value === "number" || typeof value === "boolean") {
    s = String(value);
  } else {
    try {
      s = JSON.stringify(value);
    } catch {
      s = Object.prototype.toString.call(value);
    }
  }

  // 1) Bearer <token>  →  Bearer [REDACTED]
  s = s.replace(
    /(Bearer\s+)([A-Za-z0-9_\-\.=]{4,})/gi,
    `$1${REDACTED}`,
  );

  // 2) key=value  patterns
  for (const k of SENSITIVE_KEYS) {
    const re = new RegExp(
      `(\\b${k.replace(/[_-]/g, "[_-]")}\\s*[:=]\\s*)("[^"]*"|'[^']*'|[^\\s,;}{]+)`,
      "gi",
    );
    s = s.replace(re, `$1"${REDACTED}"`);
  }

  // 3) Standalone long hex/base64 tokens (≥ 32 chars, key-like) — best effort.
  s = s.replace(
    /\b[A-Za-z0-9_\-]{32,}\b/g,
    (m) => {
      // Heuristic: only redact if it looks like a token (contains both letters and digits,
      // or has at least one underscore/dash). This avoids clobbering normal English words.
      const hasDigit = /\d/.test(m);
      const hasLetter = /[A-Za-z]/.test(m);
      const hasSep = /[_\-]/.test(m);
      if ((hasDigit && hasLetter) || hasSep) return REDACTED;
      return m;
    },
  );

  return s;
}

/**
 * Walk an object / array and redact sensitive keys recursively.
 * Returns a NEW object — does not mutate the input.
 */
export function redactObject<T>(obj: T): T {
  function walk(v: unknown): unknown {
    if (v === null || v === undefined) return v;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const lower = k.toLowerCase();
        if (
          SENSITIVE_KEYS.some(
            (sk) => lower === sk || lower.includes(sk),
          )
        ) {
          out[k] = REDACTED;
        } else {
          out[k] = walk(val);
        }
      }
      return out;
    }
    if (typeof v === "string") {
      // Strings may carry error messages containing "Bearer xxx"
      if (
        /Bearer\s+[A-Za-z0-9_\-\.=]{4,}/i.test(v) ||
        SENSITIVE_KEYS.some((k) =>
          new RegExp(`\\b${k.replace(/[_-]/g, "[_-]")}\\s*[:=]`, "i").test(v),
        )
      ) {
        return redactSensitive(v);
      }
    }
    return v;
  }
  return walk(obj) as T;
}

/**
 * Validate that a user-supplied apiKey looks like a real key.
 * - Must be a non-empty string
 * - Length within sane bounds
 * - Returns a length bucket (not the key itself) so the server can echo
 *   "short" / "normal" back to the client for UI hints, without exposing
 *   any key material.
 */
export function validateApiKeyShape(apiKey: unknown): {
  ok: boolean;
  bucket?: "tiny" | "short" | "normal" | "long" | "absurd";
  reason?: "missing" | "too_short" | "too_long" | "wrong_type";
} {
  if (typeof apiKey !== "string") {
    return { ok: false, reason: "wrong_type" };
  }
  if (apiKey.trim().length === 0) {
    return { ok: false, reason: "missing" };
  }
  if (apiKey.length < MIN_KEY_LENGTH) {
    return { ok: false, reason: "too_short" };
  }
  if (apiKey.length > MAX_KEY_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  const len = apiKey.length;
  const bucket =
    len < 20 ? "tiny"
    : len < 40 ? "short"
    : len < 80 ? "normal"
    : len < 200 ? "long"
    : "absurd";
  return { ok: true, bucket };
}

export const _redactionConstants = {
  REDACTED,
  MIN_KEY_LENGTH,
  MAX_KEY_LENGTH,
  SENSITIVE_KEYS,
};
