/**
 * mmx-music-studio API server.
 * Phase 2I: Preview Access Gate (PIN protection).
 *
 * Security guarantees:
 * - REAL_GENERATION_ENABLED=false by default — never calls MiniMax API
 * - Never logs Authorization header
 * - Never logs API key
 * - Never persists keys in manifest
 * - Never exposes server absolute paths
 * - smoke tests always use mock adapter (REAL_GENERATION_ENABLED=false)
 * - Preview Access Gate: PIN never logged, never returned, cookie is HttpOnly
 *
 * Architecture: Standalone Node.js HTTP server. Imports core/adapters via
 * relative paths resolved by tsx. No npm workspace complexity.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  validateMusicInput,
  buildMiniMaxMusicPayload,
  type MusicGenerationInput,
} from './core-wrapper.js';
import {
  ensureOutputDir,
  loadManifest,
  findTrackById,
  getTrackFilePath,
  createTrackRecord,
  appendTrack,
  removeTrack,
  generateTrackId,
  generateFileName,
  formatDuration,
} from './storage.js';
import {
  getSessionApiKey,
  validateKeyLooksReasonable,
  safeContentDisposition,
  redactSecrets,
  buildPreviewAccessConfig,
  verifyPreviewPin,
  generateAccessToken,
  buildPreviewAccessCookie,
  getPreviewAccessToken,
  isPreviewUnlocked,
  PREVIEW_COOKIE_NAME,
  type PreviewAccessConfig,
} from './security.js';
import {
  buildGenerationAccessConfig,
  verifyGenAccessCookie,
  signGenAccessCookie,
  buildGenAccessCookie,
  clearGenAccessCookie,
  getGenAccessCookie,
  isGenerationUnlocked,
  verifyGenerationPin,
  GEN_ACCESS_COOKIE_NAME,
} from './auth.js';
import {
  buildRateLimitConfig,
  buildDailyQuotaConfig,
  checkRateLimit,
  checkDailyQuota,
  getDailyQuotaStatus,
  incrementDailyQuota,
  getClientKey,
} from './rate-limit.js';
import { mockMiniMaxGenerate } from './mock-minimax.js';
import { appendAuditEvent, auditUnlockSuccess, auditUnlockFailed, auditUnlockLocked, auditGenerationBlocked, auditGenerationRequested, auditJobEvent, auditTrackAccess, getAuditStats, listAuditEvents, type AuditEventType } from './audit.js';
import { checkAuthGuard, recordFailedAttempt, recordSuccessfulUnlock, getAuthGuardStats } from './auth-guard.js';
import { generateWithMmxCli, diagnoseMmxCli, runMmx } from './adapters/minimax-cli/index.js';
import { setJobApiKey, getKeyLengthBucket } from './byok-secrets.js';

/**
 * Get a short client hash for auth guard and audit logging.
 * Uses the same getClientKey from rate-limit.ts for consistency.
 */
function getClientHashShort(req: http.IncomingMessage): string {
  return getClientKey(req);
}

function getUserAgent(req: http.IncomingMessage): string {
  return (req.headers['user-agent'] ?? 'unknown').slice(0, 200);
}
import { MmxCliError } from './adapters/minimax-cli/errors.js';
import type { MmxCliDiagnostics } from './adapters/minimax-cli/types.js';
import { callMiniMaxApi } from './call-minimax.js';
import type {
  ServerConfig,
  GenerationSource,
  TrackMetadata,
  GenerateRequest,
  ServerError,
  ServerErrorType,
  BackendMode,
} from './types.js';
import {
  createJob,
  getJob,
  listJobs,
  updateJob,
  cancelJob,
  loadJobs,
  startWorker,
  enqueueAndRun,
  getQueuedCount,
  isWorkerBusy,
  deleteJob,
  retryJob,
  getJobStats,
  getTotalJobCount,
  type GenerateJob,
  type GenerateJobStatus,
  type ListJobsFilters,
} from './jobs.js';

// ── Config ───────────────────────────────────────────────────────────────────

function readBoolEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (value == null || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

type ValidBackend = 'mock' | 'api' | 'cli';

function readBackendEnv(): BackendMode {
  const raw = process.env.MINIMAX_BACKEND;
  if (raw === 'api' || raw === 'cli' || raw === 'mock') return raw;
  return 'mock';
}

function loadConfig(): ServerConfig {
  const publicDemoMode = readBoolEnv('PUBLIC_DEMO_MODE', false);
  const requestedRealGeneration = readBoolEnv('REAL_GENERATION_ENABLED', false);
  const realGenerationEnabled = publicDemoMode ? false : requestedRealGeneration;
  const mockGenerationEnabled = readBoolEnv('MOCK_GENERATION_ENABLED', true);
  const backend = readBackendEnv();

  return {
    port: Number(process.env.PORT || 8787),
    minimaxApiKey: process.env.MINIMAX_API_KEY,
    minimaxRegion: (process.env.MINIMAX_REGION === 'global' ? 'global' : 'cn'),
    outputDir: path.resolve(process.cwd(), process.env.MUSIC_OUTPUT_DIR || './storage/tracks'),
    demoMode: publicDemoMode,
    realGenerationEnabled,
    mockGenerationEnabled,
    backend,
    byokEnabled: readBoolEnv('BYOK_ENABLED', false),
    serverKeyFallback: readBoolEnv('SERVER_KEY_FALLBACK', false),
    byokKeyStorage: 'memory' as const,
    maxRequestBodyMb: Number(process.env.MAX_REQUEST_BODY_MB || 80),
    previewAccess: buildPreviewAccessConfig(),
    generationAccess: buildGenerationAccessConfig(),
    rateLimit: buildRateLimitConfig(),
    dailyQuota: buildDailyQuotaConfig(),
  };
}

// ── Error helpers ─────────────────────────────────────────────────────────────

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(body));
}

