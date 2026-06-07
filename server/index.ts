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
import { mockMiniMaxGenerate } from './mock-minimax.js';
import { generateWithMmxCli, diagnoseMmxCli, runMmx } from './adapters/minimax-cli/index.js';
import { MmxCliError } from './adapters/minimax-cli/errors.js';
import type { MmxCliDiagnostics } from './adapters/minimax-cli/types.js';
import type {
  ServerConfig,
  GenerationSource,
  TrackMetadata,
  GenerateRequest,
  ServerError,
  ServerErrorType,
  BackendMode,
} from './types.js';

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
    maxRequestBodyMb: Number(process.env.MAX_REQUEST_BODY_MB || 80),
    previewAccess: buildPreviewAccessConfig(),
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

// ── MiniMax API call ──────────────────────────────────────────────────────────

const MINIMAX_ENDPOINTS = {
  cn: 'https://api.minimaxi.com/v1/music_generation',
  global: 'https://api.minimax.io/v1/music_generation',
};

async function callMiniMaxApi(params: {
  apiKey: string;
  region: 'cn' | 'global';
  payload: ReturnType<typeof buildMiniMaxMusicPayload>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<{
  audioKind: 'url' | 'hex' | 'unknown';
  audioValue: string;
  durationMs?: number;
  sampleRate?: number;
  bitrate?: number;
  sizeBytes?: number;
  traceId?: string;
}> {
  const endpoint = MINIMAX_ENDPOINTS[params.region];
  // params.payload is BuildMusicPayloadResult — extract only the inner payload object
  const body: Record<string, unknown> = { ...params.payload.payload, output_format: 'url' };

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = params.timeoutMs ?? 120000; // default 2min
    const timer = setTimeout(() => controller.abort(), timeout);
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal ?? controller.signal as AbortSignal,
    });
    clearTimeout(timer);
  } catch (err) {
    throw Object.assign(
      new Error(`网络请求失败: ${(err as Error).message}`),
      { code: 'NETWORK_ERROR' },
    );
  }

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const b = await response.json() as Record<string, unknown>;
      msg = (b.base_resp as Record<string, unknown>)?.status_msg as string || msg;
    } catch { /* ignore */ }
    const e = new Error(`MiniMax API 错误: ${msg}`) as Error & { code: string; statusCode: number };
    e.code = 'HTTP_ERROR';
    e.statusCode = response.status;
    throw e;
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw Object.assign(new Error('响应解析失败'), { code: 'PARSE_ERROR' });
  }

  const obj = raw as Record<string, unknown>;
  const baseResp = obj.base_resp as Record<string, unknown> | undefined;
  if (baseResp && baseResp.status_code !== 0) {
    throw Object.assign(
      new Error(`MiniMax 返回错误: ${baseResp.status_msg}`),
      { code: 'MINIMAX_ERROR', traceId: obj.trace_id as string | undefined },
    );
  }

  const data = (obj.data || obj) as Record<string, unknown>;
  let audioKind: 'url' | 'hex' | 'unknown' = 'unknown';
  let audioValue = '';
  if (typeof data.audio === 'string') {
    audioValue = data.audio;
    if (audioValue.startsWith('http')) audioKind = 'url';
    else if (/^[0-9a-fA-F\s]+$/.test(audioValue) && audioValue.length > 32) audioKind = 'hex';
  } else if (typeof data.audio_url === 'string') {
    audioValue = data.audio_url; audioKind = 'url';
  } else if (typeof data.url === 'string') {
    audioValue = data.url; audioKind = 'url';
  }

  const extra = data.extra_info as Record<string, unknown> | undefined;
  const durRaw = extra?.music_duration ?? extra?.duration;
  const durationMs = typeof durRaw === 'number' ? Math.round(durRaw * 1000) : undefined;

  return {
    audioKind,
    audioValue,
    durationMs,
    sampleRate: extra?.music_sample_rate as number | undefined,
    bitrate: extra?.bitrate as number | undefined,
    sizeBytes: extra?.music_size as number | undefined,
    traceId: typeof obj.trace_id === 'string' ? obj.trace_id : undefined,
  };
}

