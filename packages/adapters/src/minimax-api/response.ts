/**
 * MiniMax API response normalization.
 * Handles URL, hex audio, and various field name variants.
 */

import type { MiniMaxMusicApiResult } from '@mmx-music-studio/core';

export function normalizeMiniMaxMusicResponse(
  raw: unknown,
): MiniMaxMusicApiResult {
  const obj = raw as Record<string, unknown>;

  // --- audio field resolution ---
  // Field names vary across API versions
  const audioRaw = obj.data
    ? (obj.data as Record<string, unknown>)
    : obj;

  let audioKind: 'url' | 'hex' | 'unknown' = 'unknown';
  let audioValue = '';

  if (typeof audioRaw.audio === 'string' && audioRaw.audio.length > 0) {
    audioValue = audioRaw.audio;
    if (isProbablyUrl(audioValue)) {
      audioKind = 'url';
    } else if (isProbablyHexAudio(audioValue)) {
      audioKind = 'hex';
    }
  } else if (typeof audioRaw.audio_url === 'string') {
    audioValue = audioRaw.audio_url;
    audioKind = 'url';
  } else if (typeof audioRaw.url === 'string') {
    audioValue = audioRaw.url;
    audioKind = 'url';
  }

  // --- extra_info ---
  const extraInfo = audioRaw.extra_info as Record<string, unknown> | undefined;
  const durationRaw = extraInfo?.music_duration ?? extraInfo?.duration;
  const durationMs =
    typeof durationRaw === 'number'
      ? Math.round(durationRaw * 1000)
      : undefined;

  const sampleRate = extraInfo?.music_sample_rate as number | undefined;
  const bitrate = extraInfo?.bitrate as number | undefined;
  const channels = extraInfo?.music_channel as number | undefined;
  const sizeBytes = extraInfo?.music_size as number | undefined;

  // --- base_resp ---
  const baseResp = obj.base_resp as Record<string, unknown> | undefined;

  return {
    traceId: typeof obj.trace_id === 'string' ? obj.trace_id : undefined,
    statusCode: (baseResp?.status_code as number) ?? (obj.code as number) ?? 0,
    statusMessage:
      (baseResp?.status_msg as string) ||
      (obj.msg as string) ||
      'ok',
    audio: {
      kind: audioKind,
      value: audioValue,
    },
    extraInfo: {
      durationMs,
      sampleRate,
      bitrate,
      channels,
      sizeBytes,
    },
    // NOTE: raw is not stored to disk — only in-memory return value
    raw: undefined,
  };
}

function isProbablyUrl(value: string): boolean {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//')
  );
}

function isProbablyHexAudio(value: string): boolean {
  // Hex audio is 2+ chars, only [0-9a-fA-F], no spaces, no URL chars
  if (value.length < 32) return false;
  return /^[0-9a-fA-F\s]+$/.test(value) && !value.includes('://');
}