function sendError(
  res: http.ServerResponse,
  type: ServerErrorType,
  message: string,
  status = 400,
  hint?: string,
): void {
  const body: ServerError = {
    ok: false,
    error: {
      type,
      message,
      hint,
      requestId: `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    },
  };
  sendJson(res, status, body);
}

function toServerError(err: unknown, requestId: string): ServerError {
  if (err instanceof Error) {
    const e = err as Error & { code?: string; statusCode?: number };
    const code = e.code?.toUpperCase?.() ?? e.code ?? '';

    if (code.includes('VALIDATION') || code === 'validation') {
      return {
        ok: false,
        error: { type: 'validation', message: e.message, requestId },
      };
    }
    if (code.includes('NETWORK') || code === 'network') {
      return {
        ok: false,
        error: {
          type: 'network',
          message: '网络请求失败，请检查网络连接',
          hint: '请检查网络状态或代理设置',
          requestId,
        },
      };
    }
    if (code.includes('HTTP') || code.includes('MINIMAX') || code === 'minimax_api') {
      return {
        ok: false,
        error: {
          type: 'minimax_api',
          message: 'MiniMax 调用失败：参数不兼容',
          hint: '已记录脱敏诊断信息。请使用 /api/debug/payload 预览实际 payload，或检查 MiniMax 官方 schema。',
          requestId,
        },
      };
    }
    if (code.includes('AUDIO') || code === 'audio_download') {
      return {
        ok: false,
        error: { type: 'audio_download', message: e.message, requestId },
      };
    }
    if (code.includes('STORAGE') || code === 'storage') {
      return {
        ok: false,
        error: { type: 'storage', message: e.message, requestId },
      };
    }
  }
  return {
    ok: false,
    error: {
      type: 'unknown',
      message: '服务器内部错误',
      hint: '如持续出现，请检查服务器日志',
      requestId,
    },
  };
}

// ── Static file serving ───────────────────────────────────────────────────────

const distDir = path.resolve(process.cwd(), 'dist');

function tryServeStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (!fs.existsSync(distDir)) return false;
  const urlPath = req.url!.split('?')[0];
  if (urlPath.startsWith('/api/')) return false;

  let filePath: string;
  if (urlPath === '/' || urlPath === '') {
    filePath = path.join(distDir, 'index.html');
  } else {
    filePath = path.join(distDir, urlPath);
  }

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const fallback = path.join(distDir, 'index.html');
    if (fs.existsSync(fallback)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(fallback).pipe(res);
      return true;
    }
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// ── Request body parser ───────────────────────────────────────────────────────

async function parseBody<T>(req: http.IncomingMessage, maxMb: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const limit = maxMb * 1024 * 1024;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T);
      } catch {
        reject(new Error('无效的 JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ── Route handlers ───────────────────────────────────────────────────────────

/**
 * POST /api/debug/payload
 * Preview the payload that would be sent to MiniMax.
 * ONLY available when realGenerationEnabled=false (safe mode).
 * Does NOT call MiniMax. Does NOT read keys.
 */
async function handleDebugPayload(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 'unknown', '只支持 POST', 405);
    return;
  }
  // Guard: only in safe mode
  if (config.realGenerationEnabled) {
    sendError(
      res,
      'guard',
      '此接口仅在安全模式下可用（REAL_GENERATION_ENABLED=false）',
      403,
      '请在安全模式下使用 /api/debug/payload预览 payload',
    );
    return;
  }

  let body: GenerateRequest;
  try {
    body = await parseBody<GenerateRequest>(req, config.maxRequestBodyMb);
  } catch {
    sendError(res, 'unknown', '无效请求体');
    return;
  }

  const { input } = body;
  const requestId = `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  // Validate (safe — no network call)
  const input_casted = input as MusicGenerationInput;
  const validation = validateMusicInput(input_casted);
  if (!validation.ok) {
    sendError(res, 'validation', validation.errors.map((e) => e.message).join('；'), 400);
    return;
  }

  // Build payload (safe — no network call, no key used here)
  const { endpoint, payload, normalizedInput, needsUpload } = buildMiniMaxMusicPayload(input_casted);

  // Sanitize: verify no secrets leak
  const payloadStr = JSON.stringify(payload);
  if (
    payloadStr.includes('Bearer') ||
    payloadStr.includes('sk-') ||
    payloadStr.includes('apiKey') ||
    payloadStr.includes('authorization') ||
    payloadStr.includes('eyJ')
  ) {
    sendError(res, 'security', 'Payload 安全检查失败：检测到敏感字段', 500);
    return;
  }

  sendJson(res, 200, {
    ok: true,
    requestId,
    endpoint,
    payload,
    normalizedInput: {
      mode: normalizedInput.mode,
      prompt: normalizedInput.prompt,
      lyrics: (normalizedInput as {lyrics?: string | null}).lyrics ?? null,
      audioUrl: (normalizedInput as {audioUrl?: string | null}).audioUrl ?? null,
      model: normalizedInput.model,
      outputFormat: normalizedInput.outputFormat,
      audioSettings: normalizedInput.audioSettings,
      region: normalizedInput.region,
      promptLength: normalizedInput.prompt.length,
    },
    needsUpload: needsUpload ?? false,
  });
}

// ── Preview Access Gate ────────────────────────────────────────────────────────

/** GET /api/preview-access/status */
async function handlePreviewAccessStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 'unknown', '只支持 GET', 405);
    return;
  }
  const unlocked = isPreviewUnlocked(
    req.headers as Record<string, string | string[] | undefined>,
    config.previewAccess,
  );
  sendJson(res, 200, {
    ok: true,
    enabled: config.previewAccess.enabled,
    unlocked,
  });
}

