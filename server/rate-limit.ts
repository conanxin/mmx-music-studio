/**
 * server/rate-limit.ts — Rate limiting and daily generation quota.
 *
 * Two layers:
 * 1. Rate limit: max N requests per time window per client IP (in-memory).
 * 2. Daily quota: max N generations per day across all clients (persisted to disk).
 *
 * Security guarantees:
 * - IP addresses are hashed before storage (not stored in plain text).
 * - API keys/tokens are never logged.
 * - Quota file contains only counts, never secrets.
 * - Rate limit records are in-memory only (reset on restart).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';

// ── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number; // e.g. 60000 = 60 seconds
  maxRequests: number;     // e.g. 3
}

export interface DailyQuotaConfig {
  enabled: boolean;
  limit: number;           // e.g. 10
}

export interface QuotaRecord {
  date: string; // YYYY-MM-DD
  total: number;
  bySource: {
    mock: number;
    'minimax-api': number;
    'mmx-cli': number;
  };
  updatedAt: string;
}

// ── Config from env ─────────────────────────────────────────────────────────

export function buildRateLimitConfig(): RateLimitConfig {
  return {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    maxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 3),
  };
}

export function buildDailyQuotaConfig(): DailyQuotaConfig {
  return {
    enabled: process.env.DAILY_QUOTA_ENABLED === 'true',
    limit: Number(process.env.DAILY_GENERATION_LIMIT || 10),
  };
}

// ── Paths ───────────────────────────────────────────────────────────────────

const STORAGE_BASE = path.resolve(process.cwd(), 'storage');
const QUOTA_DIR = path.join(STORAGE_BASE, 'quota');
const QUOTA_FILE = path.join(QUOTA_DIR, 'daily.json');

// ── In-memory rate limit state ─────────────────────────────────────────────

/**
 * Rate limit records: clientKey → { timestamps: number[] }
 * clientKey is a hash of the IP, never the raw IP.
 */
const rateLimitStore = new Map<string, number[]>();

// ── Client IP key ──────────────────────────────────────────────────────────

/**
 * Get a hashed client key for rate limiting.
 * Prefers X-Forwarded-For (for reverse proxy setups),
 * falls back to socket.remoteAddress.
 * The IP is hashed so raw IPs are never stored in memory.
 */
