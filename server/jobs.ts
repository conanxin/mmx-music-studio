/**
 * server/jobs.ts — Async job queue for music generation.
 *
 * Design:
 * - Single-process in-memory queue + JSON persistence.
 * - At most 1 job runs at a time.
 * - On server restart, any "running" job is marked "failed" (interrupted).
 * - Succeeded/failed/cancelled jobs are persisted to storage/jobs/jobs.json.
 * - Job input NEVER contains API key or Authorization header.
 *
 * Security guarantees:
 * - Job input is validated but never re-emitted with secrets.
 * - Progress messages are sanitized.
 * - Error messages do not contain raw API key values.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  ensureOutputDir,
  loadManifest,
  createTrackRecord,
  appendTrack,
  findTrackById,
  getTrackFilePath,
  generateTrackId,
  generateFileName,
  formatDuration,
} from './storage.js';
import { mockMiniMaxGenerate } from './mock-minimax.js';
import { generateWithMmxCli } from './adapters/minimax-cli/index.js';
import { buildMiniMaxMusicPayload, validateMusicInput, type MusicGenerationInput } from './core-wrapper.js';
import { getSessionApiKey, redactSecrets } from './security.js';
import { callMiniMaxApi } from './call-minimax.js';
import { incrementDailyQuota } from './rate-limit.js';
import {
  setJobApiKey,
  getJobApiKey,
  deleteJobApiKey,
  redactForLog,
  getKeyLengthBucket,
} from './byok-secrets.js';
import {
  checkRealApiAttemptLimit,
  reserveRealApiAttempt,
} from './rate-limit.js';
import type { BackendMode, ServerConfig } from './types.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type GenerateJobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type GenerationSource = 'mock' | 'minimax-api' | 'mmx-cli';

export interface GenerateJobError {
  type: string;
  message: string;
  hint?: string;
}

/** Job record — never contains API keys or Authorization headers */
export interface GenerateJob {
  id: string;
  status: GenerateJobStatus;
  /** Mode/prompt/lyrics only — no keys */
  input: MusicGenerationInput;
  backend: BackendMode;
  /** 'server' = server key, 'session' = BYOK user key */
  keyMode?: 'server' | 'session';
  generationSource?: GenerationSource;
  trackId?: string;
  error?: GenerateJobError;
  progressMessage: string;
  progressPercent?: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt: string;
  elapsedMs?: number;
}

export interface JobsManifest {
  version: 1;
  jobs: GenerateJob[];
}

export interface JobProgress {
  status: GenerateJobStatus;
  progressMessage: string;
  progressPercent?: number;
  error?: GenerateJobError;
}

// ── Paths ────────────────────────────────────────────────────────────────────

const STORAGE_BASE = path.resolve(process.cwd(), 'storage');
const JOBS_DIR = path.join(STORAGE_BASE, 'jobs');
const JOBS_MANIFEST = path.join(JOBS_DIR, 'jobs.json');

// ── In-memory state ───────────────────────────────────────────────────────────

/** All known jobs (including running/queued) */
const jobStore = new Map<string, GenerateJob>();

/** Queue of job IDs waiting to run, in order */
const jobQueue: string[] = [];

/** True while the worker is processing a job */
let workerBusy = false;

/** Reference to the server config (set at startup) */
let serverConfig: ServerConfig | null = null;

// ── Persistence ───────────────────────────────────────────────────────────────

function ensureJobsDir(): void {
  if (!fs.existsSync(JOBS_DIR)) {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
  }
}

function loadJobsManifest(): JobsManifest {
  ensureJobsDir();
  if (!fs.existsSync(JOBS_MANIFEST)) {
    return { version: 1, jobs: [] };
  }
  try {
    const raw = fs.readFileSync(JOBS_MANIFEST, 'utf-8');
    return JSON.parse(raw) as JobsManifest;
  } catch {
    return { version: 1, jobs: [] };
  }
}