/** POST /api/preview-access/unlock */
async function handlePreviewAccessUnlock(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 'unknown', '只支持 POST', 405);
    return;
  }
  if (!config.previewAccess.enabled) {
    sendError(res, 'security', '访问控制未启用', 400);
    return;
  }
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1024) break;
  }
  let pin: string;
  try {
    const parsed = JSON.parse(body);
    pin = parsed?.pin ?? '';
  } catch {
    sendError(res, 'validation', '请求格式错误', 400);
    return;
  }
  if (!verifyPreviewPin(pin, config.previewAccess)) {
    // Use generic message — never reveal which security check failed
    sendError(res, 'security', '访问码不正确', 401);
    return;
  }
  const token = generateAccessToken(config.previewAccess);
  res.setHeader('Set-Cookie', buildPreviewAccessCookie(token));
  sendJson(res, 200, { ok: true, message: '解锁成功' });
}

/** POST /api/preview-access/logout */
async function handlePreviewAccessLogout(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 'unknown', '只支持 POST', 405);
    return;
  }
  res.setHeader('Set-Cookie', `${PREVIEW_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  sendJson(res, 200, { ok: true, message: '已退出访问' });
}

// ── Generation Access Gate handlers (Phase 4C) ───────────────────────────────

async function handleGenAccessStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 'unknown', '只支持 GET', 405);
    return;
  }
  const unlocked = isGenerationUnlocked(req.headers as Record<string, string | string[] | undefined>, config.generationAccess);
  sendJson(res, 200, {
    ok: true,
    enabled: config.generationAccess.enabled,
    unlocked,
  });
}

async function handleGenAccessUnlock(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 'unknown', '只支持 POST', 405);
    return;
  }
  if (!config.generationAccess.enabled) {
    sendError(res, 'security', '生成访问保护未开启', 400);
    return;
  }
  const clientHash = getClientHashShort(req);
  const userAgentHash = getUserAgent(req);
  const route = req.url ?? '/api/generation-access/unlock';

  // Auth guard: check if locked
  const guard = checkAuthGuard(req.socket.remoteAddress ?? 'unknown', getUserAgent(req));
  if (!guard.allowed) {
    auditUnlockLocked('generation', route, clientHash, userAgentHash);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Retry-After', String(Math.ceil((guard.retryAfterMs ?? 900000) / 1000)));
    res.writeHead(429);
    res.end(JSON.stringify({ ok: false, message: guard.reason }));
    return;
  }

  let body: { pin?: string };
  try {
    body = await parseBody<{ pin?: string }>(req, 1);
  } catch {
    sendError(res, 'unknown', '无效请求体');
    return;
  }
  const rawPin = body.pin ?? '';
  const valid = verifyGenerationPin(rawPin, config.generationAccess);
  if (!valid) {
    recordFailedAttempt(req.socket.remoteAddress ?? 'unknown', getUserAgent(req));
    auditUnlockFailed('generation', route, clientHash, userAgentHash);
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, message: '生成访问码不正确' }));
    return;
  }
  recordSuccessfulUnlock(req.socket.remoteAddress ?? 'unknown', getUserAgent(req));
  auditUnlockSuccess('generation', route, clientHash, userAgentHash);
  const token = signGenAccessCookie(config.generationAccess);
  res.setHeader('Set-Cookie', buildGenAccessCookie(token));
  sendJson(res, 200, { ok: true });
}

async function handleGenAccessLogout(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 'unknown', '只支持 POST', 405);
    return;
  }
  res.setHeader('Set-Cookie', clearGenAccessCookie());
  sendJson(res, 200, { ok: true, message: '已退出生成访问' });
}

async function handleHealth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  // Probe CLI availability (non-blocking, safe)
  let cliAvailable = false;
  let cliDiagnostics: MmxCliDiagnostics | null = null;
  try {
    // Only actually probe if mmx might exist (don't block health)
    cliDiagnostics = await Promise.race([
      diagnoseMmxCli(),
      new Promise<MmxCliDiagnostics>((_, reject) =>
        setTimeout(() => reject(new Error('cli probe timeout')), 3000)
      ),
    ]);
    cliAvailable = cliDiagnostics.mmxAvailable;
  } catch {
    cliAvailable = false;
  }

  const safePreviewMode =
    config.realGenerationEnabled === false &&
    config.backend === 'mock' &&
    config.mockGenerationEnabled === true;

  // Job queue status (Phase 4B)
  const queuedJobs = getQueuedCount();
  const workerBusy = isWorkerBusy();

  // Daily quota status (Phase 4C)
  const quotaStatus = getDailyQuotaStatus(config.dailyQuota);

  sendJson(res, 200, {
    ok: true,
    service: 'mmx-music-studio',
    phase: '4C',
    safePreviewMode,
    previewAccessEnabled: config.previewAccess.enabled,
    // Phase 4C: Generation Access
    generationAccessEnabled: config.generationAccess.enabled,
    generationAccessUnlocked: (() => {
      const token = getGenAccessCookie(req.headers as Record<string, string | string[] | undefined>);
      return token ? verifyGenAccessCookie(token, config.generationAccess) : false;
    })(),
    // Phase 4C: Rate Limit
    rateLimitEnabled: config.rateLimit.enabled,
    rateLimitWindowMs: config.rateLimit.windowMs,
    rateLimitMaxRequests: config.rateLimit.maxRequests,
    // Phase 4C: Daily Quota
    dailyQuotaEnabled: config.dailyQuota.enabled,
    dailyGenerationLimit: config.dailyQuota.limit,
    dailyGenerationUsed: quotaStatus.used,
    remainingDailyGenerations: quotaStatus.remaining,
    // Existing fields
    demoMode: config.demoMode,
    realGenerationEnabled: config.realGenerationEnabled,
    mockGenerationEnabled: config.mockGenerationEnabled,
    hasServerKey: !!config.minimaxApiKey,
    region: config.minimaxRegion,
    outputDirReady: fs.existsSync(config.outputDir),
    backend: config.backend,
    availableBackends: ['mock', 'api', 'cli'] as string[],
    // Phase 5A: BYOK
    byokEnabled: config.byokEnabled,
    serverKeyFallback: config.serverKeyFallback,
    byokKeyStorage: config.byokKeyStorage,
    cliRegion: cliDiagnostics?.region ?? undefined,
    // Job queue (Phase 4B)
    jobQueueEnabled: true,
    queuedJobs,
    workerBusy,
    // Audit (Phase 4F)
    auditLogEnabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    authGuardEnabled: process.env.AUTH_GUARD_ENABLED !== 'false',
    authGuard: getAuthGuardStats(),
  });
}

async function handleKeyCheck(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 'unknown', '只支持 POST', 405);
    return;
  }
  let body: { keyMode?: string };
  try {
    body = await parseBody<{ keyMode?: string }>(req, 1);
  } catch {
    sendError(res, 'unknown', '无效请求体');
    return;
  }
  const keyMode = body.keyMode || 'server';
  if (keyMode === 'server') {
    sendJson(res, 200, {
      ok: true,
      available: !!config.minimaxApiKey,
      message: config.minimaxApiKey
        ? '服务端配置可用。真实 Key 将在 REAL_GENERATION_ENABLED=true 时验证。'
        : '服务器环境变量未配置 MINIMAX_API_KEY',
    });
  } else {
    const sessionKey = getSessionApiKey(req.headers as Record<string, string | string[] | undefined>);
    if (sessionKey) {
      const warning = validateKeyLooksReasonable(sessionKey);
      sendJson(res, 200, {
        ok: true,
        available: !warning,
        message: warning ? `本地检查：${warning}` : '本地检查通过，真实 Key 将在 REAL_GENERATION_ENABLED=true 时验证。',
      });
    } else {
      sendJson(res, 200, {
        ok: true,
        available: false,
        message: '未检测到 x-minimax-api-key header',
      });
    }
  }
}

async function handleGenerate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'POST') {
    sendError(res, 'unknown', '只支持 POST', 405);
    return;
  }

  // ── Access guards ────────────────────────────────────────────────────────────

  // 1. Preview Access
  if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
    sendError(res, 'security', '请先解锁访问', 401);
    return;
  }

  // 2. Generation Access
  if (!isGenerationUnlocked(req.headers as Record<string, string | string[] | undefined>, config.generationAccess)) {
    auditGenerationBlocked('access', req.url ?? '/api/generate', getClientHashShort(req), getUserAgent(req));
    sendError(res, 'generation_access_required', '请先输入生成访问码', 401);
    return;
  }

  // 3. Rate Limit
  if (config.rateLimit.enabled) {
    const clientKey = getClientKey(req);
    const rl = checkRateLimit(clientKey, config.rateLimit);
    if (!rl.allowed) {
      auditGenerationBlocked('rate_limit', req.url ?? '/api/generate', getClientHashShort(req), getUserAgent(req));
      sendError(
        res,
        'rate_limit_exceeded',
        '生成请求过于频繁，请稍后再试',
        429,
        `请等待 ${Math.ceil((rl.retryAfterMs ?? 0) / 1000)} 秒`,
      );
      return;
    }
  }

  // 4. Daily Quota
  if (config.dailyQuota.enabled) {
    const dq = checkDailyQuota(config.dailyQuota);
    if (!dq.allowed) {
      auditGenerationBlocked('daily_quota', req.url ?? '/api/generate', getClientHashShort(req), getUserAgent(req));
      sendError(
        res,
        'daily_quota_exceeded',
        '今日生成额度已用完',
        429,
        `今日已生成 ${dq.used} 首，请明天再试`,
      );
      return;
    }
  }

  let body: GenerateRequest;
  try {
    body = await parseBody<GenerateRequest>(req, config.maxRequestBodyMb);
  } catch {
    sendError(res, 'unknown', '无效请求体');
    return;
  }
  const { input, region } = body;

  // ── Input validation ─────────────────────────────────────────────────────────
  const validation = validateMusicInput(input as Parameters<typeof validateMusicInput>[0]);
  if (!validation.ok) {
    sendError(res, 'validation', validation.errors.map((e) => e.message).join('；'), 400);
    return;
  }

  // ── Sync mode: legacy synchronous generation (internal debug only) ──────────
  if (req.url?.includes('?sync=true')) {
    // Only runs when REAL_GENERATION_ENABLED=true (real generation path)
    if (!config.realGenerationEnabled) {
      sendError(res, 'guard', '同步模式仅在 REAL_GENERATION_ENABLED=true 时可用', 403);
      return;
    }
    // Delegate to the inline sync handler
    await handleGenerateSync(req, res, config);
    return;
  }

  // ── Async job mode (default) ─────────────────────────────────────────────────
  const backend: BackendMode = config.backend;

  // Determine effective backend: mock if realGenerationEnabled=false
  const effectiveBackend: BackendMode =
    !config.realGenerationEnabled ? 'mock' : backend;

  // ── BYOK key mode resolution ─────────────────────────────────────────────────
  // IMPORTANT: keyMode is server-controlled, never client-controlled.
  // Client must NOT be able to choose 'server' to bypass BYOK restrictions.
  const sessionApiKey = getSessionApiKey(req.headers as Record<string, string | string[] | undefined>);
  let effectiveKeyMode: 'server' | 'session' = 'server';
  let pendingByokApiKey: string | undefined;

  if (effectiveBackend === 'api' && config.byokEnabled) {
    // BYOK API mode: require user-supplied key, never use server key as fallback
    if (sessionApiKey) {
      // Validate format locally — do NOT call MiniMax in this check
      const keyWarning = validateKeyLooksReasonable(sessionApiKey);
      if (keyWarning) {
        sendError(res, 'validation', keyWarning, 400);
        return;
      }
      effectiveKeyMode = 'session';
      pendingByokApiKey = sessionApiKey;
    } else if (config.serverKeyFallback && config.minimaxApiKey) {
      // Fallback only if explicitly enabled and server key is available
      effectiveKeyMode = 'server';
    } else {
      // No session key, fallback disabled or no server key → reject
      sendError(res, 'missing_api_key', '请先在设置页填写你的 MiniMax Token Plan Key', 400);
      return;
    }
  } else if (effectiveBackend === 'cli') {
    // CLI mode always uses server-side mmx auth
    effectiveKeyMode = 'server';
  } else {
    // mock or non-BYOK api: no session key needed
    effectiveKeyMode = 'server';
  }

  // Create job with server-controlled keyMode (client cannot override)
  const job = createJob(input as MusicGenerationInput, effectiveBackend, undefined, effectiveKeyMode);

  // Store BYOK key in memory-only Map AFTER job creation (needs job.id)
  // This key is NEVER written to disk, logs, or audit
  if (effectiveKeyMode === 'session' && pendingByokApiKey) {
    try {
      setJobApiKey(job.id, pendingByokApiKey);
    } catch {
      // Defensive: if storing fails, delete the orphaned job to avoid key-less worker run
      // (the finally block in executeApiJob also cleans up on failure)
      cancelJob(job.id);
      sendError(res, 'storage', '会话密钥存储失败，请重试', 500);
      return;
    }
  }

  console.log(`[server] job created: id=${job.id} mode=${input.mode} backend=${effectiveBackend} keyMode=${effectiveKeyMode}`);

  sendJson(res, 202, {
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      progressMessage: job.progressMessage,
      createdAt: job.createdAt,
    },
  });

  // Audit: log BYOK metadata without exposing the key
  auditGenerationRequested(req.url ?? '/api/generate', getClientHashShort(req), getUserAgent(req), {
    mode: input.mode,
    jobId: job.id,
    byok: effectiveKeyMode === 'session',
    keyPresent: Boolean(pendingByokApiKey),
    keyLengthBucket: pendingByokApiKey ? getKeyLengthBucket(pendingByokApiKey) : undefined,
  });

  // Enqueue and run in background — worker will retrieve BYOK key from byok-secrets
  enqueueAndRun(effectiveKeyMode, undefined, region as 'cn' | 'global' | undefined);
}

async function handleGenerateSync(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  // Called only when REAL_GENERATION_ENABLED=true && ?sync=true
  let body: GenerateRequest;
  try {
    body = await parseBody<GenerateRequest>(req, config.maxRequestBodyMb);
  } catch {
    sendError(res, 'unknown', '无效请求体');
    return;
  }
  const { input, keyMode, region } = body;
  const requestId = `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const backend = config.backend;

  const validation = validateMusicInput(input as Parameters<typeof validateMusicInput>[0]);
  if (!validation.ok) {
    sendError(res, 'validation', validation.errors.map((e) => e.message).join('；'), 400);
    return;
  }

  if (backend === 'cli') {
    const id = generateTrackId();
    const audioFileName = `${id}.mp3`;
    let cliResult: Awaited<ReturnType<typeof generateWithMmxCli>>;
    try {
      cliResult = await generateWithMmxCli(input as MusicGenerationInput, {
        outputDir: config.outputDir,
        audioFileName,
        timeoutMs: 240_000,
        audioUrl: input.audioUrl,
        audioFile: undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const hint = msg.includes('AUTH') || msg.includes('login') || msg.includes('invalid')
        ? 'CLI 认证异常。请在服务器终端运行 mmx auth login 修复。'
        : 'CLI 生成失败，请检查 mmx 版本和服务器日志。';
      console.error(`[server] CLI generation error:`, msg.slice(0, 300));
      sendError(res, 'generation', `MMX CLI 生成失败：${msg.slice(0, 200)}`, 500, hint);
      return;
    }
    let audioBuffer: Buffer;
    try {
      audioBuffer = fs.readFileSync(cliResult.audioFilePath);
    } catch {
      sendError(res, 'storage', 'CLI 生成成功但无法读取输出文件', 500);
      return;
    }
    const track = createTrackRecord({
      id,
      title: (input.prompt || 'CLI 音乐').slice(0, 80),
      mode: input.mode,
      model: 'music-2.6',
      prompt: input.prompt || '',
      lyrics: input.lyrics,
      audioFileName,
      audioMimeType: cliResult.audioMimeType,
      audioFormat: cliResult.audioFormat,
      durationMs: undefined,
      durationText: undefined,
      sampleRate: undefined,
      bitrate: undefined,
      sizeBytes: cliResult.sizeBytes,
      traceId: undefined,
      generationSource: 'mmx-cli',
    });
    try {
      appendTrack(config.outputDir, track);
    } catch { /* non-fatal */ }
    console.log(`[server] mmx-cli sync: id=${id} title="${track.title}" mode=${input.mode} generationSource=mmx-cli`);
    sendJson(res, 200, { ok: true, track: toTrackResponse(track), generationSource: 'mmx-cli' });
    return;
  }

  let apiKey: string | undefined;
  if (keyMode === 'server') {
    apiKey = config.minimaxApiKey;
  } else {
    apiKey = getSessionApiKey(req.headers as Record<string, string | string[] | undefined>);
  }
  if (!apiKey) {
    sendError(res, 'missing_api_key', '请先在设置中填写 Key，或在服务器 .env 配置 MINIMAX_API_KEY', 400);
    return;
  }

  const payload = buildMiniMaxMusicPayload(input as Parameters<typeof buildMiniMaxMusicPayload>[0]);
  let apiResult: Awaited<ReturnType<typeof callMiniMaxApi>>;
  try {
    apiResult = await callMiniMaxApi({ apiKey, region: region || config.minimaxRegion, payload });
  } catch (err) {
    const se = toServerError(err, requestId);
    console.error(`[server] MiniMax API error [${requestId}]:`, redactSecrets((err as Error).message));
    sendJson(res, 500, se);
    return;
  }

  let audioBuffer: Buffer;
  if (apiResult.audioKind === 'url' && apiResult.audioValue) {
    try {
      const response = await fetch(apiResult.audioValue);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const ab = await response.arrayBuffer();
      audioBuffer = Buffer.from(ab);
    } catch (err) {
      sendError(res, 'audio_download', `音频下载失败：${(err as Error).message}`, 500);
      return;
    }
  } else if (apiResult.audioKind === 'hex') {
    audioBuffer = Buffer.from(apiResult.audioValue.replace(/\s+/g, ''), 'hex');
  } else {
    sendError(res, 'minimax_api', 'MiniMax 返回的音频格式无法处理', 500);
    return;
  }

  try {
    ensureOutputDir(config.outputDir);
  } catch {
    sendError(res, 'storage', '无法创建存储目录', 500);
    return;
  }

  const fileName = generateFileName({ mode: input.mode, title: (input.prompt || 'untitled').slice(0, 40) });
  const filePath = getTrackFilePath(config.outputDir, fileName);
  try {
    fs.writeFileSync(filePath, audioBuffer);
  } catch {
    sendError(res, 'storage', '无法写入音频文件', 500);
    return;
  }

  const id = generateTrackId();
  const track = createTrackRecord({
    id,
    title: (input.prompt || '未命名').slice(0, 80),
    mode: input.mode,
    model: (input as Record<string, unknown>).model as string || 'music-2.6',
    prompt: input.prompt || '',
    lyrics: input.lyrics,
    audioFileName: fileName,
    audioMimeType: 'audio/mpeg',
    audioFormat: 'mp3',
    durationMs: apiResult.durationMs,
    durationText: apiResult.durationMs ? formatDuration(apiResult.durationMs) : undefined,
    sampleRate: apiResult.sampleRate,
    bitrate: apiResult.bitrate,
    sizeBytes: apiResult.sizeBytes || audioBuffer.length,
    traceId: apiResult.traceId,
    generationSource: 'minimax',
  });
  try {
    appendTrack(config.outputDir, track);
  } catch { /* non-fatal */ }
  console.log(`[server] minimax sync: id=${id} title="${track.title}" mode=${input.mode} generationSource=minimax`);
  sendJson(res, 200, { ok: true, track: toTrackResponse(track), generationSource: 'minimax' });
}

async function handleListTracks(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 'unknown', '只支持 GET', 405);
    return;
  }
  try {
    const manifest = loadManifest(config.outputDir);
    sendJson(res, 200, {
      ok: true,
      tracks: manifest.tracks.map((t) => toTrackResponse(t)),
      total: manifest.tracks.length,
    });
  } catch {
    sendError(res, 'storage', '无法读取作品列表', 500);
  }
}

