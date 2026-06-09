/**
 * server/call-minimax.ts — Standalone MiniMax API caller.
 * Extracted from index.ts to avoid circular imports with jobs.ts.
 * Never logs API keys or Authorization headers.
 */

import { buildMiniMaxMusicPayload } from './core-wrapper.js';
import { parseMiniMaxMusicResponse, parsedToResult } from './adapters/minimax-api/response.js';

const MINIMAX_ENDPOINTS = {
  cn: 'https://api.minimaxi.com/v1/music_generation',
  global: 'https://api.minimax.io/v1/music_generation',
};

export interface MiniMaxResult {
  audioKind: 'url' | 'hex' | 'unknown';
  audioValue: string;
  durationMs?: number;
  sampleRate?: number;
  bitrate?: number;
  sizeBytes?: number;
  traceId?: string;
}

export async function callMiniMaxApi(params: {
  apiKey: string;
  region: 'cn' | 'global';
  payload: ReturnType<typeof buildMiniMaxMusicPayload>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<MiniMaxResult> {
  const endpoint = MINIMAX_ENDPOINTS[params.region];
  const body: Record<string, unknown> = { ...params.payload.payload, output_format: 'url' };

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = params.timeoutMs ?? 120000;
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

  // ── Structured response parsing ─────────────────────────────────────────
  const parsed = parseMiniMaxMusicResponse(raw);

  // async_task, failure, unknown all throw here — only direct/hex continue
  return parsedToResult(parsed);
}