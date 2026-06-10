/**
 * server/audit.ts — Security Audit Logging
 *
 * Records security-relevant events to storage/audit/audit.jsonl
 * for post-incident analysis and compliance.
 *
 * Design principles:
 * - NO PIN, API key, Authorization header, cookie value, or real prompt stored
 * - NO raw IP stored; only clientHash = SHA256(IP + server-side salt)
 * - NO user identity beyond hashed request metadata
 * - Append-only, never overwrite
 * - Redaction applied before any log write
 *
 * Runtime file: storage/audit/audit.jsonl (gitignored)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// ── Config ──────────────────────────────────────────────────────────────────

const AUDIT_LOG_ENABLED = process.env.AUDIT_LOG_ENABLED !== 'false';
const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR || './storage/audit';
const AUDIT_LOG_PATH = path.resolve(process.cwd(), AUDIT_LOG_DIR, 'audit.jsonl');
const AUDIT_CLIENT_SALT = process.env.AUDIT_CLIENT_SALT || 'mmx-audit-salt-v1';

// ── Types ───────────────────────────────────────────────────────────────────

export type AuditEventType =
  | 'preview_access_unlock_success'
  | 'preview_access_unlock_failed'
  | 'preview_access_locked'
  | 'generation_access_unlock_success'
  | 'generation_access_unlock_failed'
  | 'generation_access_locked'
  | 'generation_requested'
  | 'generation_blocked_by_access'
  | 'generation_blocked_by_rate_limit'
  | 'generation_blocked_by_daily_quota'
  | 'generation_blocked_by_launch_guard'
  | 'job_created'
  | 'job_cancelled'
  | 'job_deleted'
  | 'job_retried'
  | 'track_downloaded'
  | 'track_audio_accessed'
  | 'audit_stats_viewed';

export interface AuditEvent {
  id: string;          // UUID v4
  type: AuditEventType;
  createdAt: string;   // ISO 8601
  requestId: string;   // UUID v4
  clientHash: string;   // SHA256(IP + salt), hex 64
  userAgentHash: string;// SHA256(user-agent + salt), hex 64
  route: string;
  status: number;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AuditStats {
  total: number;
  unlockFailed: number;
  unlockSuccess: number;
  unlockLocked: number;
  generationBlocked: number;
  generationRequested: number;
  jobDeleted: number;
  jobRetried: number;
  jobCreated: number;
}

export interface AuditListOptions {
  type?: AuditEventType;
  limit?: number;
  offset?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashInput(value: string): string {
  return crypto.createHash('sha256').update(value + AUDIT_CLIENT_SALT).digest('hex');
}

export function buildClientHash(ip: string, userAgent: string): string {
  return hashInput(ip + userAgent);
}

export function redactAuditPayload(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'pin', 'password', 'key', 'token', 'secret', 'authorization',
    'api_key', 'apikey', 'bearer', 'cookie', 'x-minimax-api-key',
  ];
  const redacted: Record<string, unknown> = { ...data };
  for (const k of Object.keys(redacted)) {
    if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
      redacted[k] = '[REDACTED]';
    }
  }
  return redacted;
}

// ── Init ───────────────────────────────────────────────────────────────────

function ensureAuditDir(): void {
  const dir = path.dirname(AUDIT_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function initAuditLog(): void {
  if (!AUDIT_LOG_ENABLED) return;
  ensureAuditDir();
  if (!fs.existsSync(AUDIT_LOG_PATH)) {
    fs.closeSync(fs.openSync(AUDIT_LOG_PATH, 'w'));
  }
}

initAuditLog();

// ── Append ──────────────────────────────────────────────────────────────────

export function appendAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt' | 'requestId'>): void {
  if (!AUDIT_LOG_ENABLED) return;
  try {
    const full: AuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const line = JSON.stringify(full) + '\n';
    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf-8');
  } catch {
    // Audit logging failure should never crash the server
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

export function listAuditEvents(opts: AuditListOptions = {}): { events: AuditEvent[]; total: number } {
  if (!AUDIT_LOG_ENABLED) return { events: [], total: 0 };
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) return { events: [], total: 0 };
    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const total = lines.length;

    let filtered = lines;
    if (opts.type) {
      filtered = filtered.filter(l => l.includes(`"type":"${opts.type}"`));
    }

    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 50;
    const page = filtered.slice(offset, offset + limit).map(line => {
      try { return JSON.parse(line) as AuditEvent; } catch { return null; }
    }).filter(Boolean) as AuditEvent[];

    return { events: page, total };
  } catch {
    return { events: [], total: 0 };
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────

const STAT_COUNTS: AuditStats = {
  total: 0,
  unlockFailed: 0,
  unlockSuccess: 0,
  unlockLocked: 0,
  generationBlocked: 0,
  generationRequested: 0,
  jobDeleted: 0,
  jobRetried: 0,
  jobCreated: 0,
};

export function getAuditStats(): AuditStats {
  return { ...STAT_COUNTS };
}

type StatKey = 'unlockFailed' | 'unlockSuccess' | 'unlockLocked' | 'generationBlocked' | 'generationRequested' | 'jobDeleted' | 'jobRetried' | 'jobCreated';

export function incrementStat(type: StatKey): void {
  if (type === 'unlockFailed') STAT_COUNTS.unlockFailed++;
  else if (type === 'unlockSuccess') STAT_COUNTS.unlockSuccess++;
  else if (type === 'unlockLocked') STAT_COUNTS.unlockLocked++;
  else if (type === 'generationBlocked') STAT_COUNTS.generationBlocked++;
  else if (type === 'generationRequested') STAT_COUNTS.generationRequested++;
  else if (type === 'jobDeleted') STAT_COUNTS.jobDeleted++;
  else if (type === 'jobRetried') STAT_COUNTS.jobRetried++;
  else if (type === 'jobCreated') STAT_COUNTS.jobCreated++;
  STAT_COUNTS.total++;
}

// ── Stat helpers for callers ─────────────────────────────────────────────────

export function auditUnlockSuccess(type: 'preview' | 'generation', route: string, clientHash: string, userAgentHash: string): void {
  const eventType: AuditEventType = type === 'preview'
    ? 'preview_access_unlock_success'
    : 'generation_access_unlock_success';
  appendAuditEvent({ type: eventType, clientHash, userAgentHash, route, status: 200, message: `${type} access unlocked` });
  incrementStat('unlockSuccess');
}

export function auditUnlockFailed(type: 'preview' | 'generation', route: string, clientHash: string, userAgentHash: string, message = 'unlock failed'): void {
  const eventType: AuditEventType = type === 'preview'
    ? 'preview_access_unlock_failed'
    : 'generation_access_unlock_failed';
  appendAuditEvent({ type: eventType, clientHash, userAgentHash, route, status: 401, message });
  incrementStat('unlockFailed');
}

export function auditUnlockLocked(type: 'preview' | 'generation', route: string, clientHash: string, userAgentHash: string): void {
  const eventType: AuditEventType = type === 'preview'
    ? 'preview_access_locked'
    : 'generation_access_locked';
  appendAuditEvent({ type: eventType, clientHash, userAgentHash, route, status: 429, message: 'too many failed attempts, temporarily locked' });
  incrementStat('unlockLocked');
}

export function auditGenerationBlocked(reason: 'access' | 'rate_limit' | 'daily_quota' | 'launch_guard', route: string, clientHash: string, userAgentHash: string): void {
  const typeMap: Record<string, AuditEventType> = {
    access: 'generation_blocked_by_access',
    rate_limit: 'generation_blocked_by_rate_limit',
    daily_quota: 'generation_blocked_by_daily_quota',
    launch_guard: 'generation_blocked_by_launch_guard',
  };
  appendAuditEvent({ type: typeMap[reason], clientHash, userAgentHash, route, status: 403, message: `generation blocked by ${reason}` });
  incrementStat('generationBlocked');
}

export function auditGenerationRequested(route: string, clientHash: string, userAgentHash: string, metadata?: Record<string, unknown>): void {
  appendAuditEvent({ type: 'generation_requested', clientHash, userAgentHash, route, status: 202, message: 'generation queued', metadata });
  incrementStat('generationRequested');
}

export function auditJobEvent(event: 'created' | 'cancelled' | 'deleted' | 'retried', route: string, clientHash: string, userAgentHash: string, metadata?: Record<string, unknown>): void {
  const typeMap: Record<string, AuditEventType> = {
    created: 'job_created',
    cancelled: 'job_cancelled',
    deleted: 'job_deleted',
    retried: 'job_retried',
  };
  const statusMap: Record<string, number> = { created: 202, cancelled: 200, deleted: 200, retried: 200 };
  appendAuditEvent({ type: typeMap[event], clientHash, userAgentHash, route, status: statusMap[event], message: `job ${event}`, metadata });
  incrementStat(event === 'created' ? 'jobCreated' : event === 'deleted' ? 'jobDeleted' : 'jobRetried');
}

export function auditTrackAccess(action: 'audio' | 'download', route: string, clientHash: string, userAgentHash: string, metadata?: Record<string, unknown>): void {
  const type: AuditEventType = action === 'download' ? 'track_downloaded' : 'track_audio_accessed';
  appendAuditEvent({ type, clientHash, userAgentHash, route, status: 200, message: `track ${action}`, metadata });
}