/**
 * MiniMax API Adapter — platform-agnostic HTTP client for music generation.
 * No React/DOM/BOM dependencies. Suitable for both Web and future WeApp.
 *
 * Security:
 * - Never logs Authorization header
 * - Never logs API key
 * - Never persists raw response containing keys
 */

import type { MiniMaxMusicApiResult, MusicGenerationInput, MiniMaxRegion } from '../../../core/src/types.js';
import { buildMiniMaxMusicPayload } from '../../../core/src/request-builder.js';
import { normalizeMiniMaxMusicResponse } from './response.js';
import { MiniMaxApiError } from './errors.js';

export interface CallMiniMaxOptions {
  apiKey: string;
  region?: MiniMaxRegion;
  outputFormat?: 'url' | 'hex';
  signal?: AbortSignal;
}

const ENDPOINTS = {
  cn: 'https://api.minimaxi.com/v1/music_generation',
  global: 'https://api.minimax.io/v1/music_generation',
} as const;

/**
 * Call MiniMax music_generation API.
 * Does NOT log the API key or Authorization header.
 */
export async function callMiniMaxMusicGeneration(
  input: Parameters<typeof buildMiniMaxMusicPayload>[0],
  options: CallMiniMaxOptions,
): Promise<MiniMaxMusicApiResult> {
  const { apiKey, region = 'cn', outputFormat = 'url', signal } = options;

  const payload = buildMiniMaxMusicPayload(input);

  // Inject output_format so server immediately gets a URL (not hex)
  if (!payload.output_format) {
    payload.output_format = outputFormat;
  }

  const endpoint = ENDPOINTS[region];
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    // network error: ECONNREFUSED, timeout, etc.
    throw new MiniMaxApiError(
      `网络请求失败: ${(err as Error).message}`,
      'NETWORK_ERROR',
      undefined,
      undefined,
    );
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body.base_resp?.status_msg) {
        message = body.base_resp.status_msg;
      }
    } catch {
      // ignore parse error
    }
    throw new MiniMaxApiError(
      `MiniMax API 错误: ${message}`,
      'HTTP_ERROR',
      response.status,
      undefined,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new MiniMaxApiError(
      '响应解析失败：返回内容不是有效 JSON',
      'PARSE_ERROR',
      response.status,
      undefined,
    );
  }

  // Check base_resp status
  const asRecord = raw as Record<string, unknown>;
  if (
    asRecord.base_resp &&
    (asRecord.base_resp as Record<string, unknown>).status_code !== 0
  ) {
    const br = asRecord.base_resp as Record<string, unknown>;
    throw new MiniMaxApiError(
      `MiniMax 返回错误: ${br.status_msg ?? br.status_code}`,
      'MINIMAX_ERROR',
      response.status,
      (asRecord.trace_id as string) || undefined,
    );
  }

  return normalizeMiniMaxMusicResponse(raw);
}