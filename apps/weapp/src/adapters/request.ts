/**
 * apps/weapp/src/adapters/request.ts
 * 微信小程序 HTTP 请求适配层
 *
 * 安全原则：
 * - 不发送 API key / token / secret
 * - 不发送 x-minimax-api-key header
 * - 不把错误对象中的敏感字段输出
 * - 中文错误文案
 */

// @ts-ignore Taro types have internal esModuleInterop issues — ignored via skipLibCheck
import Taro from '@tarojs/taro';
import { getEffectiveApiBase, DEFAULT_API_BASE } from '../config/api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthInfo {
  ok: boolean;
  backend: string;
  realGenerationEnabled: boolean;
  mockGenerationEnabled: boolean;
  previewAccessEnabled: boolean;
  previewAccessUnlocked: boolean;
  region: string;
  hasServerKey: boolean;
  hasUserKey: boolean;
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

// ── Core request ─────────────────────────────────────────────────────────────

async function requestJson<T = Record<string, unknown>>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: Record<string, unknown>;
    timeout?: number;
  } = {},
): Promise<T> {
  const { method = 'GET', body, timeout = 120_000 } = options;
  const apiBase = getEffectiveApiBase();

  let fullUrl: string;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    fullUrl = path;
  } else {
    fullUrl = `${apiBase}${path}`;
  }

  const headerMap: Record<string, string> = {
    'Content-Type': 'application/json',
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

/** POST /api/generate — 使用 Server Mock（不消耗额度） */
export async function generateTrack(
  input: GenerateInput,
): Promise<GenerateResponse> {
  const payload = {
    input,
    keyMode: 'server' as const,
  };

  try {
    const res = await requestJson<GenerateResponse>('/api/generate', {
      method: 'POST',
      body: payload,
    });
    return res;
  } catch (err) {
    // 不暴露内部错误细节
    const msg = err instanceof Error ? err.message : '生成请求失败';
    throw new Error(`后端生成失败：${msg}`);
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

/** GET /api/tracks/:id */
export async function getTrack(id: string): Promise<ServerTrack | null> {
  try {
    const res = await requestJson<{ ok: boolean; track: ServerTrack }>(`/api/tracks/${id}`);
    return res.track ?? null;
  } catch {
    return null;
  }
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