async function handleGetTrack(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 'unknown', '只支持 GET', 405);
    return;
  }
  const match = req.url!.match(/^\/api\/tracks\/([^/]+)$/);
  if (!match) return;
  const track = findTrackById(config.outputDir, match[1]);
  if (!track) {
    sendError(res, 'storage', '作品不存在', 404);
    return;
  }
  sendJson(res, 200, { ok: true, track: toTrackResponse(track) });
}

async function handleTrackAudio(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  const match = req.url!.match(/^\/api\/tracks\/([^/]+)\/audio$/);
  if (!match) return;
  const track = findTrackById(config.outputDir, match[1]);
  if (!track) { res.writeHead(404); res.end('Not found'); return; }
  const filePath = getTrackFilePath(config.outputDir, track.audioFileName);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('File not found'); return; }
  const stat = fs.statSync(filePath);
  const range = req.headers['range'];
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = Number(parts[0]);
    const end = parts[1] ? Number(parts[1]) : stat.size - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Type': track.audioMimeType || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type': track.audioMimeType || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size,
      'Cache-Control': 'private, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

async function handleTrackDownload(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  const match = req.url!.match(/^\/api\/tracks\/([^/]+)\/download$/);
  if (!match) return;
  const track = findTrackById(config.outputDir, match[1]);
  if (!track) { res.writeHead(404); res.end('Not found'); return; }
  const filePath = getTrackFilePath(config.outputDir, track.audioFileName);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('File not found'); return; }
  const safeName = track.title.replace(/[^\w\u4e00-\u9fff\-_. ]/g, '_') + `.${track.audioFormat || 'mp3'}`;
  try {
    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Type': track.audioMimeType || 'audio/mpeg',
      'Content-Disposition': safeContentDisposition(safeName),
      'Content-Length': stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(`[server] download stream error:`, (err as Error).message);
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: { type: 'download', message: (err as Error).message } }));
    }
  }
}

