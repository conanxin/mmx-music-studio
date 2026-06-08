/**
 * Server-side types — shared between server modules.
 * No API keys, no Authorization headers.
 *
 * Note: MusicGenerationInput is not imported from core here to keep
 * server/types.ts standalone. Inline the minimal subset needed.
 */

import type { PreviewAccessConfig } from './security.js';
import type { GenerationAccessConfig } from './auth.js';
import type { RateLimitConfig, DailyQuotaConfig, RealApiAttemptConfig } from './rate-limit.js';

export type KeyMode = 'server' | 'session';

export type BackendMode = 'mock' | 'api' | 'cli';

export interface ServerConfig {
  port: number;
  minimaxApiKey: string | undefined;
  minimaxRegion: 'cn' | 'global';
  outputDir: string;
  demoMode: boolean;
  realGenerationEnabled: boolean;
  mockGenerationEnabled: boolean;
  backend: BackendMode;
  maxRequestBodyMb: number;
  previewAccess: PreviewAccessConfig;
  generationAccess: GenerationAccessConfig;
  rateLimit: RateLimitConfig;
  dailyQuota: DailyQuotaConfig;
  /** Phase 5B-C: Real API Attempt Guard — limits actual MiniMax API calls before they happen */
  realApiAttempt: RealApiAttemptConfig;
  /** BYOK: allow users to supply their own API key via x-minimax-api-key header */
  byokEnabled: boolean;
  /** BYOK: if true, fall back to server MINIMAX_API_KEY when no session key provided */
  serverKeyFallback: boolean;
  /** BYOK: storage method for session keys */
  byokKeyStorage: 'memory';
}

export type GenerationSource = 'mock' | 'minimax' | 'mmx-cli';

export interface TrackMetadata {
  id: string;
  title: string;
  mode: string;
  model: string;
  prompt: string;
  lyrics?: string;
  status: 'success' | 'failed';
  audioFileName: string;
  audioMimeType: string;
  audioFormat: string;
  durationMs?: number;
  durationText?: string;
  sampleRate?: number;
  bitrate?: number;
  sizeBytes?: number;
  traceId?: string;
  generationSource: GenerationSource;
  createdAt: string;
}

export interface Manifest {
  version: 1;
  tracks: TrackMetadata[];
}

export interface GenerateRequest {
  input: {
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
  };
  keyMode: KeyMode;
  region?: 'cn' | 'global';
}

// ── Structured error types ─────────────────────────────────────────────────────

export type ServerErrorType =
  | 'validation'
  | 'missing_api_key'
  | 'real_generation_disabled'
  | 'guard'
  | 'minimax_api'
  | 'audio_download'
  | 'storage'
  | 'network'
  | 'security'
  | 'generation'
  | 'rate_limit_exceeded'
  | 'daily_quota_exceeded'
  | 'generation_access_required'
  | 'unknown';

export interface ServerError {
  ok: false;
  error: {
    type: ServerErrorType;
    message: string;
    hint?: string;
    requestId?: string;
  };
}