function saveJobsManifest(manifest: JobsManifest): void {
  ensureJobsDir();
  fs.writeFileSync(JOBS_MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8');
}

export function loadJobs(): void {
  const manifest = loadJobsManifest();
  for (const job of manifest.jobs) {
    jobStore.set(job.id, job);
  }
  // Recover interrupted running jobs
  for (const job of Array.from(jobStore.values())) {
    if (job.status === 'running') {
      job.status = 'failed';
      job.error = { type: 'interrupted', message: '任务中断（服务重启）' };
      job.finishedAt = new Date().toISOString();
      job.progressMessage = '任务中断（服务重启）';
      job.updatedAt = new Date().toISOString();
      if (job.startedAt) {
        job.elapsedMs = new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime();
      }
    }
    if (job.status === 'queued') {
      jobQueue.push(job.id);
    }
  }
  pruneOldJobs();
  console.log(`[jobs] loaded ${jobStore.size} jobs, ${jobQueue.length} queued`);
}

function persistJob(job: GenerateJob): void {
  // Append/update in manifest
  const manifest = loadJobsManifest();
  const idx = manifest.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    manifest.jobs[idx] = job;
  } else {
    manifest.jobs.unshift(job);
  }
  pruneOldJobs(manifest);
  saveJobsManifest(manifest);
}

/** Keep only the most recent 100 terminal jobs */
function pruneOldJobs(manifest?: JobsManifest): void {
  const m = manifest ?? loadJobsManifest();
  const terminal = m.jobs.filter((j) =>
    j.status === 'succeeded' || j.status === 'failed' || j.status === 'cancelled'
  );
  const active = m.jobs.filter((j) => j.status === 'queued' || j.status === 'running');
  if (terminal.length > 100) {
    const kept = terminal.slice(0, 100);
    m.jobs = [...active, ...kept];
  }
}

// ── Job CRUD ──────────────────────────────────────────────────────────────────

export function createJob(input: MusicGenerationInput, backend: BackendMode, generationSource?: GenerationSource, keyMode?: 'server' | 'session'): GenerateJob {
  const now = new Date().toISOString();
  const job: GenerateJob = {
    id: `job_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`,
    status: 'queued',
    input,
    backend,
    keyMode,
    progressMessage: '任务已排队',
    createdAt: now,
    updatedAt: now,
  };
  jobStore.set(job.id, job);
  jobQueue.push(job.id);
  persistJob(job);
  return job;
}

export function getJob(id: string): GenerateJob | null {
  return jobStore.get(id) ?? null;
}

export interface ListJobsFilters {
  status?: GenerateJobStatus;
  limit?: number;
  offset?: number;
  search?: string;
  sort?: 'createdAt_desc' | 'createdAt_asc';
}

export interface JobStats {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  workerBusy: boolean;
  queueLength: number;
}