async function handleDeleteTrack(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'DELETE') {
    sendError(res, 'unknown', '只支持 DELETE', 405);
    return;
  }
  const match = req.url!.match(/^\/api\/tracks\/([^/]+)$/);
  if (!match) return;
  const id = match[1];
  const track = findTrackById(config.outputDir, id);
  if (!track) {
    sendError(res, 'storage', '作品不存在', 404);
    return;
  }

  // Delete audio file
  const filePath = getTrackFilePath(config.outputDir, track.audioFileName);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      sendError(res, 'storage', '无法删除音频文件', 500);
      return;
    }
  }

  // Remove from manifest
  try {
    removeTrack(config.outputDir, id);
  } catch {
    sendError(res, 'storage', '无法更新作品列表', 500);
    return;
  }

  console.log(`[server] track deleted: id=${id} title="${track.title}"`);
  sendJson(res, 200, { ok: true, deleted: true, id });
}

// ── Job queue handlers ───────────────────────────────────────────────────────

async function handleListJobs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _config: ServerConfig,
): Promise<void> {
  // Phase 4D: support query params
  const url = new URL(req.url!, 'http://localhost');
  const status = url.searchParams.get('status') as GenerateJobStatus | null;
  const search = url.searchParams.get('search') || undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined;
  const offset = url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined;
  const rawSort = url.searchParams.get('sort') || 'newest';
  // Normalise sort values to what listJobs() expects: 'createdAt_desc' | 'createdAt_asc'
  const sort = rawSort === 'oldest' ? 'createdAt_asc'
    : rawSort === 'newest' || rawSort === 'createdAt_desc' ? 'createdAt_desc'
    : 'createdAt_desc';

  const filters: ListJobsFilters = {};
  if (status) filters.status = status;
  if (search) filters.search = search;
  if (limit) filters.limit = limit;
  if (offset) filters.offset = offset;
  if (sort) filters.sort = sort;

  const result = listJobs(filters);
  const total = getTotalJobCount();
  sendJson(res, 200, { ok: true, jobs: result, total });
}

