/**
 * apps/weapp/src/adapters/request.ts
 * 微信小程序 HTTP 请求适配层
 *
 * 安全原则：
 * - 不发送 API key / token / secret in URL / body / logs
 * - 不把错误对象中的敏感字段输出
 * - 中文错误文案
 *
 * Phase 5C: BYOK 支持
 * - x-minimax-api-key header 仅用于 session key
 * - body 不含 apiKey 字段
 */

// @ts-ignore Taro types have internal esModuleInterop issues — ignored via skipLibCheck
import Taro from '@tarojs/taro';
import { getEffectiveApiBase } from '../config/api';
import { getSessionApiKey } from './byok';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthInfo {
  ok: boolean;
  backend: string;
  realGenerationEnabled: boolean;
  mockGenerationEnabled: boolean;
  previewAccessEnabled: boolean;
  previewAccessUnlocked: boolean;
  generationAccessEnabled: boolean;
  generationAccessUnlocked: boolean;
  rateLimitEnabled: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  dailyQuotaEnabled: boolean;
  dailyGenerationLimit: number;
  dailyGenerationUsed: number;
  remainingDailyGenerations: number;
  region: string;
  hasServerKey: boolean;
  hasUserKey: boolean;
  byokEnabled: boolean;
  hasSessionKey: boolean;
}

export interface ServerTrack {
  id: string;
  title: string;
  mode: string;
  model: string;
  prompt: string;
  lyrics?: string;
  audioUrl: string;
  downloadUrl: string;
  durationText: string;
  durationMs: number;
  generationSource: string;
  createdAt: string;
  sizeBytes?: number;
}

export interface GenerateInput {
  mode: string;
  prompt?: string;
  lyrics?: string;
  audioUrl?: string;
  audioBase64?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  model?: string;
  outputFormat?: string;
  audioDurationS?: number;
  region?: string;
}

export interface GenerateResponse {
  ok: boolean;
  track: ServerTrack;
  generationSource: string;
}

export interface TracksResponse {
  ok: boolean;
  tracks: ServerTrack[];
  total: number;
}

export interface ApiError {
  ok: false;
  error: {
    type: string;
    message: string;
    hint?: string;
  };
}

