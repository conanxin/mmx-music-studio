/**
 * Public-lite anonymous active-user cap helpers.
 *
 * Tracks only signed anonymous public sessions for a small public-lite mode.
 * This module never stores BYOK keys, Authorization headers, confirmation
 * phrases, provider URLs, prompts, or raw IP/user-agent values.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as http from 'node:http';

export const PUBLIC_LITE_MAX_ACTIVE_USERS = 5;
export const PUBLIC_LITE_SESSION_TTL_MINUTES = 30;
export const PUBLIC_LITE_SESSION_COOKIE_NAME = 'mmx_public_session';
export const PUBLIC_LITE_ACCESS_STORE_DIR = 'storage/access';
export const PUBLIC_LITE_ACTIVE_SESSIONS_FILE = 'storage/access/public-active-sessions.json';

export interface PublicLiteSessionRecord {
  publicSessionId: string;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  userAgentHash?: string;
  ipHash?: string;
}

export interface PublicLiteCookiePayload {
  publicSessionId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface PublicCapacityStatus {
  ok: true;
  mode: 'public_lite';
  maxActiveUsers: number;
  activeUsers: number;
  capacityFull: boolean;
  message: string;
}

export interface PublicLiteCapacityResult {
  status: PublicCapacityStatus;
  setCookie?: string;
}

export interface PublicLiteCapacityOptions {
  enabled: boolean;
  signingSecret?: string;
  storeDir?: string;
  maxActiveUsers?: number;
  ttlMinutes?: number;
  now?: Date;
}

type CookieVerifyResult =
  | { ok: true; payload: PublicLiteCookiePayload }
  | { ok: false; code: 'missing_cookie' | 'malformed_cookie' | 'invalid_signature' | 'expired_cookie' };

const runtimeSigningSecret = crypto.randomBytes(32).toString('hex');

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

function signingSecret(options: PublicLiteCapacityOptions): string {
  return options.signingSecret?.trim() || runtimeSigningSecret;
}

function hmac(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function safePositiveInt(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && typeof value === 'number' && value > 0
    ? Math.floor(value)
    : fallback;
}

function storeFilePath(options: PublicLiteCapacityOptions): string {
  const root = path.resolve(process.cwd(), options.storeDir ?? PUBLIC_LITE_ACCESS_STORE_DIR);
  return path.join(root, 'public-active-sessions.json');
}

function hashOptional(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function getHeaderValue(req: http.IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

function requestFingerprint(req: http.IncomingMessage): {
  userAgentHash?: string;
  ipHash?: string;
} {
  const userAgent = getHeaderValue(req, 'user-agent');
  const forwardedFor = getHeaderValue(req, 'x-forwarded-for')?.split(',')[0]?.trim();
  const remoteAddress = req.socket?.remoteAddress;
  return {
    userAgentHash: hashOptional(userAgent),
    ipHash: hashOptional(forwardedFor || remoteAddress),
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const index = part.indexOf('=');
    if (index <= 0) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});
}

export function signPublicSessionCookiePayload(
  payload: PublicLiteCookiePayload,
  secret: string,
): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${hmac(encodedPayload, secret)}`;
}

export function verifyPublicSessionCookie(
  token: string | undefined,
  secret: string,
  now = new Date(),
): CookieVerifyResult {
  if (!token) return { ok: false, code: 'missing_cookie' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, code: 'malformed_cookie' };
  const [encodedPayload, signature] = parts;
  if (!timingSafeEqualHex(signature, hmac(encodedPayload, secret))) {
    return { ok: false, code: 'invalid_signature' };
  }
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as PublicLiteCookiePayload;
    if (!payload.publicSessionId || !payload.issuedAt || !payload.expiresAt) {
      return { ok: false, code: 'malformed_cookie' };
    }
    if (Date.parse(payload.expiresAt) <= now.getTime()) {
      return { ok: false, code: 'expired_cookie' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, code: 'malformed_cookie' };
  }
}

export function buildPublicSessionCookie(token: string, ttlMinutes: number): string {
  return [
    `${PUBLIC_LITE_SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(60, Math.floor(ttlMinutes * 60))}`,
  ].join('; ');
}

function parseSessionRecord(value: unknown): PublicLiteSessionRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<PublicLiteSessionRecord>;
  if (
    typeof record.publicSessionId !== 'string' ||
    typeof record.issuedAt !== 'string' ||
    typeof record.lastSeenAt !== 'string' ||
    typeof record.expiresAt !== 'string'
  ) {
    return null;
  }
  return {
    publicSessionId: record.publicSessionId,
    issuedAt: record.issuedAt,
    lastSeenAt: record.lastSeenAt,
    expiresAt: record.expiresAt,
    userAgentHash: typeof record.userAgentHash === 'string' ? record.userAgentHash : undefined,
    ipHash: typeof record.ipHash === 'string' ? record.ipHash : undefined,
  };
}

export function readPublicActiveSessionsStore(
  options: PublicLiteCapacityOptions,
): PublicLiteSessionRecord[] {
  const filePath = storeFilePath(options);
  if (!fs.existsSync(filePath)) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((value) => {
    const record = parseSessionRecord(value);
    return record ? [record] : [];
  });
}

export function writePublicActiveSessionsStoreAtomic(
  records: PublicLiteSessionRecord[],
  options: PublicLiteCapacityOptions,
): void {
  const filePath = storeFilePath(options);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tempPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function pruneActiveSessions(
  records: readonly PublicLiteSessionRecord[],
  now: Date,
): PublicLiteSessionRecord[] {
  return records.filter((record) => Date.parse(record.expiresAt) > now.getTime());
}

function publicCapacityStatus(params: {
  maxActiveUsers: number;
  activeUsers: number;
  capacityFull: boolean;
  message: string;
}): PublicCapacityStatus {
  return {
    ok: true,
    mode: 'public_lite',
    maxActiveUsers: params.maxActiveUsers,
    activeUsers: params.activeUsers,
    capacityFull: params.capacityFull,
    message: params.message,
  };
}

export function resolvePublicLiteCapacity(
  req: http.IncomingMessage,
  options: PublicLiteCapacityOptions,
): PublicLiteCapacityResult {
  const maxActiveUsers = safePositiveInt(options.maxActiveUsers, PUBLIC_LITE_MAX_ACTIVE_USERS);
  const ttlMinutes = safePositiveInt(options.ttlMinutes, PUBLIC_LITE_SESSION_TTL_MINUTES);

  if (options.enabled !== true) {
    return {
      status: publicCapacityStatus({
        maxActiveUsers,
        activeUsers: 0,
        capacityFull: false,
        message: 'Available',
      }),
    };
  }

  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();
  const secret = signingSecret(options);

  try {
    const cookies = parseCookies(getHeaderValue(req, 'cookie'));
    const verified = verifyPublicSessionCookie(
      cookies[PUBLIC_LITE_SESSION_COOKIE_NAME],
      secret,
      now,
    );
    const records = pruneActiveSessions(readPublicActiveSessionsStore(options), now);
    const sessionId = verified.ok ? verified.payload.publicSessionId : undefined;
    const existing = sessionId
      ? records.find((record) => record.publicSessionId === sessionId)
      : undefined;

    if (existing) {
      existing.lastSeenAt = now.toISOString();
      existing.expiresAt = expiresAt;
      writePublicActiveSessionsStoreAtomic(records, options);
      const token = signPublicSessionCookiePayload(
        {
          publicSessionId: existing.publicSessionId,
          issuedAt: existing.issuedAt,
          expiresAt,
        },
        secret,
      );
      return {
        status: publicCapacityStatus({
          maxActiveUsers,
          activeUsers: records.length,
          capacityFull: records.length > maxActiveUsers,
          message: records.length > maxActiveUsers
            ? 'The service is temporarily at capacity. Please try again later.'
            : 'Available',
        }),
        setCookie: buildPublicSessionCookie(token, ttlMinutes),
      };
    }

    if (records.length >= maxActiveUsers) {
      writePublicActiveSessionsStoreAtomic(records, options);
      return {
        status: publicCapacityStatus({
          maxActiveUsers,
          activeUsers: records.length,
          capacityFull: true,
          message: 'The service is temporarily at capacity. Please try again later.',
        }),
      };
    }

    const issuedAt = now.toISOString();
    const publicSessionId = `pub_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const record: PublicLiteSessionRecord = {
      publicSessionId,
      issuedAt,
      lastSeenAt: issuedAt,
      expiresAt,
      ...requestFingerprint(req),
    };
    records.push(record);
    writePublicActiveSessionsStoreAtomic(records, options);

    const token = signPublicSessionCookiePayload(
      { publicSessionId, issuedAt, expiresAt },
      secret,
    );
    return {
      status: publicCapacityStatus({
        maxActiveUsers,
        activeUsers: records.length,
        capacityFull: false,
        message: 'Available',
      }),
      setCookie: buildPublicSessionCookie(token, ttlMinutes),
    };
  } catch {
    return {
      status: publicCapacityStatus({
        maxActiveUsers,
        activeUsers: maxActiveUsers,
        capacityFull: true,
        message: 'The service is temporarily at capacity. Please try again later.',
      }),
    };
  }
}