async function handleGetJob(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _config: ServerConfig,
): Promise<void> {
  const match = req.url!.match(/^\/api\/jobs\/([^/]+)$/);
  if (!match) { sendError(res, 'validation', '无效的 job ID', 400); return; }
  const job = getJob(match[1]);
  if (!job) { sendError(res, 'unknown', 'Job 不存在', 404); return; }
  sendJson(res, 200, { ok: true, job });
}

async function handleCancelJob(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _config: ServerConfig,
): Promise<void> {
  const match = req.url!.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
  if (!match) { sendError(res, 'validation', '无效的 job ID', 400); return; }
  const jobId = match[1];
  const cancelled = cancelJob(jobId);
  if (!cancelled) {
    sendError(res, 'unknown', 'Job 不存在或无法取消', 404);
    return;
  }
  auditJobEvent('cancelled', `/api/jobs/${jobId}/cancel`, getClientHashShort(req), getUserAgent(req), { jobId });
  sendJson(res, 200, { ok: true, jobId, cancelled: true });
}

async function handleDeleteJob(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _config: ServerConfig,
): Promise<void> {
  const match = req.url!.match(/^\/api\/jobs\/([^/]+)$/);
  if (!match) { sendError(res, 'validation', '无效的 job ID', 400); return; }
  const jobId = match[1];
  const ok = deleteJob(jobId);
  if (!ok) {
    sendError(res, 'validation', '任务不存在或当前状态不能删除', 400);
    return;
  }
  auditJobEvent('deleted', `/api/jobs/${jobId}`, getClientHashShort(req), getUserAgent(req), { jobId });
  sendJson(res, 200, { ok: true, deleted: true, jobId });
}

