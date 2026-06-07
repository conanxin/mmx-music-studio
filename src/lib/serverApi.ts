/**
 * Web → API Server fetch wrapper.
 * All communication goes to the self-hosted mmx-music-studio API server.
 * Session key is sent only via x-minimax-api-key header (never in body).
 *
 * Security guarantees:
 * - Never console.log the API key
 * - Never console.log headers
 * - Never put key in error messages
 * - Redacts secrets from any displayed error text
 */

/**
 * Resolves the API server base URL.
 *
 * Priority:
 * 1. VITE_API_BASE_URL env var (for local dev / reverse-proxy scenarios)
 * 2. window.location.origin (for same-origin browser deployments — the server
 *    and frontend are served from the same origin, so the browser auto-paths
 *    to the right host without hardcoding localhost or an IP)
 * 3. http://localhost:8787 (last-resort fallback for local dev without Vite proxy)
 */
function resolveApiBase(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  return 'http://localhost:8787';
}

const API_BASE = resolveApiBase();

export function getApiBaseUrl(): string {
  return API_BASE;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthInfo {
  ok: boolean;
  service?: string;
  phase?: string;
  safePreviewMode?: boolean;
  previewAccessEnabled?: boolean;
  // Phase 4C: Generation Access
  generationAccessEnabled?: boolean;
  // Phase 4C: Rate Limit
  rateLimitEnabled?: boolean;
  rateLimitWindowMs?: number;
  rateLimitMaxRequests?: number;
  // Phase 4C: Daily Quota
  dailyQuotaEnabled?: boolean;
  dailyGenerationLimit?: number;
  dailyGenerationUsed?: number;
  remainingDailyGenerations?: number;
  // Existing fields
  demoMode?: boolean;
  publicDemoMode?: boolean;
  realGenerationEnabled?: boolean;
  mockGenerationEnabled?: boolean;
  hasServerKey?: boolean;
  region?: 'cn' | 'global';
  outputDirReady?: boolean;
  backend?: 'mock' | 'api' | 'cli';
  availableBackends?: string[];
  cliAvailable?: boolean;
  cliAuthenticated?: boolean;
  cliRegion?: 'cn' | 'global' | null;
  jobQueueEnabled?: boolean;
  queuedJobs?: number;
  workerBusy?: boolean;
  // Phase 4F: Audit & Auth Guard
  auditLogEnabled?: boolean;
  authGuardEnabled?: boolean;
  authGuard?: Record<string, unknown>;
}

export interface CheckKeyResult {
  ok: boolean;
  available?: boolean;
  message?: string;
  hasServerKey?: boolean;
}

export interface TrackLike {
  id: string;
  title: string;
  mode: string;
  model?: string;
  prompt?: string;
  lyrics?: string;
  status: string;
  durationText?: string;
  durationMs?: number;
  audioUrl?: string;
  downloadUrl?: string;
  generationSource?: 'mock' | 'minimax' | 'mmx-cli';
  audioMimeType?: string;
  audioFormat?: string;
  createdAt?: string | number;
}

export interface GenerateResult {
  ok: boolean;
  track?: TrackLike;
  generationSource?: 'mock' | 'minimax' | 'mmx-cli';
  error?: { type?: string; message: string };
}

// ── Job queue types ──────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface GenerateJob {
  id: string;
  status: JobStatus;
  progress?: number;
  progressMessage?: string;
  track?: TrackLike;
  error?: { type?: string; message: string; hint?: string };
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  generationSource?: 'mock' | 'minimax' | 'mmx-cli';
  input?: { prompt?: string; mode?: string; lyrics?: string };
}

export interface CreateJobResult {
  ok: boolean;
  job?: GenerateJob;
  error?: { type?: string; message: string };
}

export interface ListJobsResult {
  ok: boolean;
  jobs: GenerateJob[];
  total?: number;
  filters?: ListJobsFilters;
}

export interface ListJobsFilters {
  status?: JobStatus;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: 'newest' | 'oldest';
}

export interface DeleteJobResult {
  ok: boolean;
  deleted?: boolean;
  jobId?: string;
  error?: { type?: string; message: string };
}

