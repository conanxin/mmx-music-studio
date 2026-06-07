/**
 * server/auth-guard.ts — Auth Guard: Brute-force protection for PIN unlock endpoints
 *
 * In-memory rate limiter for failed unlock attempts.
 * Per clientHash counting — no Redis needed for single-server deployment.
 *
 * Environment variables:
 *   AUTH_GUARD_ENABLED           — 'true' to enable (default: true)
 *   AUTH_GUARD_WINDOW_MS        — time window in ms (default: 300000 = 5min)
 *   AUTH_GUARD_MAX_FAILURES    — max failures in window (default: 5)
 *   AUTH_GUARD_LOCK_MS          — lockout duration in ms (default: 900000 = 15min)
 *
 * Design:
 * - In-memory only (no Redis)
 * - No PIN stored, no secret stored
 * - Success unlocks (clears failure count)
 * - Records audit events for all outcomes
 */

import * as crypto from 'node:crypto';

// ── Config ──────────────────────────────────────────────────────────────────

const ENABLED = process.env.AUTH_GUARD_ENABLED !== 'false';
const WINDOW_MS = Number(process.env.AUTH_GUARD_WINDOW_MS ?? '300000');
const MAX_FAILURES = Number(process.env.AUTH_GUARD_MAX_FAILURES ?? '5');
const LOCK_MS = Number(process.env.AUTH_GUARD_LOCK_MS ?? '900000');
const SALT = process.env.AUTH_GUARD_SALT || 'mmx-auth-guard-salt-v1';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthGuardResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

interface AttemptRecord {
  failures: number;
  firstFailureAt: number;
  lockedAt?: number;
}

// ── State ────────────────────────────────────────────────────────────────────

// In-memory store: clientHash → attempt record
const attempts = new Map<string, AttemptRecord>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClientHash(ip: string, userAgent: string): string {
  return crypto.createHash('sha256').update(ip + userAgent + SALT).digest('hex');
}

function now(): number {
  return Date.now();
}

// ── Core guard ──────────────────────────────────────────────────────────────

/**
 * Check if a client is currently locked out.
 * Returns { allowed: false, reason, retryAfterMs } if locked.
 * Returns { allowed: true } if the client may proceed.
 */
export function checkAuthGuard(ip: string, userAgent: string): AuthGuardResult {
  if (!ENABLED) return { allowed: true };

  const hash = getClientHash(ip, userAgent);
  const record = attempts.get(hash);

  if (!record) return { allowed: true };

  const elapsed = now() - record.firstFailureAt;

  // If locked, check if lock expired
  if (record.lockedAt !== undefined) {
    const lockAge = now() - record.lockedAt;
    if (lockAge < LOCK_MS) {
      return {
        allowed: false,
        reason: 'too many failed attempts, temporarily locked',
        retryAfterMs: LOCK_MS - lockAge,
      };
    }
    // Lock expired, reset
    attempts.delete(hash);
    return { allowed: true };
  }

  // Within window?
  if (elapsed > WINDOW_MS) {
    attempts.delete(hash);
    return { allowed: true };
  }

  // Within window, check failure count
  if (record.failures >= MAX_FAILURES) {
    record.lockedAt = now();
    return {
      allowed: false,
      reason: 'too many failed attempts, temporarily locked',
      retryAfterMs: LOCK_MS,
    };
  }

  return { allowed: true };
}

/**
 * Record a failed unlock attempt.
 */
export function recordFailedAttempt(ip: string, userAgent: string): void {
  if (!ENABLED) return;

  const hash = getClientHash(ip, userAgent);
  const record = attempts.get(hash);

  if (!record) {
    attempts.set(hash, { failures: 1, firstFailureAt: now() });
  } else {
    const elapsed = now() - record.firstFailureAt;
    if (elapsed > WINDOW_MS) {
      // New window
      attempts.set(hash, { failures: 1, firstFailureAt: now() });
    } else {
      record.failures++;
    }
  }
}

/**
 * Record a successful unlock — clears failure count for this client.
 */
export function recordSuccessfulUnlock(ip: string, userAgent: string): void {
  if (!ENABLED) return;

  const hash = getClientHash(ip, userAgent);
  attempts.delete(hash);
}

/**
 * Get current guard stats (for health/debug endpoints).
 */
export function getAuthGuardStats(): {
  enabled: boolean;
  windowMs: number;
  maxFailures: number;
  lockMs: number;
  trackedClients: number;
  lockedClients: number;
} {
  let lockedClients = 0;
  const records = Array.from(attempts.values());
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.lockedAt !== undefined && (now() - record.lockedAt) < LOCK_MS) {
      lockedClients++;
    }
  }
  return {
    enabled: ENABLED,
    windowMs: WINDOW_MS,
    maxFailures: MAX_FAILURES,
    lockMs: LOCK_MS,
    trackedClients: attempts.size,
    lockedClients,
  };
}

/**
 * Export clientHash for audit logging (no raw IP stored).
 */
export function getClientHashForAudit(ip: string, userAgent: string): string {
  return getClientHash(ip, userAgent);
}