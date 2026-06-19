/**
 * Lightweight invite/session access scaffolding for the five-user pilot path.
 *
 * This module intentionally does not read or write production storage, create
 * invites, or change request routing. It only defines the small access model
 * and helpers that a later route-integration phase can wire in.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as http from 'node:http';

export const MAX_ACTIVE_INVITES = 5;
export const MAX_ACTIVE_SESSIONS = 5;

export const ACCESS_SESSION_COOKIE_NAME = 'mmx_access_session';
export const ACCESS_STORE_DIR = 'storage/access';
export const ACCESS_INVITES_FILE = 'storage/access/invites.json';
export const ACCESS_SESSIONS_FILE = 'storage/access/sessions.json';
export const ACCESS_REVOCATIONS_FILE = 'storage/access/revocations.json';

export type AccessRecordStatus = 'active' | 'revoked' | 'expired' | 'disabled';
export type AccessMode = 'anonymous' | 'invite_user' | 'operator';
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
  reason?: string;
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

export interface AccessStoreReadOptions {
  storeDir?: string;
}

export interface ResolveAccessContextOptions extends AccessStoreReadOptions {
  enabled: boolean;
  sessionSecret?: string;
  defaultWorkspaceId?: string;
  now?: Date;
}

export interface FiveUserAccessStoreValidationResult {
  ok: boolean;
  activeInvites: number;
  activeSessions: number;
  code?: 'active_invite_cap_exceeded' | 'active_session_cap_exceeded';
}

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

function accessStorePath(fileName: 'invites.json' | 'sessions.json' | 'revocations.json', options: AccessStoreReadOptions = {}): string {
  const storeDir = options.storeDir
    ? path.resolve(options.storeDir)
    : path.resolve(process.cwd(), ACCESS_STORE_DIR);
  return path.join(storeDir, fileName);
}

function readJsonArray<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function getCookieValue(req: http.IncomingMessage, cookieName: string): string | undefined {
  const rawCookieHeader = req.headers.cookie;
  const cookieHeader = Array.isArray(rawCookieHeader) ? rawCookieHeader.join('; ') : rawCookieHeader;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = part.trim().split('=');
    if (rawName === cookieName) return rawValueParts.join('=');
  }
  return undefined;
}

function anonymousContext(defaultWorkspaceId: string, reason: string): AccessContext {
  return {
    ...ANONYMOUS_ACCESS_CONTEXT,
    workspaceId: defaultWorkspaceId,
    reason,
  };
}

function isRevoked(
  revocations: readonly RevocationRecord[],
  targetType: RevocationTargetType,
  targetId: string | undefined,
): boolean {
  if (!targetId) return false;
  return revocations.some((revocation) =>
    revocation.targetType === targetType && revocation.targetId === targetId,
  );
}

export function readInvitesStore(options: AccessStoreReadOptions = {}): InviteRecord[] {
  return readJsonArray<InviteRecord>(accessStorePath('invites.json', options));
}

export function readSessionsStore(options: AccessStoreReadOptions = {}): SessionRecord[] {
  return readJsonArray<SessionRecord>(accessStorePath('sessions.json', options));
}

export function readRevocationsStore(options: AccessStoreReadOptions = {}): RevocationRecord[] {
  return readJsonArray<RevocationRecord>(accessStorePath('revocations.json', options));
}

export function validateFiveUserAccessStores(
  invites: readonly InviteRecord[],
  sessions: readonly SessionRecord[],
  now = new Date(),
): FiveUserAccessStoreValidationResult {
  const activeInvites = countActiveInvites(invites, now);
  const activeSessions = countActiveSessions(sessions, now);
  if (activeInvites > MAX_ACTIVE_INVITES) {
    return { ok: false, activeInvites, activeSessions, code: 'active_invite_cap_exceeded' };
  }
  if (activeSessions > MAX_ACTIVE_SESSIONS) {
    return { ok: false, activeInvites, activeSessions, code: 'active_session_cap_exceeded' };
  }
  return { ok: true, activeInvites, activeSessions };
}

export function accessContextFromSession(session: SessionRecord): AccessContext {
  return {
    mode: 'invite_user',
    isAuthenticated: true,
    userId: session.userId,
    workspaceId: session.workspaceId,
    sessionId: session.sessionId,
    inviteId: session.inviteId,
  };
}

export function resolveAccessContextFromRequest(
  req: http.IncomingMessage,
  options: ResolveAccessContextOptions,
): AccessContext {
  const now = options.now ?? new Date();
  const defaultWorkspaceId = options.defaultWorkspaceId ?? 'default';

  if (!options.enabled) {
    return anonymousContext(defaultWorkspaceId, 'multiuser_access_disabled');
  }
  if (!options.sessionSecret) {
    return anonymousContext(defaultWorkspaceId, 'missing_session_secret');
  }

  const token = getCookieValue(req, ACCESS_SESSION_COOKIE_NAME);
  const verification = verifySignedSessionCookie(token, options.sessionSecret, now);
  if (!verification.ok) {
    return anonymousContext(defaultWorkspaceId, verification.code);
  }

  const invites = readInvitesStore(options);
  const sessions = readSessionsStore(options);
  const revocations = readRevocationsStore(options);
  const capValidation = validateFiveUserAccessStores(invites, sessions, now);
  if (!capValidation.ok) {
    return anonymousContext(defaultWorkspaceId, capValidation.code ?? 'five_user_cap_exceeded');
  }

  const payload = verification.payload;
  const session = sessions.find((candidate) =>
    candidate.sessionId === payload.sessionId
    && candidate.userId === payload.userId
    && candidate.workspaceId === payload.workspaceId
    && candidate.inviteId === payload.inviteId,
  );
  if (!session || !isSessionActive(session, now)) {
    return anonymousContext(defaultWorkspaceId, 'session_not_active');
  }

  const invite = invites.find((candidate) =>
    candidate.inviteId === payload.inviteId
    && candidate.userId === payload.userId
    && candidate.workspaceId === payload.workspaceId,
  );
  if (!invite || !isInviteActive(invite, now)) {
    return anonymousContext(defaultWorkspaceId, 'invite_not_active');
  }

  if (
    isRevoked(revocations, 'session', session.sessionId)
    || isRevoked(revocations, 'invite', invite.inviteId)
    || isRevoked(revocations, 'user', session.userId)
    || isRevoked(revocations, 'workspace', session.workspaceId)
  ) {
    return anonymousContext(defaultWorkspaceId, 'access_revoked');
  }

  return accessContextFromSession(session);
}
