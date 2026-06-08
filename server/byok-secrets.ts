/**
 * server/byok-secrets.ts — BYOK temporary API key management.
 *
 * Design:
 * - In-memory Map only, never written to disk.
 * - Keys are stored only for the duration of a job.
 * - Deleted immediately on job completion / failure / cancel.
 *
 * Security guarantees:
 * - No keys written to job object, manifest, audit log, or console.
 * - No keys written to disk.
 * - Keys auto-expire after TTL.
 * - redactForLog() always replaces key value.
 */

import { randomUUID } from 'node:crypto';

interface SecretEntry {
  key: string;
  createdAt: number;
  expiresAt: number;
  jobId: string;
}

const KEY_TTL_MS = Number(process.env.BYOK_KEY_TTL_MS ?? 30 * 60 * 1000); // 30 min default

const secretStore = new Map<string, SecretEntry>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Store a BYOK session key for a specific job.
 * Key is retrievable for BYOK_KEY_TTL milliseconds.
 */
export function setJobApiKey(jobId: string, apiKey: string): void {
  const now = Date.now();
  secretStore.set(jobId, {
    key: apiKey,
    createdAt: now,
    expiresAt: now + KEY_TTL_MS,
    jobId,
  });
}

/**
 * Retrieve the BYOK key for a job, if still valid.
 * Returns undefined if expired, deleted, or not found.
 */
export function getJobApiKey(jobId: string): string | undefined {
  const entry = secretStore.get(jobId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    secretStore.delete(jobId);
    return undefined;
  }
  return entry.key;
}

/**
 * Immediately delete the BYOK key for a job.
 * Call this on job success, failure, or cancel.
 */
export function deleteJobApiKey(jobId: string): void {
  secretStore.delete(jobId);
}

/**
 * Remove all expired entries.
 * Called periodically to prevent memory leaks.
 */
export function clearExpiredJobApiKeys(): number {
  const now = Date.now();
  let cleared = 0;
  for (const [jobId, entry] of Array.from(secretStore.entries())) {
    if (now > entry.expiresAt) {
      secretStore.delete(jobId);
      cleared++;
    }
  }
  return cleared;
}

/**
 * Replace any API key value in a string with [BYOK_KEY_REDACTED].
 * Use this before any logging or error message construction.
 */
export function redactForLog(text: string): string {
  return text
    .replace(/(sk[_-]?)[a-zA-Z0-9]{8,}/gi, '$1[REDACTED]')
    .replace(/(x-minimax-api-key:\s*)([a-zA-Z0-9_-]{10,})/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)([a-zA-Z0-9._-]{10,})/gi, '$1[REDACTED]');
}

/**
 * Get a safe summary of the key (first 4 + last 4 chars, or length bucket).
 */
export function getKeySummary(apiKey: string): { prefix: string; suffix: string; length: number } {
  const k = apiKey ?? '';
  return {
    prefix: k.slice(0, 4),
    suffix: k.slice(-4),
    length: k.length,
  };
}

/**
 * Get approximate bucket for key length (for audit metadata).
 */
export function getKeyLengthBucket(apiKey: string): 'tiny' | 'short' | 'normal' | 'long' {
  const len = (apiKey ?? '').length;
  if (len < 20) return 'tiny';
  if (len < 32) return 'short';
  if (len < 64) return 'normal';
  return 'long';
}

/**
 * Count of currently stored keys (for health/debug endpoint).
 */
export function getActiveKeyCount(): number {
  clearExpiredJobApiKeys();
  return secretStore.size;
}