export interface RetryJobResult {
  ok: boolean;
  job?: GenerateJob;
  message?: string;
  error?: { type?: string; message: string };
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

export interface JobStatsResult {
  ok: boolean;
  stats?: JobStats;
  error?: { type?: string; message: string };
}

export interface CancelJobResult {
  ok: boolean;
  jobId?: string;
  cancelled?: boolean;
  error?: { type?: string; message: string };
}

export interface ListTracksResult {
  ok: boolean;
  tracks: TrackLike[];
  total?: number;
}

type MusicGenerationInput = {
  mode: string;
  prompt?: string;
  lyrics?: string;
  audioUrl?: string;
  audioBase64?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  language?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip potential secret patterns before showing to user */
function redactSecrets(text: string): string {
  return text
    .replace(/(sk-[a-zA-Z0-9]{10,})/gi, '[已隐藏]')
    .replace(/(Bearer\s+)([^\s"']+)/gi, '$1[已隐藏]');
}

export function safeApiError(err: unknown): { type: string; message: string } {
  if (err instanceof Error) {
    const raw = err.message;
    const msg = redactSecrets(raw);

    // Handle new structured server error format
    // Body format: { ok: false, error: { type, message, hint, requestId } }
    if (msg.includes('"type"') && msg.includes('"message"')) {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.error) {
          return {
            type: parsed.error.type || 'unknown',
            message: parsed.error.message || parsed.error.hint || '服务器返回错误',
          };
        }
      } catch { /* ignore parse failures */ }
    }

    if (msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return { type: 'network', message: '无法连接本地服务，请确认 API Server 已启动' };
    }
    if (msg.includes('missing_api_key')) {
      return { type: 'missing_api_key', message: '请先在设置中填写 Key，或在服务器环境变量配置 MINIMAX_API_KEY' };
    }
    if (msg.includes('real_generation_disabled')) {
      return { type: 'real_generation_disabled', message: '真实生成已禁用，当前为模拟模式' };
    }
    if (msg.includes('validation')) {
      return { type: 'validation', message: '请检查表单内容' };
    }
    if (msg.includes('minimax_api')) {
      return { type: 'minimax_api', message: 'MiniMax API 返回错误，请检查 Key、region 和额度' };
    }
    if (msg.includes('audio_download') || msg.includes('audio-download')) {
      return { type: 'audio_download', message: '音频下载失败' };
    }
    if (msg.includes('storage')) {
      return { type: 'storage', message: '本地保存失败' };
    }
    if (msg.includes('network')) {
      return { type: 'network', message: '网络连接失败，请检查网络状态' };
    }
    return { type: 'unknown', message: msg || '生成失败，请稍后重试' };
  }
  return { type: 'unknown', message: '生成失败，请稍后重试' };
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { noBody?: boolean; noKey?: boolean },
  sessionKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (sessionKey && !options?.noKey) {
    headers['x-minimax-api-key'] = sessionKey;
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      // New structured format
      if (body.error) {
        msg = body.error.message || body.error.hint || JSON.stringify(body.error);
      } else {
        msg = body.message || JSON.stringify(body);
      }
    } catch { /* ignore */ }
    throw new Error(redactSecrets(msg));
  }

  if (options?.noBody) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

// ── API Methods ──────────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthInfo> {
  return apiFetch<HealthInfo>('/api/health', { method: 'GET' });
}

export async function checkKey(params: {
  keyMode: 'session' | 'server';
  region?: 'cn' | 'global';
  apiKey?: string;
}): Promise<CheckKeyResult> {
  const body: Record<string, unknown> = {
    keyMode: params.keyMode,
    region: params.region,
  };

  const noKey = params.keyMode === 'server' || !params.apiKey;
  const sessionKey = !noKey ? params.apiKey : undefined;

  return apiFetch<CheckKeyResult>('/api/key/check', {
    method: 'POST',
    body: JSON.stringify(body),
    noKey,
  }, sessionKey);
}

export async function generateTrack(
  input: MusicGenerationInput,
  settings: { keyMode: 'session' | 'server'; region?: 'cn' | 'global'; apiKey?: string },
): Promise<GenerateResult> {
  const body: Record<string, unknown> = {
    input,
    keyMode: settings.keyMode,
    region: settings.region,
  };

  const noKey = settings.keyMode === 'server' || !settings.apiKey;
  const sessionKey = !noKey ? settings.apiKey : undefined;

  try {
    const result = await apiFetch<{
      ok: boolean;
      track?: TrackLike;
      generationSource?: 'mock' | 'minimax' | 'mmx-cli';
    }>('/api/generate', {
      method: 'POST',
      body: JSON.stringify(body),
      noKey,
    }, sessionKey);

    return result;
  } catch (err) {
    return { ok: false, error: safeApiError(err) };
  }
}

export async function listTracks(): Promise<ListTracksResult> {
  try {
    const result = await apiFetch<{ ok: boolean; tracks: TrackLike[]; total?: number }>('/api/tracks', {
      method: 'GET',
    });
    return { ok: true, tracks: result.tracks || [], total: result.total };
  } catch (err) {
    return { ok: false, tracks: [] };
  }
}

export function getTrackAudioUrl(trackId: string): string {
  return `${API_BASE}/api/tracks/${trackId}/audio`;
}

export function getTrackDownloadUrl(trackId: string): string {
  return `${API_BASE}/api/tracks/${trackId}/download`;
}

export async function deleteTrack(trackId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const result = await apiFetch<{ ok: boolean; deleted?: boolean; id?: string }>(
      `/api/tracks/${trackId}`,
      { method: 'DELETE', noBody: false },
    );
    return { ok: true, message: result.deleted ? '已删除' : '删除完成' };
  } catch (err) {
    return { ok: false, message: safeApiError(err).message };
  }
}

// ── Generation Access API (Phase 4C) ──────────────────────────────────────────

export interface GenAccessStatus {
  ok: boolean;
  enabled: boolean;
  unlocked: boolean;
}

export async function getGenAccessStatus(): Promise<GenAccessStatus> {
  return apiFetch<GenAccessStatus>('/api/generation-access/status', { method: 'GET' });
}

export async function unlockGenAccess(pin: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const raw = await apiFetch<{ ok: boolean; message?: string }>(
      '/api/generation-access/unlock',
      { method: 'POST', body: JSON.stringify({ pin }) },
    );
    return raw;
  } catch (err) {
    return { ok: false, message: safeApiError(err).message };
  }
}