// ── Route handlers ────────────────────────────────────────────────────────────

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

  sendJson(res, 200, {
    ok: true,
    service: 'mmx-music-studio',
    phase: '2I',
    safePreviewMode,
    previewAccessEnabled: config.previewAccess.enabled,
    demoMode: config.demoMode,
    realGenerationEnabled: config.realGenerationEnabled,
    mockGenerationEnabled: config.mockGenerationEnabled,
    hasServerKey: !!config.minimaxApiKey,
    region: config.minimaxRegion,
    outputDirReady: fs.existsSync(config.outputDir),
    backend: config.backend,
    availableBackends: ['mock', 'api', 'cli'] as string[],
    cliAvailable,
    cliAuthenticated: cliDiagnostics?.authStatus === 'authenticated' || undefined,
    cliRegion: cliDiagnostics?.region ?? undefined,
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
  let body: GenerateRequest;
  try {
    body = await parseBody<GenerateRequest>(req, config.maxRequestBodyMb);
  } catch {
    sendError(res, 'unknown', '无效请求体');
    return;
  }
  const { input, keyMode, region } = body;
  const requestId = `req_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  // ── Guard: REAL_GENERATION_ENABLED=false → mock adapter only ──────────────
  // Even if MINIMAX_API_KEY is set in env, we MUST NOT call MiniMax API
  if (!config.realGenerationEnabled) {
    // Input validation still runs
    const validation = validateMusicInput(input as Parameters<typeof validateMusicInput>[0]);
    if (!validation.ok) {
      sendError(res, 'validation', validation.errors.map((e) => e.message).join('；'), 400);
      return;
    }

    // Mock mode: generate WAV buffer
    let mockResult: Awaited<ReturnType<typeof mockMiniMaxGenerate>>;
    try {
      mockResult = await mockMiniMaxGenerate({
        mode: input.mode,
        prompt: input.prompt,
        lyrics: input.lyrics,
        audioUrl: input.audioUrl,
        audioBase64: input.audioBase64,
        model: input.model,
        outputFormat: input.outputFormat,
      });
    } catch (err) {
      console.error('[server] mock generation failed:', redactSecrets((err as Error).message));
      sendError(res, 'unknown', '模拟生成失败', 500, '请检查服务器日志');
      return;
    }

    // Save to storage
    try {
      ensureOutputDir(config.outputDir);
    } catch {
      sendError(res, 'storage', '无法创建存储目录', 500);
      return;
    }

    const id = generateTrackId();
    const title = (input.prompt || '模拟音乐').slice(0, 80);
    const fileName = `mock_${id.slice(0, 8)}_${Date.now()}.wav`;
    const filePath = getTrackFilePath(config.outputDir, fileName);

    try {
      fs.writeFileSync(filePath, mockResult.audioBuffer);
    } catch {
      sendError(res, 'storage', '无法写入音频文件', 500);
      return;
    }

    const track = createTrackRecord({
      id,
      title,
      mode: input.mode,
      model: (input as Record<string, unknown>).model as string || 'music-2.6',
      prompt: input.prompt || '',
      lyrics: input.lyrics,
      audioFileName: fileName,
      audioMimeType: 'audio/wav',
      audioFormat: 'wav',
      durationMs: mockResult.extraInfo.durationMs,
      durationText: formatDuration(mockResult.extraInfo.durationMs),
      sampleRate: mockResult.extraInfo.sampleRate,
      bitrate: mockResult.extraInfo.bitrate,
      sizeBytes: mockResult.extraInfo.sizeBytes,
      traceId: mockResult.traceId,
      generationSource: 'mock',
    });

    try {
      appendTrack(config.outputDir, track);
    } catch { /* non-fatal */ }

    console.log(`[server] mock generate: id=${id} title="${title}" mode=${input.mode} generationSource=mock`);

    sendJson(res, 200, {
      ok: true,
      track: toTrackResponse(track),
      generationSource: 'mock',
    });
    return;
  }

  // ── REAL_GENERATION_ENABLED=true path ─────────────────────────────────────
  // Backend selection: api / cli / mock
  // CLI adapter is implemented but not wired in Phase 2D (no auto real generation).
  // To enable CLI backend, uncomment the CLI block in handleGenerate
  // (see Phase 2D-B instructions in docs/CLI-ADAPTER.md).
  const backend = config.backend;

  // ── Validation (shared) ───────────────────────────────────────────────────────
  const validation = validateMusicInput(input as Parameters<typeof validateMusicInput>[0]);
  if (!validation.ok) {
    sendError(res, 'validation', validation.errors.map((e) => e.message).join('；'), 400);
    return;
  }

  // ── CLI Backend ─────────────────────────────────────────────────────────────
  if (backend === 'cli') {
    // Generate track id + filename BEFORE calling CLI so we can pass it in.
    // This guarantees id == audioFileName, eliminating rename ambiguity.
    const id = generateTrackId();
    const audioFileName = `${id}.mp3`;
    let cliResult: Awaited<ReturnType<typeof generateWithMmxCli>>;
    try {
      cliResult = await generateWithMmxCli(input as MusicGenerationInput, {
        outputDir: config.outputDir,
        audioFileName, // ensures mmx writes directly to the canonical filename
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

    // Read the generated file
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
      audioFileName, // use the server-generated name (${id}.mp3)
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

    console.log(`[server] mmx-cli generate: id=${id} title="${track.title}" mode=${input.mode} generationSource=mmx-cli file=${cliResult.audioFileName}`);

    sendJson(res, 200, {
      ok: true,
      track: toTrackResponse(track),
      generationSource: 'mmx-cli',
    });
    return;
  }

  // ── API Backend ─────────────────────────────────────────────────────────────
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

  // Build payload
  const payload = buildMiniMaxMusicPayload(input as Parameters<typeof buildMiniMaxMusicPayload>[0]);

  // Call MiniMax
  let apiResult: Awaited<ReturnType<typeof callMiniMaxApi>>;
  try {
    apiResult = await callMiniMaxApi({
      apiKey,
      region: region || config.minimaxRegion,
      payload,
    });
  } catch (err) {
    const se = toServerError(err, requestId);
    console.error(`[server] MiniMax API error [${requestId}]:`, redactSecrets((err as Error).message));
    sendJson(res, 500, se);
    return;
  }

  // Download or decode audio
  let audioBuffer: Buffer;
  if (apiResult.audioKind === 'url' && apiResult.audioValue) {
    try {
      const response = await fetch(apiResult.audioValue);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > 80 * 1024 * 1024) {
        throw new Error('音频文件超过 80MB 限制');
      }
      const ab = await response.arrayBuffer();
      audioBuffer = Buffer.from(ab);
    } catch (err) {
      sendError(res, 'audio_download', `音频下载失败：${(err as Error).message}`, 500);
      return;
    }
  } else if (apiResult.audioKind === 'hex') {
    const clean = apiResult.audioValue.replace(/\s+/g, '');
    audioBuffer = Buffer.from(clean, 'hex');
  } else {
    sendError(res, 'minimax_api', 'MiniMax 返回的音频格式无法处理', 500);
    return;
  }

  // Save to storage
  try {
    ensureOutputDir(config.outputDir);
  } catch {
    sendError(res, 'storage', '无法创建存储目录', 500);
    return;
  }

  const fileName = generateFileName({
    mode: input.mode,
    title: (input.prompt || 'untitled').slice(0, 40),
  });
  const filePath = getTrackFilePath(config.outputDir, fileName);
  try {
    fs.writeFileSync(filePath, audioBuffer);
  } catch {
    sendError(res, 'storage', '无法写入音频文件', 500);
    return;
  }

  // Write manifest
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

  console.log(`[server] minimax generate: id=${id} title="${track.title}" mode=${input.mode} generationSource=minimax traceId=${apiResult.traceId ?? 'n/a'}`);

  sendJson(res, 200, {
    ok: true,
    track: toTrackResponse(track),
    generationSource: 'minimax',
  });
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
  console.log(`  region: ${config.minimaxRegion}`);
  console.log(`  outputDir: ${config.outputDir}`);
  console.log(`======================================`);

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

  const host = process.env.HOST || '0.0.0.0';

  server.listen(config.port, host, () => {
    console.log(`[server] mmx-music-studio API 运行于 http://${host}:${config.port}`);
  });

  process.on('SIGTERM', () => { server.close(); process.exit(0); });
}

main();