async function handleRetryJob(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  const match = req.url!.match(/^\/api\/jobs\/([^/]+)\/retry$/);
  if (!match) { sendError(res, 'validation', '无效的 job ID', 400); return; }
  const jobId = match[1];
  const newJob = retryJob(jobId, config);
  if (!newJob) {
    sendError(res, 'validation', '该任务不能重试', 400);
    return;
  }
  auditJobEvent('retried', `/api/jobs/${jobId}/retry`, getClientHashShort(req), getUserAgent(req), { jobId, newJobId: newJob.id });
  sendJson(res, 200, { ok: true, job: newJob, message: '任务已重新提交' });
}

async function handleJobStats(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _config: ServerConfig,
): Promise<void> {
  const stats = getJobStats();
  sendJson(res, 200, { ok: true, stats });
}

async function handleAuditStats(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _config: ServerConfig,
): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 'unknown', '只支持 GET', 405);
    return;
  }
  const stats = getAuditStats();
  const guardStats = getAuthGuardStats();
  sendJson(res, 200, {
    ok: true,
    stats,
    authGuard: guardStats,
  });
}

async function handleAuditEvents(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  _config: ServerConfig,
): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 'unknown', '只支持 GET', 405);
    return;
  }
  const url = new URL(req.url!, 'http://localhost');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
  const offset = Number(url.searchParams.get('offset') ?? '0');
  const type = url.searchParams.get('type') ?? undefined;
  const { events, total } = listAuditEvents({ type: type as AuditEventType | undefined, limit, offset });
  sendJson(res, 200, { ok: true, events, total, limit, offset });
}

// ── Shared track response mapper ───────────────────────────────────────────────

function toTrackResponse(t: TrackMetadata): Record<string, unknown> {
  return {
    id: t.id,
    title: t.title,
    mode: t.mode,
    model: t.model,
    prompt: t.prompt,
    lyrics: t.lyrics,
    status: t.status,
    audioUrl: `/api/tracks/${t.id}/audio`,
    downloadUrl: `/api/tracks/${t.id}/download`,
    durationText: t.durationText,
    durationMs: t.durationMs,
    generationSource: t.generationSource,
    audioMimeType: t.audioMimeType,
    audioFormat: t.audioFormat,
    createdAt: t.createdAt,
  };
}

// ── CORS ─────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

function setCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-minimax-api-key');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
}

// ── Router ────────────────────────────────────────────────────────────────────

async function routeHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCorsHeaders(req, res);

  const url = req.url!.split('?')[0];
  if (tryServeStatic(req, res)) return;

  if (url === '/api/health') {
    await handleHealth(req, res, config);
  } else if (url === '/api/key/check') {
    await handleKeyCheck(req, res, config);
  } else if (url === '/api/preview-access/status') {
    await handlePreviewAccessStatus(req, res, config);
  } else if (url === '/api/preview-access/unlock') {
    await handlePreviewAccessUnlock(req, res, config);
  } else if (url === '/api/preview-access/logout') {
    await handlePreviewAccessLogout(req, res, config);
  } else if (url === '/api/generation-access/status') {
    await handleGenAccessStatus(req, res, config);
  } else if (url === '/api/generation-access/unlock') {
    await handleGenAccessUnlock(req, res, config);
  } else if (url === '/api/generation-access/logout') {
    await handleGenAccessLogout(req, res, config);
  } else if (url === '/api/generate') {
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleGenerate(req, res, config);
  } else if (url === '/api/tracks' && req.method === 'GET') {
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleListTracks(req, res, config);
  } else if (url.match(/^\/api\/tracks\/([^/]+)\/audio$/)) {
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleTrackAudio(req, res, config);
  } else if (url.match(/^\/api\/tracks\/([^/]+)\/download$/)) {
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleTrackDownload(req, res, config);
  } else if (url.match(/^\/api\/tracks\/([^/]+)$/) && req.method === 'GET') {
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleGetTrack(req, res, config);
  } else if (url.match(/^\/api\/tracks\/([^/]+)$/) && req.method === 'DELETE') {
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleDeleteTrack(req, res, config);
  } else if (url === '/api/debug/payload' && req.method === 'POST') {
    await handleDebugPayload(req, res, config);
  } else if (url === '/api/debug/cli' && req.method === 'GET') {
    await handleDebugCli(req, res, config);
  } else if (url === '/api/jobs/stats' && req.method === 'GET') {
    await handleJobStats(req, res, config);
  } else if (url.match(/^\/api\/jobs\/([^/]+)\/retry$/) && req.method === 'POST') {
    await handleRetryJob(req, res, config);
  } else if (url.match(/^\/api\/jobs\/([^/]+)\/cancel$/) && req.method === 'POST') {
    await handleCancelJob(req, res, config);
  } else if (url.match(/^\/api\/jobs\/([^/]+)$/) && req.method === 'DELETE') {
    await handleDeleteJob(req, res, config);
  } else if (url.match(/^\/api\/jobs\/([^/]+)$/) && req.method === 'GET') {
    await handleGetJob(req, res, config);
  } else if (url === '/api/jobs' && req.method === 'GET') {
    await handleListJobs(req, res, config);
  } else if (url === '/api/audit/stats' && req.method === 'GET') {
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleAuditStats(req, res, config);
  } else if (url === '/api/audit/events' && req.method === 'GET') {
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleAuditEvents(req, res, config);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, code: 'not_found', message: '未找到对应接口' }));
  }
}