export async function logoutGenAccess(): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>('/api/generation-access/logout', { method: 'POST' });
}

// ── Job queue API ─────────────────────────────────────────────────────────────

/**
 * Submit a generation job. Returns immediately with job.id for polling.
 * Compatible with both async (job) and sync (track) server responses.
 */
export async function createGenerateJob(
  input: MusicGenerationInput,
  settings: { keyMode: 'session' | 'server'; region?: 'cn' | 'global'; apiKey?: string },
): Promise<CreateJobResult> {
  const body: Record<string, unknown> = {
    input,
    keyMode: settings.keyMode,
    region: settings.region,
  };

  const noKey = settings.keyMode === 'server' || !settings.apiKey;
  const sessionKey = !noKey ? settings.apiKey : undefined;

  try {
    const raw = await apiFetch<{
      ok: boolean;
      job?: GenerateJob;
      jobId?: string;
      track?: TrackLike;
      generationSource?: 'mock' | 'minimax' | 'mmx-cli';
    }>('/api/generate', {
      method: 'POST',
      body: JSON.stringify(body),
      noKey,
    }, sessionKey);

    // Async mode: server returned { ok: true, job: { id, status, ... } }
    if (raw.job) {
      return { ok: true, job: raw.job };
    }

    // Sync/legacy mode: server returned { ok: true, track: { ... } }
    // Wrap into a pseudo-completed job for compatibility
    if (raw.track) {
      return {
        ok: true,
        job: {
          id: raw.track.id,
          status: 'succeeded',
          track: raw.track,
          createdAt: raw.track.createdAt as string | undefined,
        },
      };
    }

    return { ok: false, error: { type: 'unknown', message: '服务器响应格式异常' } };
  } catch (err) {
    return { ok: false, error: safeApiError(err) };
  }
}

