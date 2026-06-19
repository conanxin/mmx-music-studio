/**
 * Lightweight invite/session access scaffolding for the five-user pilot path.
 *
 * This module intentionally does not read or write production storage, create
 * invites, or change request routing. It only defines the small access model
 * and helpers that a later route-integration phase can wire in.
 */

import * as crypto from 'node:crypto';

export const MAX_ACTIVE_INVITES = 5;
export const MAX_ACTIVE_SESSIONS = 5;

export const ACCESS_SESSION_COOKIE_NAME = 'mmx_access_session';
export const ACCESS_STORE_DIR = 'storage/access';
export const ACCESS_INVITES_FILE = 'storage/access/invites.json';
export const ACCESS_SESSIONS_FILE = 'storage/access/sessions.json';
export const ACCESS_REVOCATIONS_FILE = 'storage/access/revocations.json';

export type AccessRecordStatus = 'active' | 'revoked' | 'expired' | 'disabled';
export type AccessMode = 'anonymous' | 'invite' | 'operator';
export type RevocationTargetType = 'invite' | 'session' | 'user' | 'workspace';

export interface InviteRecord {
  inviteId: string;
  userId: string;
  workspaceId: string;
  displayName?: string;
  createdAt: string;
  expiresAt: string;
  maxSessions: number;
  status: AccessRecordStatus;
  revokedAt?: string;
}

export interface SessionRecord {
  sessionId: string;
  inviteId: string;
  userId: string;
  workspaceId: string;
  issuedAt: string;
  expiresAt: string;
  status: AccessRecordStatus;
  revokedAt?: string;
  lastSeenAt?: string;
}

export interface RevocationRecord {
  revocationId: string;
  targetType: RevocationTargetType;
  targetId: string;
  revokedAt: string;
  operatorId?: string;
  reason?: string;
}

export interface AccessContext {
  mode: AccessMode;
  isAuthenticated: boolean;
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
  inviteId?: string;
}

export interface SessionCookiePayload {
  sessionId: string;
  userId: string;
  workspaceId: string;
  inviteId: string;
  issuedAt: string;
  expiresAt: string;
}

export type SessionCookieVerifyResult =
  | { ok: true; payload: SessionCookiePayload }
  | {
      ok: false;
      code:
        | 'missing_session'
        | 'malformed_session'
        | 'invalid_session_signature'
        | 'expired_session';
    };

export const ANONYMOUS_ACCESS_CONTEXT: AccessContext = Object.freeze({
  mode: 'anonymous',
  isAuthenticated: false,
});

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

function signValue(value: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function signSessionCookiePayload(payload: SessionCookiePayload, secret: string): string {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySignedSessionCookie(
  token: string | undefined,
  secret: string,
  now = new Date(),
): SessionCookieVerifyResult {
  if (!token) return { ok: false, code: 'missing_session' };

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, code: 'malformed_session' };

  const [encodedPayload, signature] = parts;
  const expectedSignature = signValue(encodedPayload, secret);
  if (!timingSafeEqualHex(signature, expectedSignature)) {
    return { ok: false, code: 'invalid_session_signature' };
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as SessionCookiePayload;
    if (Number.isNaN(Date.parse(payload.expiresAt)) || Date.parse(payload.expiresAt) <= now.getTime()) {
      return { ok: false, code: 'expired_session' };
    }
    if (!payload.sessionId || !payload.userId || !payload.workspaceId || !payload.inviteId) {
      return { ok: false, code: 'malformed_session' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, code: 'malformed_session' };
  }
}

export function buildAccessSessionCookie(token: string, expiresAt: string): string {
  return [
    `${ACCESS_SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Expires=${new Date(expiresAt).toUTCString()}`,
  ].join('; ');
}

export function clearAccessSessionCookie(): string {
  return `${ACCESS_SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function isInviteActive(invite: InviteRecord, now = new Date()): boolean {
  return invite.status === 'active' && Date.parse(invite.expiresAt) > now.getTime();
}

export function isSessionActive(session: SessionRecord, now = new Date()): boolean {
  return session.status === 'active' && Date.parse(session.expiresAt) > now.getTime();
}

export function countActiveInvites(invites: readonly InviteRecord[], now = new Date()): number {
  return invites.filter((invite) => isInviteActive(invite, now)).length;
}

export function countActiveSessions(sessions: readonly SessionRecord[], now = new Date()): number {
  return sessions.filter((session) => isSessionActive(session, now)).length;
}

export function isFiveUserPilotWithinCap(
  invites: readonly InviteRecord[],
  sessions: readonly SessionRecord[],
  now = new Date(),
): boolean {
  return countActiveInvites(invites, now) <= MAX_ACTIVE_INVITES
    && countActiveSessions(sessions, now) <= MAX_ACTIVE_SESSIONS;
}

export function accessContextFromSession(session: SessionRecord): AccessContext {
  return {
    mode: 'invite',
    isAuthenticated: true,
    userId: session.userId,
    workspaceId: session.workspaceId,
    sessionId: session.sessionId,
    inviteId: session.inviteId,
  };
}