export function listJobs(filters: ListJobsFilters = {}): GenerateJob[] {
  const { status, search, sort = 'createdAt_desc' } = filters;
  let jobs = Array.from(jobStore.values());

  if (status) {
    jobs = jobs.filter(j => j.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    jobs = jobs.filter(j =>
      (j.input.prompt ?? '').toLowerCase().includes(q) ||
      (j.id ?? '').toLowerCase().includes(q)
    );
  }

  if (sort === 'createdAt_asc') {
    jobs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else {
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 50;
  return jobs.slice(offset, offset + limit);
}

export function getTotalJobCount(filters: ListJobsFilters = {}): number {
  const { status, search } = filters;
  let jobs = Array.from(jobStore.values());
  if (status) jobs = jobs.filter(j => j.status === status);
  if (search) {
    const q = search.toLowerCase();
    jobs = jobs.filter(j =>
      (j.input.prompt ?? '').toLowerCase().includes(q) ||
      (j.id ?? '').toLowerCase().includes(q)
    );
  }
  return jobs.length;
}

export function getJobStats(): JobStats {
  const jobs = Array.from(jobStore.values());
  const stats: JobStats = {
    total: jobs.length,
    queued: jobs.filter(j => j.status === 'queued').length,
    running: jobs.filter(j => j.status === 'running').length,
    succeeded: jobs.filter(j => j.status === 'succeeded').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    cancelled: jobs.filter(j => j.status === 'cancelled').length,
    workerBusy: isWorkerBusy(),
    queueLength: getQueuedCount(),
  };
  return stats;
}

export function deleteJob(id: string): boolean {
  if (!jobStore.has(id)) return false;
  const job = jobStore.get(id)!;
  if (job.status === 'running' || job.status === 'queued') return false;
  jobStore.delete(id);
  try {
    const jobFile = path.join(process.cwd(), '.jobs', `${id}.json`);
    if (fs.existsSync(jobFile)) fs.unlinkSync(jobFile);
  } catch { /* ignore */ }
  return true;
}

export function retryJob(
  id: string,
  config: Pick<ServerConfig, 'outputDir' | 'mockGenerationEnabled' | 'realGenerationEnabled' | 'previewAccess' | 'generationAccess' | 'rateLimit' | 'dailyQuota' | 'realApiAttempt' | 'backend'>,
): GenerateJob | null {
  const original = jobStore.get(id);
  if (!original) return null;
  if (original.status !== 'failed' && original.status !== 'cancelled') return null;

  const newJob = createJob(original.input, original.backend, undefined, original.keyMode);
  // Enqueue the new job so it runs
  // createJob already enqueues and persists;
  return newJob;
}

export function updateJob(id: string, patch: Partial<GenerateJob>): GenerateJob | null {
  const job = jobStore.get(id);
  if (!job) return null;
  const updated: GenerateJob = { ...job, ...patch, updatedAt: new Date().toISOString() };
  jobStore.set(id, updated);
  persistJob(updated);
  return updated;
}

export function cancelJob(id: string): GenerateJob | null {
  const job = jobStore.get(id);
  if (!job) return null;
  if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
    return job; // already terminal
  }
  // Remove from queue if queued
  const qIdx = jobQueue.indexOf(id);
  if (qIdx >= 0) jobQueue.splice(qIdx, 1);
  const now = new Date().toISOString();
  const updated: GenerateJob = {
    ...job,
    status: 'cancelled',
    finishedAt: now,
    updatedAt: now,
    progressMessage: '任务已取消',
  };
  if (job.startedAt) {
    updated.elapsedMs = new Date(now).getTime() - new Date(job.startedAt).getTime();
  }
  jobStore.set(id, updated);
  persistJob(updated);

  // Clean up BYOK session key if present
  if (updated.keyMode === 'session') {
    deleteJobApiKey(id);
  }

  return updated;
}

export function getQueuedCount(): number {
  return jobQueue.length;
}

export function isWorkerBusy(): boolean {
  return workerBusy;
}

// ── Progress steps for mock jobs ─────────────────────────────────────────────

const MOCK_PROGRESS_STEPS: Array<{ percent: number; message: string }> = [
  { percent: 0, message: '任务已排队' },
  { percent: 5, message: '正在启动生成器…' },
  { percent: 15, message: '正在生成音乐（1/3）…' },
  { percent: 40, message: '正在生成音乐（2/3）…' },
  { percent: 65, message: '正在生成音乐（3/3）…' },
  { percent: 80, message: '正在保存音频…' },
  { percent: 95, message: '正在处理完成…' },
  { percent: 100, message: '生成完成' },
];

// ── Mock job execution ───────────────────────────────────────────────────────

async function executeMockJob(job: GenerateJob): Promise<void> {
  const config = serverConfig;
  if (!config) return;

  const now = new Date().toISOString();
  updateJob(job.id, { status: 'running', startedAt: now, updatedAt: now });

  // Simulate progress steps with delays
  for (const step of MOCK_PROGRESS_STEPS) {
    // Check for cancellation before each step
    const current = getJob(job.id);
    if (!current || current.status === 'cancelled') return;

    if (step.percent < 100) {
      updateJob(job.id, {
        progressMessage: step.message,
        progressPercent: step.percent,
        elapsedMs: new Date().getTime() - new Date(current.startedAt!).getTime(),
      });
    }

    if (step.percent === 0) {
      await sleep(200);
    } else if (step.percent < 80) {
      await sleep(600);
    } else if (step.percent < 100) {
      await sleep(400);
    }
  }

  // Actually generate the mock track
  let mockResult: Awaited<ReturnType<typeof mockMiniMaxGenerate>>;
  try {
    mockResult = await mockMiniMaxGenerate({
      mode: job.input.mode,
      prompt: job.input.prompt,
      lyrics: getLyrics(job.input),
      audioUrl: getAudioUrl(job.input),
      audioBase64: getAudioBase64(job.input),
      model: job.input.model,
      outputFormat: job.input.outputFormat,
    });
  } catch (err) {
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'mock_generation', message: '模拟生成失败' },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    return;
  }

  // Save audio
  try {
    ensureOutputDir(config.outputDir);
  } catch {
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'storage', message: '无法创建存储目录' },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    return;
  }

  const id = generateTrackId();
  const title = (job.input.prompt || '模拟音乐').slice(0, 80);
  const fileName = `mock_${id.slice(0, 8)}_${Date.now()}.wav`;
  const filePath = getTrackFilePath(config.outputDir, fileName);

  try {
    fs.writeFileSync(filePath, mockResult.audioBuffer);
  } catch {
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'storage', message: '无法写入音频文件' },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    return;
  }

  const track = createTrackRecord({
    id,
    title,
    mode: getMode(job.input),
    model: (job.input as unknown as { model?: string }).model || 'music-2.6',
    prompt: job.input.prompt || '',
    lyrics: getLyrics(job.input),
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

  const finishedAt = new Date().toISOString();
  updateJob(job.id, {
    status: 'succeeded',
    trackId: track.id,
    generationSource: 'mock',
    progressMessage: '生成完成',
    progressPercent: 100,
    finishedAt,
    elapsedMs: new Date(finishedAt).getTime() - new Date(job.startedAt!).getTime(),
  });

  // Count successful mock generation toward daily quota
  incrementDailyQuota('mock');

  console.log(`[jobs] mock job succeeded: id=${job.id} trackId=${track.id}`);
}

// ── CLI job execution ─────────────────────────────────────────────────────────

async function executeCliJob(
  job: GenerateJob,
  keyMode: 'server' | 'session',
  sessionApiKey?: string,
): Promise<void> {
  const config = serverConfig;
  if (!config) return;

  const now = new Date().toISOString();
  updateJob(job.id, {
    status: 'running',
    startedAt: now,
    progressMessage: '正在启动 MMX CLI…',
    progressPercent: 5,
    updatedAt: now,
  });

  const audioFileName = `${job.id}.mp3`;

  let cliResult: Awaited<ReturnType<typeof generateWithMmxCli>>;
  try {
    updateJob(job.id, {
      progressMessage: 'MiniMax 正在生成音乐…',
      progressPercent: 30,
    });
    cliResult = await generateWithMmxCli(job.input, {
      outputDir: config.outputDir,
      audioFileName,
      timeoutMs: 240_000,
      audioUrl: getAudioUrl(job.input),
      audioFile: undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = msg.includes('AUTH') || msg.includes('login') || msg.includes('invalid')
      ? 'CLI 认证异常，请在服务器运行 mmx auth login 修复'
      : 'CLI 生成失败，请检查 mmx 版本和服务器日志';
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'cli_generation', message: `MMX CLI 生成失败：${msg.slice(0, 200)}`, hint },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    return;
  }

  updateJob(job.id, { progressMessage: '正在保存音频…', progressPercent: 80 });

  let audioBuffer: Buffer;
  try {
    audioBuffer = fs.readFileSync(cliResult.audioFilePath);
  } catch {
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'storage', message: 'CLI 生成成功但无法读取输出文件' },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    return;
  }

  const id = generateTrackId();
  const title = (job.input.prompt || 'CLI 音乐').slice(0, 80);
  const track = createTrackRecord({
    id,
    title,
    mode: getMode(job.input),
    model: 'music-2.6',
    prompt: job.input.prompt || '',
    lyrics: getLyrics(job.input),
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

  const finishedAt = new Date().toISOString();
  updateJob(job.id, {
    status: 'succeeded',
    trackId: track.id,
    generationSource: 'mmx-cli',
    progressMessage: '生成完成',
    progressPercent: 100,
    finishedAt,
    elapsedMs: new Date(finishedAt).getTime() - new Date(job.startedAt!).getTime(),
  });

  console.log(`[jobs] cli job succeeded: id=${job.id} trackId=${track.id}`);

  // Count successful CLI generation toward daily quota
  incrementDailyQuota('mmx-cli');
}

// ── API job execution ─────────────────────────────────────────────────────────

async function executeApiJob(
  job: GenerateJob,
  keyMode: 'server' | 'session',
  sessionApiKey?: string,
  region?: 'cn' | 'global',
): Promise<void> {
  const config = serverConfig;
  if (!config) return;

  const now = new Date().toISOString();
  updateJob(job.id, {
    status: 'running',
    startedAt: now,
    progressMessage: '正在准备请求…',
    progressPercent: 5,
    updatedAt: now,
  });

  // Use job's keyMode (set at createJob time from handleGenerate's keyMode)
  const effectiveKeyMode = job.keyMode ?? keyMode;

  let apiKey: string | undefined;
  if (effectiveKeyMode === 'server') {
    apiKey = config.minimaxApiKey;
  } else {
    // BYOK mode: retrieve from temporary secret store
    apiKey = getJobApiKey(job.id) ?? sessionApiKey;
  }

  if (!apiKey) {
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'missing_api_key', message: '未配置 API Key' },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    if (effectiveKeyMode === 'session') deleteJobApiKey(job.id);
    return;
  }

  updateJob(job.id, {
    progressMessage: '正在调用 MiniMax API…',
    progressPercent: 20,
  });

  const payload = buildMiniMaxMusicPayload(job.input);

  // ── Phase 5E: Real API Attempt Guard ────────────────────────────────────
  // Reserve FIRST, then check — this ensures counter is always incremented
  // on every path that touches the real API call, even if the call fails.
  // This makes realApiAttemptsUsed observable from the first attempt.
  if (config.realApiAttempt.enabled) {
    reserveRealApiAttempt(config.realApiAttempt, { jobId: job.id, mode: job.input.mode });
    const check = checkRealApiAttemptLimit(config.realApiAttempt);
    if (!check.allowed) {
      updateJob(job.id, {
        status: 'failed',
        error: {
          type: 'real_api_attempt_limit_exceeded',
          message: `今日真实 API 测试次数已用完（剩余 ${check.remaining ?? 0} 次）`,
          hint: '请明天再试，或在设置中关闭真实 API 测试模式',
        },
        finishedAt: new Date().toISOString(),
        progressMessage: '生成失败',
      });
      if (effectiveKeyMode === 'session') deleteJobApiKey(job.id);
      return;
    }
  }

  let apiResult: Awaited<ReturnType<typeof callMiniMaxApi>>;
  try {
    apiResult = await callMiniMaxApi({
      apiKey,
      region: region || config.minimaxRegion,
      payload,
      timeoutMs: 180_000,
    });
  } catch (err) {
    const msg = redactSecrets((err as Error).message);
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'minimax_api', message: `MiniMax API 错误：${msg.slice(0, 200)}` },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    if (effectiveKeyMode === 'session') deleteJobApiKey(job.id);
    return;
  }

  updateJob(job.id, { progressMessage: '正在下载音频…', progressPercent: 60 });

  let audioBuffer: Buffer;
  if (apiResult.audioKind === 'url' && apiResult.audioValue) {
    try {
      const response = await fetch(apiResult.audioValue);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const ab = await response.arrayBuffer();
      audioBuffer = Buffer.from(ab);
    } catch (err) {
      updateJob(job.id, {
        status: 'failed',
        error: { type: 'audio_download', message: `音频下载失败：${(err as Error).message}` },
        finishedAt: new Date().toISOString(),
        progressMessage: '生成失败',
      });
      if (effectiveKeyMode === 'session') deleteJobApiKey(job.id);
      return;
    }
  } else if (apiResult.audioKind === 'hex') {
    const clean = apiResult.audioValue.replace(/\s+/g, '');
    audioBuffer = Buffer.from(clean, 'hex');
  } else {
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'minimax_api', message: 'MiniMax 返回的音频格式无法处理' },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    if (effectiveKeyMode === 'session') deleteJobApiKey(job.id);
    return;
  }

  updateJob(job.id, { progressMessage: '正在保存音频…', progressPercent: 80 });

  try {
    ensureOutputDir(config.outputDir);
  } catch {
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'storage', message: '无法创建存储目录' },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    if (effectiveKeyMode === 'session') deleteJobApiKey(job.id);
    return;
  }

  const fileName = generateFileName({ mode: job.input.mode, title: (job.input.prompt || 'untitled').slice(0, 40) });
  const filePath = getTrackFilePath(config.outputDir, fileName);

  try {
    fs.writeFileSync(filePath, audioBuffer);
  } catch {
    updateJob(job.id, {
      status: 'failed',
      error: { type: 'storage', message: '无法写入音频文件' },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
    if (effectiveKeyMode === 'session') deleteJobApiKey(job.id);
    return;
  }

  const id = generateTrackId();
  const title = (job.input.prompt || '未命名').slice(0, 80);
  const track = createTrackRecord({
    id,
    title,
    mode: getMode(job.input),
    model: (job.input as unknown as { model?: string }).model || 'music-2.6',
    prompt: job.input.prompt || '',
    lyrics: getLyrics(job.input),
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

  const finishedAt = new Date().toISOString();
  updateJob(job.id, {
    status: 'succeeded',
    trackId: track.id,
    generationSource: 'minimax-api',
    progressMessage: '生成完成',
    progressPercent: 100,
    finishedAt,
    elapsedMs: new Date(finishedAt).getTime() - new Date(job.startedAt!).getTime(),
  });

  console.log(`[jobs] api job succeeded: id=${job.id} trackId=${track.id}`);

  // Count successful API generation toward daily quota
  incrementDailyQuota('minimax-api');

  // Clean up BYOK session key on success
  if (effectiveKeyMode === 'session') deleteJobApiKey(job.id);
}

// ── Worker ────────────────────────────────────────────────────────────────────

async function runNextJob(
  keyMode: 'server' | 'session',
  sessionApiKey?: string,
  region?: 'cn' | 'global',
): Promise<void> {
  if (workerBusy) return;
  if (jobQueue.length === 0) return;

  const jobId = jobQueue.shift();
  if (!jobId) return;

  const job = jobStore.get(jobId);
  if (!job) return;
  if (job.status !== 'queued') return; // was cancelled

  workerBusy = true;

  try {
    if (job.backend === 'mock' || !serverConfig?.realGenerationEnabled) {
      await executeMockJob(job);
    } else if (job.backend === 'cli') {
      await executeCliJob(job, keyMode, sessionApiKey);
    } else {
      await executeApiJob(job, keyMode, sessionApiKey, region);
    }
  } catch (err) {
    const msg = redactSecrets((err as Error).message);
    updateJob(jobId, {
      status: 'failed',
      error: { type: 'unknown', message: `任务执行异常：${msg.slice(0, 200)}` },
      finishedAt: new Date().toISOString(),
      progressMessage: '生成失败',
    });
  } finally {
    workerBusy = false;
    // Process next job in queue
    if (jobQueue.length > 0) {
      setImmediate(() => runNextJob(keyMode, sessionApiKey, region));
    }
  }
}

export function startWorker(config: ServerConfig): void {
  serverConfig = config;
  console.log('[jobs] worker started');
}

export function enqueueAndRun(
  keyMode: 'server' | 'session',
  sessionApiKey?: string,
  region?: 'cn' | 'global',
): void {
  setImmediate(() => runNextJob(keyMode, sessionApiKey, region));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Safely extract optional properties from MusicGenerationInput discriminated union
function getLyrics(input: MusicGenerationInput): string | undefined {
  return (input as { lyrics?: string }).lyrics;
}
function getAudioUrl(input: MusicGenerationInput): string | undefined {
  return (input as { audioUrl?: string }).audioUrl;
}
function getAudioBase64(input: MusicGenerationInput): string | undefined {
  return (input as { audioBase64?: string }).audioBase64;
}
function getMode(input: MusicGenerationInput): string {
  return input.mode;
}

export { jobStore };