// ── Job queue types (Phase 4B) ────────────────────────────────────────────────

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobJob {
  id: string;
  status: JobStatus;
  progress?: number;
  progressMessage?: string;
  track?: ServerTrack;
  error?: { type?: string; message: string; hint?: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateJobResponse {
  ok: boolean;
  job?: JobJob;
  track?: ServerTrack; // legacy sync format compatibility
  error?: { type?: string; message: string };
}

export interface GetJobResponse {
  ok: boolean;
  job: JobJob;
}

export interface ListJobsResponse {
  ok: boolean;
  jobs: JobJob[];
  total?: number;
}

export interface CancelJobResponse {
  ok: boolean;
  jobId: string;
  cancelled: boolean;
}

// Phase 4D types
export interface ListJobsFilters {
  status?: JobStatus;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: 'newest' | 'oldest';
}

export interface DeleteJobResponse {
  ok: boolean;
  deleted?: boolean;
  jobId?: string;
}

export interface RetryJobResponse {
  ok: boolean;
  job?: JobJob;
  message?: string;
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

export interface JobStatsResponse {
  ok: boolean;
  stats: JobStats;
}

// ── BYOK headers (Phase 5C) ────────────────────────────────────────────────

/**
 * Get HTTP headers for BYOK session key.
 * Returns an object with x-minimax-api-key if a session key is set.
 * Does NOT log the key value.
 */
export function getByokHeaders(): Record<string, string> {
  const key = getSessionApiKey()
  if (!key) return {}
  return { 'x-minimax-api-key': key }
}

// ── Core request ─────────────────────────────────────────────────────────────

async function requestJson<T = Record<string, unknown>>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    timeout?: number;
    extraHeaders?: Record<string, string>;
  } = {},
): Promise<T> {
  const { method = 'GET', body, timeout = 120_000, extraHeaders = {} } = options;
  const apiBase = getEffectiveApiBase();

  let fullUrl: string;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    fullUrl = path;
  } else {
    fullUrl = `${apiBase}${path}`;
  }

  const headerMap: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestOptions: any = {
    url: fullUrl,
    method,
    header: headerMap,
    timeout,
    data: body ? JSON.stringify(body) : undefined,
    mode: 'cors',
  };

  const res = await Taro.request(requestOptions);

  if (res.statusCode < 200 || res.statusCode >= 300) {
    // 尝试解析错误体
    let msg = `HTTP ${res.statusCode}`;
    try {
      const errBody = JSON.parse(res.data as string) as ApiError;
      msg = errBody.error?.message ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return JSON.parse(res.data as string) as T;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** GET /api/health */
export async function getHealth(): Promise<HealthInfo> {
  try {
    return await requestJson<HealthInfo>('/api/health');
  } catch {
    throw new Error('无法连接后端服务');
  }
}

/** POST /api/generate — Phase 5C: supports BYOK via x-minimax-api-key header
 *
 * - Body does NOT contain apiKey field
 * - BYOK key sent via x-minimax-api-key HTTP header (via getByokHeaders())
 * - mock mode: key not required
 */
export async function generateTrack(
  input: GenerateInput,
): Promise<GenerateResponse> {
  // Body intentionally does NOT include apiKey — key goes in header only
  const payload = {
    input,
    keyMode: 'server' as const,
  };

  try {
    const res = await requestJson<GenerateResponse>('/api/generate', {
      method: 'POST',
      body: payload,
      extraHeaders: getByokHeaders(),
    });
    return res;
  } catch (err) {
    // Provide Chinese-friendly error messages without exposing internal details
    const errMsg = err instanceof Error ? err.message : '生成请求失败';
    // Try to extract JSON error body from message
    let msg = '生成请求失败';
    const colonIdx = errMsg.indexOf('：');
    if (colonIdx >= 0) {
      try {
        const errBody = JSON.parse(errMsg.slice(colonIdx + 1)) as ApiError;
        if (errBody?.error?.type === 'generation_access_required') {
          msg = '需要生成访问授权，请先在设置中完成解锁';
        } else if (errBody?.error?.type === 'rate_limit_exceeded') {
          msg = '生成请求过于频繁，请稍后再试';
        } else if (errBody?.error?.type === 'daily_quota_exceeded') {
          msg = '今日生成额度已用完';
        } else if (errBody?.error?.type === 'real_api_attempt_limit_exceeded') {
          msg = '真实 API 测试次数已用完，请稍后再试';
        } else if (errBody?.error?.type === 'missing_api_key') {
          msg = '请先在设置页填写 MiniMax Token Plan Key';
        } else if (errBody?.error?.type === 'validation') {
          msg = 'Key 格式不正确，请检查后重新填写';
        } else {
          msg = errBody?.error?.message ?? errMsg;
        }
      } catch {
        msg = errMsg;
      }
    } else {
      msg = errMsg;
    }
    throw new Error(msg);
  }
}

/** GET /api/tracks */
export async function listTracks(): Promise<ServerTrack[]> {
  try {
    const res = await requestJson<TracksResponse>('/api/tracks');
    return res.tracks ?? [];
  } catch {
    return [];
  }
}

// ── Job queue API (Phase 4B) ────────────────────────────────────────────────

/**
 * GET /api/jobs — list all jobs.
 * Compatible with both async (job) and sync (track) server responses.
 */
export async function listJobs(): Promise<JobJob[]> {
  try {
    const res = await requestJson<ListJobsResponse>('/api/jobs');
    return res.jobs ?? [];
  } catch {
    return [];
  }
}

/**
 * GET /api/jobs/:id — poll job status.
 */
export async function getJob(jobId: string): Promise<JobJob | null> {
  try {
    const res = await requestJson<GetJobResponse>(`/api/jobs/${jobId}`);
    return res.job ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/jobs/:id/cancel — cancel a queued/running job.
 */
export async function cancelJob(jobId: string): Promise<{ cancelled: boolean }> {
  try {
    const res = await requestJson<CancelJobResponse>(`/api/jobs/${jobId}/cancel`);
    return { cancelled: res.cancelled };
  } catch {
    return { cancelled: false };
  }
}

/** GET /api/tracks/:id */
export async function getTrack(id: string): Promise<ServerTrack | null> {
  try {
    const res = await requestJson<{ ok: boolean; track: ServerTrack }>(`/api/tracks/${id}`);
    return res.track ?? null;
  } catch {
    return null;
  }
}

/** Phase 4D: GET /api/jobs?status&search&limit&offset&sort */
export async function listJobsFiltered(filters: ListJobsFilters = {}): Promise<{ ok: boolean; jobs: JobJob[]; total?: number }> {
  try {
    const params: string[] = [];
    if (filters.status) params.push(`status=${filters.status}`);
    if (filters.search) params.push(`search=${encodeURIComponent(filters.search)}`);
    if (filters.limit) params.push(`limit=${filters.limit}`);
    if (filters.offset) params.push(`offset=${filters.offset}`);
    if (filters.sort) params.push(`sort=${filters.sort}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    const res = await requestJson<ListJobsResponse>(`/api/jobs${qs}`);
    return { ok: true, jobs: res.jobs ?? [], total: res.total };
  } catch {
    return { ok: false, jobs: [] };
  }
}

/** Phase 4D: DELETE /api/jobs/:id — delete job record (not audio) */
export async function deleteJob(jobId: string): Promise<{ ok: boolean; deleted?: boolean }> {
  try {
    const res = await requestJson<DeleteJobResponse>(`/api/jobs/${jobId}`, { method: 'DELETE' });
    return { ok: true, deleted: res.deleted };
  } catch {
    return { ok: false };
  }
}

/** Phase 4D: POST /api/jobs/:id/retry — retry failed/cancelled job */
export async function retryJob(jobId: string): Promise<{ ok: boolean; job?: JobJob }> {
  try {
    const res = await requestJson<RetryJobResponse>(`/api/jobs/${jobId}/retry`, { method: 'POST' });
    return { ok: true, job: res.job };
  } catch {
    return { ok: false };
  }
}

/** Phase 4D: GET /api/jobs/stats */
export async function getJobStats(): Promise<JobStatsResponse> {
  return requestJson<JobStatsResponse>('/api/jobs/stats');
}

/** 获取 track 音频 URL（相对路径 → 拼接 apiBase） */
export function getTrackAudioUrl(id: string): string {
  return `${getEffectiveApiBase()}/api/tracks/${id}/audio`;
}

/** 获取 track 下载 URL（相对路径 → 拼接 apiBase） */
export function getTrackDownloadUrl(id: string): string {
  return `${getEffectiveApiBase()}/api/tracks/${id}/download`;
}

/** 测试连接：只调用 health */
export async function testConnection(): Promise<{ ok: boolean; info?: HealthInfo; error?: string }> {
  try {
    const info = await getHealth();
    return { ok: true, info };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '连接失败';
    return { ok: false, error: msg };
  }
}