// ── CLI diagnostics endpoint ─────────────────────────────────────────────────

interface CliCommandResult {
  ok: boolean
  exitCode: number
  outputPreview: string
}

interface DebugCliResponse {
  ok: boolean
  mmxAvailable: boolean
  commands: {
    version: CliCommandResult
    authStatus: CliCommandResult
    configShow: CliCommandResult
    quota: CliCommandResult
    musicGenerateHelp: CliCommandResult
    musicCoverHelp: CliCommandResult
  }
  cliReadyForGeneration: boolean
  reason: string
}

async function handleDebugCli(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  if (req.method !== 'GET') {
    sendError(res, 'unknown', '只支持 GET', 405);
    return;
  }
  if (config.realGenerationEnabled) {
    sendError(res, 'guard', '此接口仅在安全模式下可用（REAL_GENERATION_ENABLED=false）', 403);
    return;
  }

  // Run all diagnostic commands individually — each failure is captured, none kills the endpoint
  async function diagCmd(
    label: string,
    args: string[],
    timeoutMs = 15_000,
  ): Promise<CliCommandResult> {
    try {
      const r = await runMmx(args, timeoutMs);
      return {
        ok: r.code === 0,
        exitCode: r.code,
        outputPreview: (r.stdout || r.stderr || '').slice(0, 500),
      };
    } catch (err) {
      return { ok: false, exitCode: -1, outputPreview: (err as Error).message.slice(0, 200) };
    }
  }

  const [version, authStatus, configShow, quota, musicGenerateHelp, musicCoverHelp] = await Promise.all([
    diagCmd('version', ['--version'], 10_000),
    diagCmd('authStatus', ['auth', 'status'], 10_000),
    diagCmd('configShow', ['config', 'show'], 10_000),
    diagCmd('quota', ['quota'], 10_000),
    diagCmd('musicGenerateHelp', ['music', 'generate', '--help'], 15_000),
    diagCmd('musicCoverHelp', ['music', 'cover', '--help'], 15_000),
  ]);

  const mmxAvailable = version.exitCode !== -1;
  const authProblems = ['error', 'invalid', 'fail', 'not'].some(
    (kw) => authStatus.outputPreview.toLowerCase().includes(kw) || configShow.outputPreview.toLowerCase().includes(kw),
  );
  const cliReady = mmxAvailable && !authProblems && quota.ok;

  const response: DebugCliResponse = {
    ok: true,
    mmxAvailable,
    commands: { version, authStatus, configShow, quota, musicGenerateHelp, musicCoverHelp },
    cliReadyForGeneration: cliReady,
    reason: cliReady ? 'ready' : 'auth/config needs repair on server',
  };

  sendJson(res, 200, response);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const config = loadConfig();
  try {
    ensureOutputDir(config.outputDir);
  } catch (e) {
    console.warn('[server] 无法创建存储目录:', (e as Error).message);
  }

  console.log(`=== mmx-music-studio server config ===`);
  console.log(`  port: ${config.port}`);
  console.log(`  previewAccessEnabled: ${config.previewAccess.enabled}`);
  console.log(`  backend: ${config.backend}`);
  console.log(`  realGenerationEnabled: ${config.realGenerationEnabled}`);
  console.log(`  mockGenerationEnabled: ${config.mockGenerationEnabled}`);
  console.log(`  hasServerKey: ${!!config.minimaxApiKey}`);
  console.log(`  outputDir: ${config.outputDir}`);
  console.log(`  jobQueue: enabled (concurrency=1)`);
  console.log(`======================================`);

  // Load persisted jobs and start background worker
  loadJobs();
  startWorker(config);

  const server = http.createServer(async (req, res) => {
    try {
      await routeHandler(req, res, config);
    } catch (err) {
      const requestId = `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      console.error(`[server] uncaught [${requestId}]:`, redactSecrets((err as Error).message));
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ok: false,
          error: {
            type: 'unknown',
            message: '服务器内部错误',
            hint: '如持续出现，请检查服务器日志',
            requestId,
          },
        }));
      }
    }
  });

  // Security default: only listen on localhost when behind a reverse proxy.
  // Set HOST=0.0.0.0 to restore old behavior if needed.
  const host = process.env.HOST || '127.0.0.1';

  server.listen(config.port, host, () => {
    console.log(`[server] mmx-music-studio API 运行于 http://${host}:${config.port}`);
  });

  process.on('SIGTERM', () => { server.close(); process.exit(0); });
}

main();
