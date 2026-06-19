/**
 * Lightweight five-user quota helpers.
 *
 * Quotas are disabled by default and are only evaluated when the caller passes
 * enabled=true. The store intentionally records only counters scoped by
 * user/workspace/action/date; it never stores prompts, provider URLs, API keys,
 * tokens, confirmation phrases, or provider response bodies.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  ACCESS_STORE_DIR,
  isInviteUserAccessContext,
  type AccessContext,
} from './access.js';

export type QuotaAction = 'generate_byok' | 'save_to_library';
export type QuotaScope = 'user' | 'workspace';

export interface QuotaUsageRecord {
  date: string;
  userId: string;
  workspaceId: string;
  action: QuotaAction;
  count: number;
  updatedAt: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  code?: 'multiuser_quota_exceeded';
  scope?: QuotaScope;
  action: QuotaAction;
  limit: number;
  used: number;
  remaining: number;
}

export interface QuotaLimits {
  dailyGeneratePerUser: number;
  dailyGeneratePerWorkspace: number;
  dailySavePerUser: number;
  dailySavePerWorkspace: number;
}

export interface QuotaStoreOptions {
  enabled?: boolean;
  storeDir?: string;
  now?: Date;
}

export const QUOTA_STORE_DIR_NAME = 'quotas';

export const DEFAULT_MULTIUSER_QUOTA_LIMITS: QuotaLimits = Object.freeze({
  dailyGeneratePerUser: 10,
  dailyGeneratePerWorkspace: 50,
  dailySavePerUser: 20,
  dailySavePerWorkspace: 100,
});

export function getQuotaDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function getQuotaStoreRoot(options: QuotaStoreOptions = {}): string {
  return path.resolve(process.cwd(), options.storeDir ?? ACCESS_STORE_DIR, QUOTA_STORE_DIR_NAME);
}

function getQuotaStoreFile(options: QuotaStoreOptions = {}): string {
  return path.join(getQuotaStoreRoot(options), `${getQuotaDateKey(options.now)}.json`);
}

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function parseQuotaUsageRecord(value: unknown): QuotaUsageRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<QuotaUsageRecord>;
  if (
    typeof record.date !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.workspaceId !== 'string' ||
    (record.action !== 'generate_byok' && record.action !== 'save_to_library') ||
    typeof record.updatedAt !== 'string'
  ) {
    return null;
  }
  return {
    date: record.date,
    userId: record.userId,
    workspaceId: record.workspaceId,
    action: record.action,
    count: safeCount(record.count),
    updatedAt: record.updatedAt,
  };
}

export function readQuotaStore(options: QuotaStoreOptions = {}): QuotaUsageRecord[] {
  if (options.enabled === false) return [];
  const filePath = getQuotaStoreFile(options);
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((value) => {
    const record = parseQuotaUsageRecord(value);
    return record ? [record] : [];
  });
}

export function writeQuotaStoreAtomic(
  records: QuotaUsageRecord[],
  options: QuotaStoreOptions = {},
): void {
  const root = getQuotaStoreRoot(options);
  fs.mkdirSync(root, { recursive: true });
  const filePath = getQuotaStoreFile(options);
  const tempPath = path.join(
    root,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tempPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function quotaLimitsForAction(action: QuotaAction, limits: QuotaLimits): {
  userLimit: number;
  workspaceLimit: number;
} {
  if (action === 'generate_byok') {
    return {
      userLimit: limits.dailyGeneratePerUser,
      workspaceLimit: limits.dailyGeneratePerWorkspace,
    };
  }
  return {
    userLimit: limits.dailySavePerUser,
    workspaceLimit: limits.dailySavePerWorkspace,
  };
}

function usageFor(
  records: QuotaUsageRecord[],
  date: string,
  action: QuotaAction,
  scope: QuotaScope,
  id: string,
): number {
  return records
    .filter((record) => (
      record.date === date &&
      record.action === action &&
      (scope === 'user' ? record.userId === id : record.workspaceId === id)
    ))
    .reduce((total, record) => total + record.count, 0);
}

export function checkMultiuserQuota(
  accessContext: AccessContext,
  action: QuotaAction,
  limits: QuotaLimits,
  options: QuotaStoreOptions = {},
): QuotaCheckResult {
  if (options.enabled !== true) {
    return { allowed: true, action, limit: Number.POSITIVE_INFINITY, used: 0, remaining: Number.POSITIVE_INFINITY };
  }

  if (!isInviteUserAccessContext(accessContext)) {
    return {
      allowed: false,
      code: 'multiuser_quota_exceeded',
      scope: 'user',
      action,
      limit: 0,
      used: 0,
      remaining: 0,
    };
  }

  const userId = accessContext.userId ?? '';
  const workspaceId = accessContext.workspaceId ?? '';
  const date = getQuotaDateKey(options.now);
  const records = readQuotaStore({ ...options, enabled: true });
  const { userLimit, workspaceLimit } = quotaLimitsForAction(action, limits);
  const userUsed = usageFor(records, date, action, 'user', userId);
  if (userUsed >= userLimit) {
    return {
      allowed: false,
      code: 'multiuser_quota_exceeded',
      scope: 'user',
      action,
      limit: userLimit,
      used: userUsed,
      remaining: 0,
    };
  }

  const workspaceUsed = usageFor(records, date, action, 'workspace', workspaceId);
  if (workspaceUsed >= workspaceLimit) {
    return {
      allowed: false,
      code: 'multiuser_quota_exceeded',
      scope: 'workspace',
      action,
      limit: workspaceLimit,
      used: workspaceUsed,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    action,
    limit: Math.min(userLimit, workspaceLimit),
    used: Math.max(userUsed, workspaceUsed),
    remaining: Math.min(userLimit - userUsed, workspaceLimit - workspaceUsed),
  };
}

export function recordMultiuserQuotaUsage(
  accessContext: AccessContext,
  action: QuotaAction,
  options: QuotaStoreOptions = {},
): void {
  if (options.enabled !== true || !isInviteUserAccessContext(accessContext)) return;

  const now = options.now ?? new Date();
  const date = getQuotaDateKey(now);
  const userId = accessContext.userId ?? '';
  const workspaceId = accessContext.workspaceId ?? '';
  const records = readQuotaStore({ ...options, enabled: true });
  const existing = records.find((record) => (
    record.date === date &&
    record.userId === userId &&
    record.workspaceId === workspaceId &&
    record.action === action
  ));
  if (existing) {
    existing.count += 1;
    existing.updatedAt = now.toISOString();
  } else {
    records.push({
      date,
      userId,
      workspaceId,
      action,
      count: 1,
      updatedAt: now.toISOString(),
    });
  }
  writeQuotaStoreAtomic(records, { ...options, now });
}