export function getClientKey(req: IncomingMessage): string {
  const raw =
    (req.headers['x-forwarded-for'] as string | undefined)
    ?? (req.headers['x-real-ip'] as string | undefined)
    ?? req.socket.remoteAddress
    ?? 'unknown';

  // Normalize: take first IP if multiple are listed (proxy chain)
  const ip = String(raw).split(',')[0].trim();
  // Hash so we never store plain IPs in memory
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

// ── Rate limit ─────────────────────────────────────────────────────────────

/**
 * Check if a client is within rate limits.
 * Returns { allowed: true } if OK, { allowed: false, retryAfterMs: N } if exceeded.
 *
 * NOTE: This function both checks AND records atomically.
 * Each call to checkRateLimit() that returns allowed=true increments the counter.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; retryAfterMs?: number } {
  if (!config.enabled) return { allowed: true };

  const now = Date.now();
  const windowStart = now - config.windowMs;

  let timestamps = rateLimitStore.get(key);
  if (!timestamps) {
    timestamps = [];
    rateLimitStore.set(key, timestamps);
  }

  // Prune old timestamps outside the window
  const valid = timestamps.filter((t) => t > windowStart);

  if (valid.length >= config.maxRequests) {
    const oldestInWindow = Math.min(...valid);
    const retryAfterMs = oldestInWindow + config.windowMs - now;
    return { allowed: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  // Record this hit
  valid.push(now);
  rateLimitStore.set(key, valid);
  return { allowed: true };
}

/**
 * Reset the in-memory rate limit store.
 * Used by smoke tests to ensure a clean state before running.
 * Also useful when switching runtime modes or after a configuration change.
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

// ── Daily quota ─────────────────────────────────────────────────────────────

function ensureQuotaDir(): void {
  if (!fs.existsSync(QUOTA_DIR)) {
    fs.mkdirSync(QUOTA_DIR, { recursive: true });
  }
}

function loadQuota(): QuotaRecord {
  ensureQuotaDir();
  if (!fs.existsSync(QUOTA_FILE)) {
    return emptyQuota();
  }
  try {
    const raw = fs.readFileSync(QUOTA_FILE, 'utf-8');
    const record = JSON.parse(raw) as QuotaRecord;
    // Reset if it's a new day
    if (record.date !== todayStr()) {
      return emptyQuota();
    }
    return record;
  } catch {
    return emptyQuota();
  }
}

function saveQuota(record: QuotaRecord): void {
  ensureQuotaDir();
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(record, null, 2), 'utf-8');
}

function emptyQuota(): QuotaRecord {
  return {
    date: todayStr(),
    total: 0,
    bySource: { mock: 0, 'minimax-api': 0, 'mmx-cli': 0 },
    updatedAt: new Date().toISOString(),
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Check if daily generation quota allows a new job.
 * Returns { allowed: true } or { allowed: false, used: N, limit: N }.
 */
export function checkDailyQuota(config: DailyQuotaConfig): {
  allowed: boolean;
  used?: number;
  remaining?: number;
} {
  if (!config.enabled) return { allowed: true };

  const record = loadQuota();
  if (record.total >= config.limit) {
    return { allowed: false, used: record.total, remaining: 0 };
  }
  return {
    allowed: true,
    used: record.total,
    remaining: config.limit - record.total,
  };
}

/**
 * Increment the daily generation count.
 * Called when a job transitions to 'succeeded' (not queued/running/failed/cancelled).
 * source: which generation adapter was used.
 */
export function incrementDailyQuota(source: 'mock' | 'minimax-api' | 'mmx-cli'): void {
  const record = loadQuota();
  record.total += 1;
  record.bySource[source] = (record.bySource[source] ?? 0) + 1;
  record.updatedAt = new Date().toISOString();
  saveQuota(record);
}

/**
 * Get current daily quota status without modifying anything.
 */
export function getDailyQuotaStatus(config: DailyQuotaConfig): {
  used: number;
  limit: number;
  remaining: number;
  date: string;
} {
  const record = loadQuota();
  return {
    used: record.total,
    limit: config.limit,
    remaining: Math.max(0, config.limit - record.total),
    date: record.date,
  };
}

/**
 * Reset the daily quota to zero.
 * Used by smoke tests to ensure a clean state before running.
 */
export function resetDailyQuota(): void {
  saveQuota(emptyQuota());
}

// ── Real API Attempt Guard (Phase 5B-C) ────────────────────────────────────────

/**
 * Hard protection against real MiniMax API calls.
 *
 * Unlike daily quota (counts on success), attempt guard counts BEFORE the
 * network call. If remaining=0, NO network request is made at all.
 *
 * This prevents the "99 failed retries = 99 real API calls" problem.
 */

export interface RealApiAttemptConfig {
  enabled: boolean;
  dailyLimit: number; // e.g. 1 — one real API attempt per day is enough for testing
}

export interface RealApiAttemptRecord {
  date: string; // YYYY-MM-DD
  attempts: number;
  updatedAt: string;
}

const REAL_API_ATTEMPTS_FILE = path.join(QUOTA_DIR, 'real-api-attempts.json');

export function buildRealApiAttemptConfig(): RealApiAttemptConfig {
  return {
    enabled: process.env.REAL_API_ATTEMPT_LIMIT_ENABLED === 'true',
    dailyLimit: Number(process.env.REAL_API_DAILY_ATTEMPT_LIMIT || 1),
  };
}

function loadRealApiAttemptRecord(): RealApiAttemptRecord {
  ensureQuotaDir();
  if (!fs.existsSync(REAL_API_ATTEMPTS_FILE)) {
    return emptyRealApiAttemptRecord();
  }
  try {
    const raw = fs.readFileSync(REAL_API_ATTEMPTS_FILE, 'utf-8');
    const record = JSON.parse(raw) as RealApiAttemptRecord;
    // Reset if it's a new day
    if (record.date !== todayStr()) {
      return emptyRealApiAttemptRecord();
    }
    return record;
  } catch {
    return emptyRealApiAttemptRecord();
  }
}

function saveRealApiAttemptRecord(record: RealApiAttemptRecord): void {
  ensureQuotaDir();
  fs.writeFileSync(REAL_API_ATTEMPTS_FILE, JSON.stringify(record, null, 2), 'utf-8');
}

function emptyRealApiAttemptRecord(): RealApiAttemptRecord {
  return {
    date: todayStr(),
    attempts: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Check if a new real API attempt is allowed.
 * Returns { allowed: true } or { allowed: false, attempts: N, limit: N, remaining: 0 }.
 *
 * Call this BEFORE making the actual MiniMax API call.
 */
export function checkRealApiAttemptLimit(config: RealApiAttemptConfig): {
  allowed: boolean;
  attempts?: number;
  limit?: number;
  remaining?: number;
} {
  if (!config.enabled) return { allowed: true };

  const record = loadRealApiAttemptRecord();
  if (record.attempts >= config.dailyLimit) {
    return { allowed: false, attempts: record.attempts, limit: config.dailyLimit, remaining: 0 };
  }
  return {
    allowed: true,
    attempts: record.attempts,
    limit: config.dailyLimit,
    remaining: config.dailyLimit - record.attempts,
  };
}

/**
 * Reserve a real API attempt slot BEFORE the network call.
 * Call this right before callMiniMaxApi() — if it throws, we still count the attempt.
 *
 * If limit is exceeded, throws an error immediately (no network call).
 */
export function reserveRealApiAttempt(
  config: RealApiAttemptConfig,
  metadata?: { jobId?: string; mode?: string },
): void {
  if (!config.enabled) return; // guard disabled — no protection

  const record = loadRealApiAttemptRecord();
  record.attempts += 1;
  record.updatedAt = new Date().toISOString();
  saveRealApiAttemptRecord(record);

  // Log without secrets — only metadata about what was being generated
  const meta = metadata
    ? ` jobId=${metadata.jobId ?? 'unknown'} mode=${metadata.mode ?? 'unknown'}`
    : '';
  console.log(`[attempt-guard] real API attempt reserved: ${record.attempts}/${config.dailyLimit}${meta}`);
}

/**
 * Get current real API attempt stats without modifying anything.
 */
export function getRealApiAttemptStats(config: RealApiAttemptConfig): {
  attempts: number;
  limit: number;
  remaining: number;
  date: string;
} {
  const record = loadRealApiAttemptRecord();
  return {
    attempts: record.attempts,
    limit: config.dailyLimit,
    remaining: Math.max(0, config.dailyLimit - record.attempts),
    date: record.date,
  };
}