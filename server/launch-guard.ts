/**
 * server/launch-guard.ts — Public generation guardrails.
 *
 * Protections (all in addition to existing rate-limit + daily-quota):
 * 1. Global pause: PUBLIC_GENERATION_ENABLED=false blocks all public generation.
 * 2. Per-source daily limit: same source hash ≤ N jobs/day.
 * 3. Per-source cooldown: same source hash must wait N seconds between jobs.
 *
 * Security guarantees:
 * - Source identification uses getClientKey() (SHA256 of IP, never raw IP).
 * - Guard state is hashed, never contains raw IPs.
 * - Guard state is never written to audit logs.
 * - API keys / tokens are never in guard state.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { getClientKey } from './rate-limit.js';

// ── Config ─────────────────────────────────────────────────────────────────────

export interface LaunchGuardConfig {
  enabled: boolean;
  publicGenerationEnabled: boolean;
  perSourceDailyLimit: number;
  cooldownSeconds: number;
}

export function buildLaunchGuardConfig(): LaunchGuardConfig {
  return {
    enabled: process.env.PUBLIC_GENERATION_GUARD_ENABLED !== 'false',
    publicGenerationEnabled: process.env.PUBLIC_GENERATION_ENABLED !== 'false',
    perSourceDailyLimit: Number(process.env.PER_SOURCE_DAILY_GENERATION_LIMIT || 5),
    cooldownSeconds: Number(process.env.GENERATION_COOLDOWN_SECONDS || 30),
  };
}

// ── Guard state ────────────────────────────────────────────────────────────────

interface GuardSourceEntry {
  count: number;
  lastGeneratedAt: string; // ISO
}

interface GuardState {
  date: string; // YYYY-MM-DD
  sources: Record<string, GuardSourceEntry>; // sourceHash → entry
  updatedAt?: string;
}

const STORAGE_BASE = path.resolve(process.cwd(), 'storage');
const GUARD_DIR = path.join(STORAGE_BASE, 'guard');
const GUARD_FILE = path.join(GUARD_DIR, 'public-generation-guard.json');

// ── Guard state persistence ──────────────────────────────────────────────────

function ensureGuardDir(): void {
  if (!fs.existsSync(GUARD_DIR)) {
    fs.mkdirSync(GUARD_DIR, { recursive: true });
  }
}

function loadGuardState(): GuardState {
  ensureGuardDir();
  if (!fs.existsSync(GUARD_FILE)) {
    return emptyGuardState();
  }
  try {
    const raw = fs.readFileSync(GUARD_FILE, 'utf-8');
    const state = JSON.parse(raw) as GuardState;
    // Auto-reset on new day
    if (state.date !== todayStr()) {
      return emptyGuardState();
    }
    return state;
  } catch {
    // Corrupt file — rebuild empty state
    return emptyGuardState();
  }
}

function saveGuardState(state: GuardState): void {
  ensureGuardDir();
  // Atomic write: temp + rename
  const tmp = GUARD_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmp, GUARD_FILE);
}

function emptyGuardState(): GuardState {
  return {
    date: todayStr(),
    sources: {},
    updatedAt: new Date().toISOString(),
  };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Source identification ───────────────────────────────────────────────────

/**
 * Get the hashed source key for a request.
 * Uses the same getClientKey from rate-limit.ts for consistency
 * (SHA256 of IP, never raw IP).
 */
export function getSourceHash(req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } }): string {
  return getClientKey(req as Parameters<typeof getClientKey>[0]);
}

// ── Guard checks ────────────────────────────────────────────────────────────

export type GuardCheckResult =
  | { allowed: true; sourceHash: string }
  | { allowed: false; code: 'public_generation_paused'; message: string }
  | { allowed: false; code: 'per_source_daily_limit_exceeded'; message: string; limit: number; remaining: number; resetsAt: string }
  | { allowed: false; code: 'generation_cooldown_active'; message: string; retryAfterSeconds: number };