/** Poll a job by ID to check status. */
export async function getJob(jobId: string): Promise<GenerateJob | null> {
  try {
    const raw = await apiFetch<{ ok: boolean; job: GenerateJob }>(
      `/api/jobs/${jobId}`,
      { method: 'GET' },
    );
    return raw.job ?? null;
  } catch {
    return null;
  }
}

/** List all jobs. */
export async function listJobs(): Promise<ListJobsResult> {
  try {
    const raw = await apiFetch<{ ok: boolean; jobs: GenerateJob[]; total?: number }>(
      '/api/jobs',
      { method: 'GET' },
    );
    return { ok: true, jobs: raw.jobs ?? [], total: raw.total };
  } catch {
    return { ok: false, jobs: [] };
  }
}

/** List jobs with optional filters. */
export async function listJobsFiltered(filters: ListJobsFilters = {}): Promise<ListJobsResult> {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));
    if (filters.sort) params.set('sort', filters.sort);
    const qs = params.toString();
    const raw = await apiFetch<{ ok: boolean; jobs: GenerateJob[]; total?: number }>(
      `/api/jobs${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
    );
    return { ok: true, jobs: raw.jobs ?? [], total: raw.total, filters };
  } catch {
    return { ok: false, jobs: [] };
  }
}

/** Get single job detail. */
export async function getJobDetail(jobId: string): Promise<GenerateJob | null> {
  try {
    const raw = await apiFetch<{ ok: boolean; job: GenerateJob }>(
      `/api/jobs/${jobId}`,
      { method: 'GET' },
    );
    return raw.job ?? null;
  } catch {
    return null;
  }
}

/** Delete a job record (does not delete audio files). */
export async function deleteJob(jobId: string): Promise<DeleteJobResult> {
  try {
    const raw = await apiFetch<{ ok: boolean; deleted?: boolean; jobId?: string }>(
      `/api/jobs/${jobId}`,
      { method: 'DELETE' },
    );
    return { ok: true, deleted: raw.deleted, jobId: raw.jobId };
  } catch (err) {
    return { ok: false, error: safeApiError(err) };
  }
}

/** Retry a failed or cancelled job. */
export async function retryJob(jobId: string): Promise<RetryJobResult> {
  try {
    const raw = await apiFetch<{
      ok: boolean;
      job?: GenerateJob;
      message?: string;
    }>(`/api/jobs/${jobId}/retry`, { method: 'POST' });
    return { ok: true, job: raw.job, message: raw.message };
  } catch (err) {
    return { ok: false, error: safeApiError(err) };
  }
}

/** Get job queue statistics. */
export async function getJobStats(): Promise<JobStatsResult> {
  try {
    const raw = await apiFetch<{ ok: boolean; stats: JobStats }>(
      '/api/jobs/stats',
      { method: 'GET' },
    );
    return { ok: true, stats: raw.stats };
  } catch (err) {
    return { ok: false, error: safeApiError(err) };
  }
}

/** Cancel a running/queued job. */
export async function cancelJob(jobId: string): Promise<CancelJobResult> {
  try {
    const raw = await apiFetch<{ ok: boolean; jobId: string; cancelled: boolean }>(
      `/api/jobs/${jobId}/cancel`,
      { method: 'POST' },
    );
    return { ok: true, jobId: raw.jobId, cancelled: raw.cancelled };
  } catch (err) {
    return { ok: false, error: safeApiError(err) };
  }
}

/** Get audit log statistics (Phase 4F). */
export async function getAuditStats(): Promise<{ ok: boolean; stats?: Record<string, number>; authGuard?: Record<string, unknown> }> {
  try {
    const raw = await apiFetch<{ ok: boolean; stats: Record<string, number>; authGuard: Record<string, unknown> }>(
      '/api/audit/stats',
      { method: 'GET' },
    );
    return { ok: true, stats: raw.stats, authGuard: raw.authGuard };
  } catch {
    return { ok: false };
  }
}
