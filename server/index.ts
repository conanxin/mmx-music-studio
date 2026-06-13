/**
 * mmx-music-studio API serve
  // Phase BYOK-A: separate kill switch for the PUBLIC BYOK relay
  // endpoint /api/generate/byok. Distinct from BYOK_ENABLED (admin internal).
  // Default false.
  publicByokEnabled: readBoolEnv('PUBLIC_BYOK_ENABLED', false),
 byokDryRunOnly: readBoolEnv('BYOK_DRY_RUN_ONLY', true),
 byokLiveEnabled: readBoolEnv('BYOK_LIVE_ENABLED', false),
 byokLiveConfirmation: (process.env.BYOK_LIVE_CONFIRMATION ?? '').trim(),
}

/**
 * mmx-music-studio API server.
 * Phase 2I: Preview Access Gate (PIN protection). Preview Access Gate (PIN protection).
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
  buildRealApiAttemptConfig,
  checkRateLimit,
  resetRateLimitStore,
  checkDailyQuota,
  getDailyQuotaStatus,
  incrementDailyQuota,
  resetDailyQuota,
  checkRealApiAttemptLimit,
  getRealApiAttemptStats,
  getClientKey,
} from './rate-limit.js';
import { mockMiniMaxGenerate } from './mock-minimax.js';
import { appendAuditEvent, auditUnlockSuccess, auditUnlockFailed, auditUnlockLocked, auditGenerationBlocked, auditGenerationRequested, auditJobEvent, auditTrackAccess, getAuditStats, listAuditEvents, type AuditEventType } from './audit.js';
import { checkAuthGuard, recordFailedAttempt, recordSuccessfulUnlock, getAuthGuardStats } from './auth-guard.js';
import {
  buildLaunchGuardConfig,
  checkLaunchGuard,
  getSourceGuardStatus,
  resetGuardState,
  isGuardBlocked,
  type LaunchGuardConfig,
} from './launch-guard.js';
import { buildRuntimeStatusSummary } from './runtime-status.js';
import { generateWithMmxCli, diagnoseMmxCli, runMmx } from './adapters/minimax-cli/index.js';
import { setJobApiKey, getKeyLengthBucket } from './byok-secrets.js';
// Phase BYOK-A: redaction helper for the public BYOK relay endpoint.
// Used to ensure no API key, Authorization header, or Bearer literal
// ever reaches logs, audit records, error responses, or generated
// track metadata. See docs/security/BYOK_PUBLIC_GENERATION_DESIGN.md.
import {
  redactObject,
  redactSensitive,
  validateApiKeyShape,
} from './security/redaction.js';
import {
  generateByokMusic,
  isLiveGateOpen,
  isConfirmedByokLiveProviderPath,
  BYOK_LIVE_CONFIRMATION_PHRASE,
  buildByokLiveAttemptConfig,
  getByokLiveAttemptStats,
  checkByokLiveAttemptLimit,
  consumeByokLiveAttempt,
  isByokLiveConfirmationConfigured,
  // Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP
  buildByokLiveAudioCapConfig,
  getByokLiveAudioCapStats,
  checkByokLiveAudioCap,
  recordByokLiveAudioGenerated,
  recordByokSubmit,
  getByokSubmitObservability,
  type ByokSubmitStage,
  type ByokSubmitOutcome,
  type ByokModel,
} from './adapters/minimax-api/byok.js';
import {
  generateByokDirectMusic,
  type ByokDirectRequestOptions,
} from './adapters/minimax-api/byok-direct.js';

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
    // Phase BYOK-A: separate kill switch for the PUBLIC BYOK relay
    // endpoint /api/generate/byok. Distinct from BYOK_ENABLED (admin internal).
    // Default false.
    publicByokEnabled: readBoolEnv('PUBLIC_BYOK_ENABLED', false),
    byokDryRunOnly: readBoolEnv('BYOK_DRY_RUN_ONLY', true),
    byokLiveEnabled: readBoolEnv('BYOK_LIVE_ENABLED', false),
    byokLiveConfirmation: (process.env.BYOK_LIVE_CONFIRMATION ?? '').trim(),
    // Phase BYOK-F: Direct HTTPS API relay live gate
    // Default false — requires explicit operator confirmation
    byokDirectLiveEnabled: readBoolEnv('BYOK_DIRECT_LIVE_ENABLED', false),
    byokDirectLiveConfirmation: (process.env.BYOK_DIRECT_LIVE_CONFIRMATION ?? '').trim(),
    // Phase Deploy-CF-D: Turnstile protection for BYOK generation
    turnstileByokRequired: readBoolEnv('TURNSTILE_BYOK_REQUIRED', false),
    turnstileSecretKeyConfigured: !!(process.env.TURNSTILE_SECRET_KEY ?? '').trim(),
    turnstileSiteKey: (process.env.TURNSTILE_SITE_KEY ?? '').trim() || undefined,
    maxRequestBodyMb: Number(process.env.MAX_REQUEST_BODY_MB || 80),
    previewAccess: buildPreviewAccessConfig(),
    generationAccess: buildGenerationAccessConfig(),
    rateLimit: buildRateLimitConfig(),
    dailyQuota: buildDailyQuotaConfig(),
    launchGuard: buildLaunchGuardConfig(),
    realApiAttempt: buildRealApiAttemptConfig(),
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

async function handleStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  /**
   * Public-safe runtime status endpoint.
   * Exposes job queue aggregate, storage aggregate, launch guard summary.
   * Does NOT expose: raw IP, sourceHash, token, API key, prompt, raw logs.
   */
  const summary = buildRuntimeStatusSummary({
    backend: config.backend,
    realGenerationEnabled: config.realGenerationEnabled,
    mockGenerationEnabled: config.mockGenerationEnabled,
    launchGuardConfig: config.launchGuard,
    outputDir: config.outputDir,
  });

  sendJson(res, 200, {
    ok: true,
    service: 'mmx-music-studio',
    timestamp: summary.service.timestamp,
    runtimeStatus: {
      backend: summary.backend,
      launchGuard: summary.launchGuard,
      jobQueue: summary.jobQueue,
      storage: summary.storage,
    },
  });
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

  // Phase 5B-C: Real API Attempt Guard
  const attemptStats = getRealApiAttemptStats(config.realApiAttempt);

  // Phase BYOK-H3B-CODE-FOLLOWUP: live attempt guard (in-memory).
  const liveAttemptStats = getByokLiveAttemptStats(
    buildByokLiveAttemptConfig(),
  );
  // Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP: live audio cap (in-memory).
  const liveAudioCapStats = getByokLiveAudioCapStats(
    buildByokLiveAudioCapConfig(),
  );

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
    // Phase 5B-C: Real API Attempt Guard
    realApiAttemptLimitEnabled: config.realApiAttempt.enabled,
    realApiDailyAttemptLimit: config.realApiAttempt.dailyLimit,
    realApiAttemptsUsed: attemptStats.attempts,
    remainingRealApiAttempts: attemptStats.remaining,
    // Phase Launch Guard-A: Public generation guardrails
    launchGuardEnabled: config.launchGuard.enabled,
    publicGenerationEnabled: config.launchGuard.publicGenerationEnabled,
    perSourceDailyLimit: config.launchGuard.perSourceDailyLimit,
    generationCooldownSeconds: config.launchGuard.cooldownSeconds,
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
    // Phase H1: public BYOK kill-switch (mirrors PUBLIC_BYOK_ENABLED env var).
    // Boolean only — never carries secrets, tokens, or keys.
    publicByokEnabled: config.publicByokEnabled,
    serverKeyFallback: config.serverKeyFallback,
    byokKeyStorage: config.byokKeyStorage,
    // Phase BYOK-H3B-CODE-FOLLOWUP: live gate runtime introspection.
    // All fields are non-sensitive booleans/numbers/ids; never the
    // confirmation phrase value, never the user key, never the token.
    byokLiveEnabled: config.byokLiveEnabled,
    byokLiveConfirmationConfigured: isByokLiveConfirmationConfigured({
      byokLiveConfirmation: config.byokLiveConfirmation,
    }),
    byokLiveAttemptLimitEnabled: liveAttemptStats.enabled,
    byokLiveMaxAttemptsPerWindow: liveAttemptStats.maxAttempts,
    byokLiveAttemptsUsed: liveAttemptStats.attemptsUsed,
    byokLiveAttemptsRemaining: liveAttemptStats.remaining,
    // Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP: live audio cap (in-memory,
    // non-persistent). Booleans/numbers/window-id only; never the
    // confirmation phrase, never the user key, never the prompt, never
    // the lyrics, never the raw provider response.
    byokLiveAudioCapEnabled: liveAudioCapStats.enabled,
    byokLiveMaxAudioPerWindow: liveAudioCapStats.maxAudio,
    byokLiveAudioUsed: liveAudioCapStats.audioUsed,
    byokLiveAudioRemaining: liveAudioCapStats.remaining,
    // Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP: submit observability counters.
    // In-memory only; never persisted. Booleans/enums/ISO timestamp only —
    // NEVER include apiKey, token, prompt, lyrics, or Authorization.
    ...(() => {
      const so = getByokSubmitObservability();
      return {
        byokSubmitsReceived: so.submitsReceived,
        byokLastSubmitAt: so.lastSubmitAt,
        byokLastSubmitStage: so.lastSubmitStage,
        byokLastSubmitOutcome: so.lastSubmitOutcome,
        byokLastSubmitRequestId: so.lastSubmitRequestId,
        byokLastSubmitModeCandidate: so.lastSubmitModeCandidate,
        byokLastSubmitTurnstilePresent: so.lastSubmitTurnstilePresent,
        byokLastSubmitApiKeyPresent: so.lastSubmitApiKeyPresent,
        byokLastSubmitPromptPresent: so.lastSubmitPromptPresent,
      };
    })(),
    // Phase Deploy-CF-D: Turnstile (boolean only, never secret value)
    turnstileByokRequired: config.turnstileByokRequired,
    turnstileSecretKeyConfigured: config.turnstileSecretKeyConfigured,
    turnstileSiteKeyConfigured: !!config.turnstileSiteKey,
    // Phase Deploy-CF-E: Frontend widget runtime integration.
    // Site key is a PUBLIC key (designed to be exposed in HTML/JS). It is NOT
    // the secret. The secret (TURNSTILE_SECRET_KEY) is NEVER returned here.
    // If site key is not configured, this field is undefined.
    turnstileSiteKey: config.turnstileSiteKey,
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

  // ── Phase Launch Guard-A: Public generation guardrails ────────────────────
  // 5. Global pause + per-source daily limit + per-source cooldown
  if (config.launchGuard.enabled) {
    const guard = checkLaunchGuard(req, config.launchGuard);
    if (isGuardBlocked(guard)) {
      auditGenerationBlocked('launch_guard', req.url ?? '/api/generate', getClientHashShort(req), getUserAgent(req));
      if (guard.code === 'public_generation_paused') {
        sendError(res, guard.code, guard.message, 503);
      } else if (guard.code === 'per_source_daily_limit_exceeded') {
        sendError(res, guard.code, guard.message, 429, `每天最多生成 ${guard.limit} 首`);
      } else if (guard.code === 'generation_cooldown_active') {
        sendError(res, guard.code, guard.message, 429, `请等待 ${guard.retryAfterSeconds} 秒`);
      }
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

  // Attach full track object for succeeded jobs (Studio player handoff)
  const jobsWithTracks = result.map(job => {
    const enriched = { ...job };
    if (job.trackId) {
      const track = findTrackById(_config.outputDir, job.trackId);
      if (track) {
        (enriched as Record<string, unknown>).track = toTrackResponse(track);
      }
    }
    return enriched;
  });

  sendJson(res, 200, { ok: true, jobs: jobsWithTracks, total });
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

  // Attach full track object if job has trackId (Studio player handoff)
  const jobWithTrack = { ...job };
  if (job.trackId) {
    const track = findTrackById(_config.outputDir, job.trackId);
    if (track) {
      (jobWithTrack as Record<string, unknown>).track = toTrackResponse(track);
    }
  }

  sendJson(res, 200, { ok: true, job: jobWithTrack });
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

  const debugResetEndpointsEnabled = process.env.DEBUG_RESET_ENDPOINTS === 'true';

  if (url === '/api/health') {
    await handleHealth(req, res, config);
  } else if (url === '/api/status') {
    await handleStatus(req, res, config);
  } else if (url === '/api/debug/reset-rate-limit') {
    if (!debugResetEndpointsEnabled) {
      res.writeHead(404).end();
      return;
    }
    resetRateLimitStore();
    res.writeHead(204).end();
  } else if (url === '/api/debug/reset-daily-quota') {
    if (!debugResetEndpointsEnabled) {
      res.writeHead(404).end();
      return;
    }
    resetDailyQuota();
    res.writeHead(204).end();
  } else if (url === '/api/debug/reset-guard') {
    if (!debugResetEndpointsEnabled) {
      res.writeHead(404).end();
      return;
    }
    resetGuardState();
    res.writeHead(204).end();
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
  } else if (url === '/api/generate/byok' && req.method === 'POST') {
    // Phase BYOK-A: public BYOK relay endpoint. Default disabled.
    if (!isPreviewUnlocked(req.headers as Record<string, string | string[] | undefined>, config.previewAccess)) {
      sendError(res, 'security', '请先解锁访问', 401);
      return;
    }
    await handleByokGenerate(req, res, config);
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

/**
 * POST /api/generate/byok
 *
 * Phase BYOK-A: Public BYOK generation readiness.
 *
 * Behavior:
 * 1. If PUBLIC_BYOK_ENABLED !== "true" → return 403 byok_generation_disabled
 * 2. Validate apiKey (required, min length, shape) — NEVER logged
 * 3. Validate prompt / lyrics / model via existing validateMusicInput
 * 4. Reuse Launch Guard (cooldown + daily per-source limit)
 * 5. Returns dry-run response byok_dry_run_only — NO real provider call
 *
 * Security:
 * - apiKey is held in memory only, never written to disk
 * - apiKey is never included in track metadata
 * - apiKey is never logged (redactObject is used in any error path)
 * - apiKey is never returned to the client
 */
// ── BYOK submit observability safe helpers (Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP-HOTFIX) ──
// These wrap the most common "length / presence" probes so a missing
// header or undefined body field never raises a runtime TypeError.
// NEVER echo the underlying value — only its length / presence.
function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function safeStringLength(value: unknown): number {
  return typeof value === 'string' ? value.length : 0;
}
function safeHeaderString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
  return typeof value === 'string' ? value : '';
}

interface ByokGenerateRequest {
  apiKey?: string;
  input?: unknown;
  region?: 'cn' | 'global';
  /** Phase Deploy-CF-D: Turnstile token for abuse control */
  turnstileToken?: string;
}

interface ByokDryRunResponse {
  ok: true;
  dryRun: true;
  code: 'byok_dry_run_only';
  message: string;
  receivedKeyLengthBucket: 'tiny' | 'short' | 'normal' | 'long' | 'absurd';
  requestId: string;
  // Intentionally NO apiKey, NO Authorization, NO raw provider error.
}

async function handleByokGenerate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ServerConfig,
): Promise<void> {
  // 0. Observability: log that a submit hit the server BEFORE any early
  //    returns. Distinguishes "browser never reached server" from
  //    "server received and blocked at gate X". NEVER logs the apiKey,
  //    token, prompt, lyrics, or Authorization header.
  const submitRequestId = `byok_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const submitModeCandidate: 'live' | 'fake' | 'unknown' =
    config.byokLiveEnabled === true && config.byokDryRunOnly === false
      ? 'live'
      : 'fake';
  // We do not have a parsed body yet. Log only booleans we can derive
  // from the Content-Type / content-length headers. Use safeHeaderString
  // so an undefined / string[] header never throws.
  const submitTurnstilePresent =
    safeHeaderString(req.headers['x-turnstile-token']).length > 0;
  console.log(
    `[byok-submit-received] requestId=${submitRequestId} liveGateCandidate=${submitModeCandidate} turnstilePresent=${submitTurnstilePresent} apiKeyPresent=pending promptPresent=pending`,
  );
  // Provisional record (apiKey/prompt will be updated after body parse).
  recordByokSubmit({
    requestId: submitRequestId,
    stage: 'received',
    outcome: 'allowed',
    modeCandidate: submitModeCandidate,
    turnstilePresent: submitTurnstilePresent,
    apiKeyPresent: false,
    promptPresent: false,
  });

  // 1. Kill switch: PUBLIC_BYOK_ENABLED must be true
  if (config.publicByokEnabled !== true) {
    recordByokSubmit({
      requestId: submitRequestId,
      stage: 'killswitch_off',
      outcome: 'blocked_killswitch_off',
      modeCandidate: submitModeCandidate,
      turnstilePresent: submitTurnstilePresent,
      apiKeyPresent: false,
      promptPresent: false,
    });
    sendJson(res, 403, {
      ok: false,
      code: 'byok_generation_disabled',
      message: '公开 BYOK 生成暂未开放',
      hint: '等待后续 phase 显式开启',
    });
    return;
  }

  // 2. Parse body
  let body: ByokGenerateRequest;
  try {
    body = await parseBody<ByokGenerateRequest>(req, config.maxRequestBodyMb);
  } catch {
    recordByokSubmit({
      requestId: submitRequestId,
      stage: 'body_parse_failed',
      outcome: 'blocked_body_parse',
      modeCandidate: submitModeCandidate,
      turnstilePresent: submitTurnstilePresent,
      apiKeyPresent: false,
      promptPresent: false,
    });
    sendError(res, 'unknown', '无效请求体');
    return;
  }

  // Update provisional record with body-derived booleans (NEVER value).
  // Note: prompt/lyrics travel under `body.input` (untyped), so we only
  // check apiKey presence here. Prompt presence detection requires a
  // schema-specific probe; for the observability follow-up we record
  // apiKey present (the sensitive field) and leave prompt to log-pending.
  // Use safeStringLength so body.apiKey = undefined does not throw.
  const submitApiKeyPresent = safeStringLength(body.apiKey) > 0;
  console.log(
    `[byok-submit-received] requestId=${submitRequestId} liveGateCandidate=${submitModeCandidate} turnstilePresent=${submitTurnstilePresent} apiKeyPresent=${submitApiKeyPresent} promptPresent=pending (post-parse)`,
  );

  const requestId = submitRequestId;

  // Phase Deploy-CF-D: Turnstile gate (before any live/direct path)
  if (config.turnstileByokRequired === true) {
    const turnstileToken = body.turnstileToken;
    if (!turnstileToken || typeof turnstileToken !== 'string') {
      recordByokSubmit({
        requestId: submitRequestId,
        stage: 'turnstile_missing',
        outcome: 'blocked_turnstile',
        modeCandidate: submitModeCandidate,
        turnstilePresent: false,
        apiKeyPresent: submitApiKeyPresent,
        promptPresent: false,
      });
      sendJson(res, 403, {
        ok: false,
        code: 'turnstile_required',
        message: '需要 Turnstile 验证',
        hint: '请完成人机验证后重试',
      });
      return;
    }
    const { verifyTurnstileToken } = await import('./security/turnstile.js');
    const remoteIp =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      (req.socket.remoteAddress ?? undefined);
    const turnstileResult = await verifyTurnstileToken({
      token: turnstileToken,
      secret: process.env.TURNSTILE_SECRET_KEY ?? '',
      remoteIp,
      expectedAction: 'byok-generate',
      requestId,
    });
    if (!turnstileResult.ok) {
      const errorCode = turnstileResult.errorCode ?? 'turnstile_verification_error';
      // Phase H1-Hotfix-C: redacted diagnostics — no token, no secret, no apiKey
      if (turnstileResult.redacted) {
        const r = turnstileResult.redacted;
        console.warn(
          `[byok-turnstile-debug] requestId=${r.requestId} tokenLength=${r.tokenLength} ` +
          `tokenSha256_8=${r.tokenSha256_8} cloudflareSuccess=${r.cloudflareSuccess} ` +
          `cloudflareErrorCodes=[${r.cloudflareErrorCodes.join(',')}] ` +
          `hostname=${r.hostname ?? 'missing'} action=${r.action ?? 'missing'} ` +
          `cdata=${r.cdata ?? 'missing'} outcome=${errorCode}`,
        );
      } else {
        console.warn(`[byok] turnstile verification failed [${requestId}]:`, turnstileResult.details);
      }
      recordByokSubmit({
        requestId: submitRequestId,
        stage: 'turnstile_failed',
        outcome: 'blocked_turnstile',
        modeCandidate: submitModeCandidate,
        turnstilePresent: true,
        apiKeyPresent: submitApiKeyPresent,
        promptPresent: false,
      });
      sendJson(res, 403, {
        ok: false,
        code: errorCode,
        message:
          errorCode === 'turnstile_invalid'
            ? 'Turnstile 验证失败，请重试'
            : 'Turnstile 验证服务异常',
        hint: '请刷新页面后重新完成人机验证',
        requestId,
      });
      return;
    }
    // Phase BYOK-H2B: success-path redacted observability.
    // Same redaction policy as the failure path: no token, no secret, no user apiKey.
    // Only emitted when the runtime has TURNSTILE_DEBUG_REDACTED=true AND the
    // verifyTurnstileToken() result included a populated `redacted` block.
    // Operator opens the flag during H2C dry-run pilot, closes it after.
    if (turnstileResult.redacted) {
      const r = turnstileResult.redacted;
      console.log(
        `[byok-turnstile-ok] requestId=${r.requestId} tokenLength=${r.tokenLength} ` +
        `tokenSha256_8=${r.tokenSha256_8} cloudflareSuccess=${r.cloudflareSuccess} ` +
        `cloudflareErrorCodes=[${r.cloudflareErrorCodes.join(',')}] ` +
        `hostname=${r.hostname ?? 'missing'} action=${r.action ?? 'missing'} ` +
        `cdata=${r.cdata ?? 'missing'} outcome=turnstile_ok`,
      );
    }
  }

  // 3. Validate apiKey — never log the key itself
  const keyShape = validateApiKeyShape(body.apiKey);
  if (!keyShape.ok) {
    // Redact any key-like field in error path before logging
    console.warn(
      `[byok] invalid apiKey [${requestId}]:`,
      redactSensitive(keyShape.reason ?? 'unknown'),
    );
    sendError(res, 'validation', 'API Key 格式无效', 400);
    return;
  }

  // 4. Validate prompt / lyrics / model — reuse existing validator
  const validation = validateMusicInput(
    body.input as Parameters<typeof validateMusicInput>[0],
  );
  if (!validation.ok) {
    sendError(
      res,
      'validation',
      validation.errors.map((e) => e.message).join('；'),
      400,
    );
    return;
  }

 // 5. Launch Guard — cooldown + daily per-source limit.
 //    Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP: confirmed BYOK live requests
 //    skip the launch guard (which is the public/source audio cap). They
 //    are bounded by the BYOK-live audio cap below instead. The skip is
 //    deliberately recorded as `audio_quota_bypassed_for_byok_live` so it
 //    is observable and auditable, not silent.
 const requestedModeForGuard = (
   body as { mode?: 'fake' | 'live' | 'direct-live' } | undefined
 )?.mode ?? 'fake';
 const isConfirmedByokLivePath =
   (requestedModeForGuard === 'direct-live' || requestedModeForGuard === 'live') &&
   config.byokLiveEnabled === true &&
   isByokLiveConfirmationConfigured({ byokLiveConfirmation: config.byokLiveConfirmation }) &&
   config.byokDryRunOnly === false;
 if (isConfirmedByokLivePath) {
   recordByokSubmit({
     requestId: submitRequestId,
     stage: 'audio_quota_bypassed_for_byok_live',
     outcome: 'bypassed_audio_quota_for_byok_live',
     modeCandidate: submitModeCandidate,
     turnstilePresent: true,
     apiKeyPresent: submitApiKeyPresent,
     promptPresent: true,
   });
 } else {
   const guard = checkLaunchGuard(req, config.launchGuard);
   if (!guard.allowed) {
    // guard has a discriminated union: code+message+retryAfterSeconds|resetsAt
    const retryAfter = Math.max(
      1,
      Math.ceil(
        ('retryAfterSeconds' in guard && guard.retryAfterSeconds
          ? guard.retryAfterSeconds
          : 15),
      ),
    );
    recordByokSubmit({
      requestId: submitRequestId,
      stage: 'audio_quota_rejected',
      outcome: 'blocked_audio_quota',
      modeCandidate: submitModeCandidate,
      turnstilePresent: true,
      apiKeyPresent: submitApiKeyPresent,
      promptPresent: true,
    });
    auditGenerationBlocked('launch_guard', '/api/generate/byok', getClientHashShort(req), getUserAgent(req));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Retry-After', String(retryAfter));
    res.writeHead(429);
    res.end(
      JSON.stringify({
        ok: false,
        code: guard.code,
        message: guard.message,
        requestId,
      }),
    );
    return;
  }
  } // end else: launch guard applies to non-BYOK-live path

  // 6. Phase BYOK-B mode machine.
 // 6a. dry-run: PUBLIC_BYOK_ENABLED=true && BYOK_DRY_RUN_ONLY=true.
 if (config.byokDryRunOnly !== false) {
   const dryRun: ByokDryRunResponse = {
     ok: true,
     dryRun: true,
     code: 'byok_dry_run_only',
     message: 'BYOK 接通验证成功。当前为 dry-run，未触发真实 provider 调用。',
     receivedKeyLengthBucket: keyShape.bucket ?? 'normal',
     requestId,
   };
   sendJson(res, 200, dryRun);
   return;
 }

 // 6b. live gate check: requires BYOK_LIVE_ENABLED && confirmation phrase.
 if (config.byokLiveEnabled !== true) {
   sendJson(res, 403, {
     ok: false,
     code: 'byok_live_not_enabled',
     message: '真实 BYOK 生成尚未启用',
     hint: '需要 BYOK_LIVE_ENABLED=true 才会触发 live relay',
   });
   return;
 }
if (config.byokLiveConfirmation !== BYOK_LIVE_CONFIRMATION_PHRASE) {
  console.warn(
    `[byok] live confirmation mismatch [${requestId}]: expected exact phrase, got length ${config.byokLiveConfirmation.length}`,
  );
  recordByokSubmit({
    requestId: submitRequestId,
    stage: 'live_confirmation_mismatch',
    outcome: 'blocked_live_confirmation_mismatch',
    modeCandidate: 'live',
    turnstilePresent: true,
    apiKeyPresent: submitApiKeyPresent,
    promptPresent: true,
  });
  sendJson(res, 403, {
    ok: false,
    code: 'byok_live_confirmation_required',
    message: '真实 BYOK 生成需要显式确认',
    hint: `需要 BYOK_LIVE_CONFIRMATION=${BYOK_LIVE_CONFIRMATION_PHRASE}`,
  });
  return;
}

// Phase BYOK-H3B-CODE-FOLLOWUP: server-side one-shot guard.
// Check first (read-only) so a blocked attempt does NOT consume a slot.
const liveAttemptConfig = buildByokLiveAttemptConfig();
const liveAttemptCheck = checkByokLiveAttemptLimit(liveAttemptConfig);
if (!liveAttemptCheck.allowed) {
  console.warn(
    `[byok] live attempt limit reached [${requestId}]: window=${liveAttemptCheck.stats.windowId} used=${liveAttemptCheck.stats.attemptsUsed}/${liveAttemptCheck.stats.maxAttempts}`,
  );
  recordByokSubmit({
    requestId: submitRequestId,
    stage: 'live_attempt_blocked',
    outcome: 'blocked_live_attempt_limit',
    modeCandidate: 'live',
    turnstilePresent: true,
    apiKeyPresent: submitApiKeyPresent,
    promptPresent: true,
  });
  sendJson(res, 403, {
    ok: false,
    code: 'byok_live_attempt_limit_reached',
    message: '受控 live 测试窗口已达到提交次数上限',
    hint: `需要轮换 BYOK_LIVE_WINDOW_ID 或提高 BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW`,
  });
  return;
}

// Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP: live audio cap check (read-only).
// Runs AFTER the live-attempt guard so a blocked attempt does not
// consume a slot. Only successful generations record() against the cap.
const liveAudioCapConfig = buildByokLiveAudioCapConfig();
const liveAudioCapCheck = checkByokLiveAudioCap(liveAudioCapConfig);
if (!liveAudioCapCheck.allowed) {
  console.warn(
    `[byok] live audio cap reached [${requestId}]: window=${liveAudioCapCheck.stats.windowId} used=${liveAudioCapCheck.stats.audioUsed}/${liveAudioCapCheck.stats.maxAudio}`,
  );
  recordByokSubmit({
    requestId: submitRequestId,
    stage: 'byok_live_audio_cap_reached',
    outcome: 'blocked_live_audio_cap',
    modeCandidate: 'live',
    turnstilePresent: true,
    apiKeyPresent: submitApiKeyPresent,
    promptPresent: true,
  });
  sendJson(res, 429, {
    ok: false,
    code: 'byok_live_audio_cap_reached',
    message: '受控 live 测试窗口已达到音频生成上限',
    hint: `需要轮换 BYOK_LIVE_WINDOW_ID 或提高 BYOK_LIVE_MAX_AUDIO_PER_WINDOW`,
  });
  return;
}

// Consume the live-attempt slot now that the request has cleared the
// attempt and audio-cap checks. Subsequent gates (provider error etc.)
// still count as an attempt used — this matches the one-shot semantic
// the operator approved in BYOK-H3B-CODE-FOLLOWUP.
const liveAttemptConsumedStats = consumeByokLiveAttempt(liveAttemptConfig);
recordByokSubmit({
  requestId: submitRequestId,
  stage: 'live_attempt_consumed',
  outcome: 'live_attempt_consumed',
  modeCandidate: 'live',
  turnstilePresent: true,
  apiKeyPresent: submitApiKeyPresent,
  promptPresent: true,
});
console.info(
  `[byok] live attempt consumed [${requestId}]: window=${liveAttemptConsumedStats.windowId} used=${liveAttemptConsumedStats.attemptsUsed}/${liveAttemptConsumedStats.maxAttempts}`,
);

 // 6c. Decide adapter mode: 'fake' | 'live' (CLI — DISABLED) | 'direct-live' (BYOK-F)
 // Default to 'fake' for any caller that does not explicitly pass a live mode.
 const requestedMode = (body as { mode?: 'fake' | 'live' | 'direct-live' } | undefined)?.mode ?? 'fake';
 const liveAllowed = isLiveGateOpen({
   publicByokEnabled: config.publicByokEnabled,
   byokDryRunOnly: config.byokDryRunOnly,
   byokLiveEnabled: config.byokLiveEnabled,
   byokLiveConfirmation: config.byokLiveConfirmation,
 });

 // body.input is `unknown`; narrow with a local alias.
 const byokInput = (body.input ?? {}) as {
   prompt?: string;
   lyrics?: string;
   model?: string;
   mode?: 'instrumental' | 'lyrics' | 'auto';
 };

 // ── BYOK-F: Direct HTTPS API relay path ──
 if (requestedMode === 'direct-live') {
   // 6f. Direct live gate check
   if (config.byokDirectLiveEnabled !== true) {
     sendJson(res, 403, {
       ok: false,
       code: 'byok_direct_live_not_enabled',
       message: 'BYOK direct live 尚未启用',
       hint: '需要 BYOK_DIRECT_LIVE_ENABLED=true',
     });
     return;
   }
   if (config.byokDirectLiveConfirmation !== 'CONFIRM_BYOK_DIRECT_LIVE_TEST') {
     console.warn(
       `[byok] direct live confirmation mismatch [${requestId}]: expected exact phrase, got length ${config.byokDirectLiveConfirmation.length}`,
     );
     sendJson(res, 403, {
       ok: false,
       code: 'byok_direct_live_confirmation_required',
       message: 'BYOK direct live 需要显式确认',
       hint: `需要 BYOK_DIRECT_LIVE_CONFIRMATION=CONFIRM_BYOK_DIRECT_LIVE_TEST`,
     });
     return;
   }

   // Direct live gates passed — call the HTTPS adapter
   const directResult = await generateByokDirectMusic({
     apiKey: body.apiKey ?? '',
     prompt: byokInput.prompt ?? '',
     lyrics: byokInput.lyrics,
     model: (byokInput.model as 'music-2.6' | 'music-2.5+' | 'music-2.5' | 'music-cover') ?? 'music-2.6',
     outputFormat: 'url',
     isInstrumental: byokInput.mode === 'instrumental',
     timeoutMs: 120_000,
   });

   if (!directResult.ok) {
     sendJson(res, 502, {
       ok: false,
       code: directResult.code,
       message: redactSensitive(directResult.message),
       requestId,
     });
     return;
   }

  // Success — return normalized direct result.
  // Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP: record successful audio
  // generation against the BYOK-live audio cap.
  recordByokLiveAudioGenerated(liveAudioCapConfig);
  sendJson(res, 200, {
    ok: true,
    code: 'byok_direct_live_ok',
    message: 'BYOK direct API 测试通过',
    audioUrl: directResult.audioUrl,
    taskId: directResult.taskId,
    model: directResult.model,
    meta: directResult.meta,
     requestId,
   });
   return;
 }

 // ── BYOK-B/C: CLI-based paths (fake / live) ──
 // Phase BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP: provider selection must
 // use the explicit confirmed-live condition, not just the request's
 // `mode` string. The previous code only switched to 'live' when
 // requestedMode === 'live' && liveAllowed; this missed 'direct-live'
 // requests (which earlier were short-circuited to the direct-live
 // branch and never returned here) and any request that satisfied
 // every gate condition but did not name 'live' explicitly.
 //
 // The new code builds a single boolean from isConfirmedByokLiveProviderPath
 // and forwards the env snapshot to the adapter so it can re-verify.
 const byokLiveWindowIdForProvider = (process.env.BYOK_LIVE_WINDOW_ID ?? '').trim();
 const liveProviderEnvForAdapter = {
   publicByokEnabled: config.publicByokEnabled,
   byokDryRunOnly: config.byokDryRunOnly,
   byokLiveEnabled: config.byokLiveEnabled,
   byokLiveConfirmation: config.byokLiveConfirmation,
   byokLiveWindowId: byokLiveWindowIdForProvider,
   byokDirectLiveEnabled: config.byokDirectLiveEnabled,
   byokDirectLiveConfirmation: config.byokDirectLiveConfirmation,
 };
 // The user key is required to confirm the live path (the live provider
 // must use a per-request apiKey, never an operator key).
 const userApiKeyForLive = body.apiKey ?? '';
 const isConfirmedLiveProviderPath =
   isConfirmedByokLiveProviderPath(liveProviderEnvForAdapter, userApiKeyForLive);

 // 'live' is selected when:
 //   1) The request explicitly asked for live OR direct-live, AND
 //   2) The live gate is open (via isLiveGateOpen, which is the
 //      pre-existing legacy check), AND
 //   3) The new provider-selection check confirms every condition.
 // Otherwise the request is 'fake' (default safe path).
 const liveCandidateRequested = requestedMode === 'live';
 const adapterMode: 'fake' | 'live' =
   liveCandidateRequested && liveAllowed && isConfirmedLiveProviderPath
     ? 'live'
     : 'fake';

 const adapterResult = await generateByokMusic({
   apiKey: body.apiKey ?? '',
   prompt: byokInput.prompt ?? '',
   lyrics: byokInput.lyrics,
   model: (byokInput.model as ByokModel) ?? 'music-2.6-free',
   mode: adapterMode,
   requestId,
   musicMode: byokInput.mode ?? 'auto',
   // Phase BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP:
   // forward the live-gate env snapshot to the adapter so it can
   // independently re-verify the live condition.
   confirmedLiveProviderPath: isConfirmedLiveProviderPath,
   liveProviderEnv: liveProviderEnvForAdapter,
 });

 if (!adapterResult.ok) {
   // Record the failure outcome (in-memory only).
   const isLiveMode = adapterResult.generationSource === 'byok-live';
   recordByokSubmit({
     requestId: submitRequestId,
     stage: isLiveMode ? 'provider_error' : 'invalid_input',
     outcome: isLiveMode ? 'live_relay_provider_error' : 'invalid_input',
     modeCandidate: isLiveMode ? 'live' : 'fake',
     turnstilePresent: true,
     apiKeyPresent: submitApiKeyPresent,
     promptPresent: true,
   });
   sendJson(res, 502, {
     ok: false,
     code: adapterResult.code,
     message: redactSensitive(adapterResult.message),
     requestId,
   });
   return;
 }

// 6e. Success. Return the relay result code. apiKey is never echoed.
const isLiveSuccess = adapterResult.generationSource === 'byok-live';
recordByokSubmit({
  requestId: submitRequestId,
  stage: isLiveSuccess ? 'live_relay_ok' : 'fake_relay_ok',
  outcome: isLiveSuccess ? 'live_relay_ok' : 'fake_relay_ok',
  modeCandidate: isLiveSuccess ? 'live' : 'fake',
  turnstilePresent: true,
  apiKeyPresent: submitApiKeyPresent,
  promptPresent: true,
});
sendJson(res, 200, {
   ok: true,
   code: adapterResult.code,
   message: adapterResult.message,
   audioFileName: adapterResult.audioFileName,
   audioFilePath: adapterResult.audioFilePath,
   sizeBytes: adapterResult.sizeBytes,
   generationSource: adapterResult.generationSource,
   requestId,
 });
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