export function isGuardBlocked(result: GuardCheckResult): result is Extract<GuardCheckResult, { allowed: false }> {
  return result.allowed === false;
}

/**
 * Check if a generation request should be allowed under launch guard rules.
 * Returns GuardCheckResult.
 *
 * This function both checks AND records atomically on success:
 * on allowed=true the source entry is incremented.
 */
export function checkLaunchGuard(
  req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } },
  config: LaunchGuardConfig,
): GuardCheckResult {
  // Guard disabled — allow everything
  if (!config.enabled) {
    return { allowed: true, sourceHash: '' };
  }

  const sourceHash = getSourceHash(req);
  const now = Date.now();
  const state = loadGuardState();

  // 1. Global pause check
  if (!config.publicGenerationEnabled) {
    return {
      allowed: false,
      code: 'public_generation_paused',
      message: '公开生成当前已暂停，作品库和播放功能仍可使用。',
    };
  }

  // 2. Per-source daily limit check
  const entry = state.sources[sourceHash];
  const todayCount = entry?.count ?? 0;
  if (todayCount >= config.perSourceDailyLimit) {
    const resetsAt = `${todayStr()}T23:59:59.999Z`;
    return {
      allowed: false,
      code: 'per_source_daily_limit_exceeded',
      message: `当前访问来源今日生成次数已达上限（${config.perSourceDailyLimit}次），明天重置后可继续生成。`,
      limit: config.perSourceDailyLimit,
      remaining: 0,
      resetsAt,
    };
  }

  // 3. Per-source cooldown check
  if (entry?.lastGeneratedAt) {
    const lastMs = new Date(entry.lastGeneratedAt).getTime();
    const elapsedSeconds = (now - lastMs) / 1000;
    if (elapsedSeconds < config.cooldownSeconds) {
      const retryAfterSeconds = Math.ceil(config.cooldownSeconds - elapsedSeconds);
      return {
        allowed: false,
        code: 'generation_cooldown_active',
        message: `生成请求过于频繁，请${retryAfterSeconds}秒后再试。`,
        retryAfterSeconds,
      };
    }
  }

  // ── Passed all checks — record this generation ──────────────────────────────
  const newState: GuardState = {
    date: todayStr(),
    sources: {
      ...state.sources,
      [sourceHash]: {
        count: todayCount + 1,
        lastGeneratedAt: new Date(now).toISOString(),
      },
    },
    updatedAt: new Date().toISOString(),
  };
  saveGuardState(newState);

  return { allowed: true, sourceHash };
}

// ── Guard state queries (read-only, for health endpoint) ────────────────────

/**
 * Get current guard state for a source (read-only, no side effects).
 * Returns null if guard is disabled or source not found.
 */
export function getSourceGuardStatus(
  req: { headers: Record<string, string | string[] | undefined>; socket: { remoteAddress?: string } },
  config: LaunchGuardConfig,
): { count: number; limit: number; remaining: number; lastGeneratedAt: string | null } | null {
  if (!config.enabled) return null;
  const sourceHash = getSourceHash(req);
  const state = loadGuardState();
  const entry = state.sources[sourceHash];
  if (!entry) return { count: 0, limit: config.perSourceDailyLimit, remaining: config.perSourceDailyLimit, lastGeneratedAt: null };
  return {
    count: entry.count,
    limit: config.perSourceDailyLimit,
    remaining: Math.max(0, config.perSourceDailyLimit - entry.count),
    lastGeneratedAt: entry.lastGeneratedAt,
  };
}

// ── Debug reset (smoke test only) ─────────────────────────────────────────

/**
 * Reset all guard state.
 * WARNING: This is only enabled when DEBUG_RESET_ENDPOINTS=true.
 * It is NEVER enabled in production.
 */
export function resetGuardState(): void {
  saveGuardState(emptyGuardState());
}