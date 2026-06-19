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
import type { LaunchGuardConfig } from './launch-guard.js';

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
  /** Phase Launch Guard-A: Public generation guardrails */
  launchGuard: LaunchGuardConfig;
  /** BYOK: allow users to supply their own API key via x-minimax-api-key header */
  byokEnabled: boolean;
  /** BYOK: if true, fall back to server MINIMAX_API_KEY when no session key provided */
  serverKeyFallback: boolean;
  /** BYOK: storage method for session keys */
  byokKeyStorage: 'memory';
  /**
   * Phase BYOK-A: separate kill switch for the PUBLIC BYOK relay
   * endpoint /api/generate/byok. Distinct from byokEnabled
   * (admin internal). Default false. When false, endpoint returns
   * 403 byok_generation_disabled.
   */
  publicByokEnabled: boolean;
 /**
 * BYOK_DRY_RUN_ONLY — when true, /api/generate/byok returns
 * 200 byok_dry_run_only instead of calling the provider. Default true
 * so that even if PUBLIC_BYOK_ENABLED is on, the public endpoint does
 * not call the provider unless an operator explicitly turns dry-run
 * off.
 */
 byokDryRunOnly: boolean;
 /**
 * BYOK_LIVE_ENABLED — must be true to even consider live relay.
 * Default false. Independent from publicByokEnabled.
 */
 byokLiveEnabled: boolean;
 /**
 * BYOK_LIVE_CONFIRMATION — exact-match confirmation phrase that must
 * equal BYOK_LIVE_CONFIRMATION_PHRASE for live mode to be allowed.
 * Default empty string. The route layer refuses to call the live
 * adapter unless this matches exactly.
 */
 byokLiveConfirmation: string;
  /**
   * Phase BYOK-F: Direct HTTPS API relay live gate.
   * Default false. Requires explicit operator confirmation.
   */
  byokDirectLiveEnabled: boolean;
  /**
   * Phase BYOK-F: Exact-match confirmation phrase for direct live mode.
   * Must equal CONFIRM_BYOK_DIRECT_LIVE_TEST.
   */
  byokDirectLiveConfirmation: string;
  /**
   * Phase Deploy-CF-D: Turnstile protection for BYOK generation.
   * Default false — non-blocking until operator explicitly enables.
   */
  turnstileByokRequired: boolean;
  /**
   * Phase Deploy-CF-D: Whether TURNSTILE_SECRET_KEY is configured.
   * Exposed in /api/health (boolean only, never the secret value).
   */
  turnstileSecretKeyConfigured: boolean;
  /**
   * Phase Deploy-CF-D: Turnstile site key (safe to expose to frontend).
   */
  turnstileSiteKey?: string;
  /**
   * P3C-3: five-user invite/session access gate.
   * Default false. When false or when the secret is missing, routes keep the
   * anonymous/default workspace behavior.
   */
  multiuserAccessEnabled: boolean;
  /**
   * P3C-3: server-only signing secret for invite session cookies.
   * Never expose through health, logs, manifests, or client responses.
   */
  multiuserSessionSecret?: string;
  /**
   * P3C-3: optional local fixture/store directory for invite/session JSON.
   * Defaults to storage/access when explicitly enabled.
   */
  multiuserAccessStoreDir?: string;
  /**
   * P3C-4: invite session route gate for mutating/costly actions.
   * Default false to preserve current production behavior.
   */
  multiuserRouteGateEnabled: boolean;
}

export type GenerationSource = 'mock' | 'minimax' | 'mmx-cli' | 'byok-direct-live';

export interface ByokDirectLiveProvenance {
  mode: 'direct-live';
  persistedFrom: 'provider-url';
  requestId: string;
  providerTaskId?: string;
  idempotencyKey: string;
}

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
  provider?: 'minimax';
  requestId?: string;
  providerTaskId?: string;
  generationIntent?: 'instrumental' | 'with_lyrics';
  workspaceId?: string;
  ownerUserId?: string;
  visibility?: 'private' | 'workspace' | 'demo';
  byok?: ByokDirectLiveProvenance;
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
  | 'public_generation_paused'
  | 'per_source_daily_limit_exceeded'
  | 'generation_cooldown_active'
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
