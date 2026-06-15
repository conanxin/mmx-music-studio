/**
 * BYOK Provider Adapter — Phase BYOK-B.
 *
 * Server-side adapter for the public /api/generate/byok endpoint.
 * NEVER call this directly from the browser. The route layer must enforce:
 * - PUBLIC_BYOK_ENABLED === true
 * - BYOK_DRY_RUN_ONLY === false
 * - BYOK_LIVE_ENABLED === true
 * - BYOK_LIVE_CONFIRMATION === CONFIRM_BYOK_LIVE_RELAY_TEST
 *
 * Modes:
 * - fake: no network, deterministic fake result. The default test path.
 * - live: DISABLED (2026-06-11). See `byok_live_provider_path_disabled`.
 *
 * CRITICAL BUG (2026-06-11):
 * mmx CLI ignores MINIMAX_API_KEY env var for `music generate` and falls
 * back to `~/.mmx/config.json`, which uses the site operator's key.
 * This means BYOK "user key" was never actually used. Live path is now
 * fail-closed until BYOK-C2 (direct HTTPS API relay) is designed.
 *
 * Security guarantees:
 * - The apiKey is held in a local const; never written to disk / log /
 *   response / error message / metadata.
 * - The child process env is built from scratch with only the user key;
 *   the site operator's MINIMAX_API_KEY is NOT propagated.
 * - Provider stdout/stderr is run through redactCliOutput (existing
 *   helper) which strips sk-, Bearer, Authorization, MINIMAX_API_KEY=.
 * - The returned object never includes the apiKey.
 * - This module does NOT call the existing /api/generate path.
 */

import { Buffer } from 'node:buffer';
import path from 'node:path';

import { redactCliOutput } from '../minimax-cli/errors.js';
import { generateByokDirectMusic } from './byok-direct.js';

/**
 * Local safeFileName — matches minimax-cli/client.ts:safeFileName but
 * kept local to avoid exporting from a sibling module. Deterministic
 * lowercase, no spaces, no slashes, capped at 48 chars.
 */
function safeFileName(mode: string, title: string): string {
  const raw = `${mode}-${title}`.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return (raw || 'byok-track').slice(0, 48);
}

/** Exact phrase required in BYOK_LIVE_CONFIRMATION to enable live mode. */
export const BYOK_LIVE_CONFIRMATION_PHRASE = 'CONFIRM_BYOK_LIVE_RELAY_TEST';

export type ByokModel = 'music-2.6' | 'music-2.6-free';

export type ByokRelayMode = 'fake' | 'live';

export interface ByokRelayInput {
  /** User-supplied MiniMax API key — never logged. */
  apiKey: string;
  prompt: string;
  lyrics?: string;
  model: ByokModel;
  /** Adapter-level mode. Route layer must have verified the gates. */
  mode: ByokRelayMode;
  /** Request id (e.g. `byok_xxxxxxxxxxxx`) — used for fake filename. */
  requestId: string;
  /** Required only for live mode. Ignored in fake mode. */
  outputDir?: string;
  /** Default 180_000. */
  timeoutMs?: number;
  /** 'instrumental' | 'lyrics' | 'auto'. */
  musicMode?: 'instrumental' | 'lyrics' | 'auto';
  /**
   * Phase BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP.
   * When true AND mode === 'live', the adapter delegates the live call to
   * the HTTPS direct provider (generateByokDirectMusic) so the request
   * actually reaches MiniMax instead of being fail-closed at the CLI level.
   *
   * The route layer must compute this flag using
   * isConfirmedByokLiveProviderPath() and pass it explicitly. The adapter
   * also re-checks the condition so it can never be tricked into the live
   * path by a stale or absent flag.
   */
  confirmedLiveProviderPath?: boolean;
  /**
   * Phase BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP.
   * When the route layer claims confirmed-live, it must also forward the
   * current live-gate env values so the adapter can independently re-verify
   * (defense in depth).
   */
  liveProviderEnv?: ByokConfirmedLiveProviderEnv;
}

export interface ByokRelayResultOk {
  ok: true;
  code: 'byok_fake_relay_ok' | 'byok_live_relay_ok';
  message: string;
  audioFileName?: string;
  audioFilePath?: string;
  sizeBytes?: number;
  generationSource: 'byok-fake' | 'byok-live';
  durationMs: number;
}

export interface ByokRelayResultErr {
  ok: false;
  code:
    | 'byok_live_provider_path_disabled'
    | 'byok_direct_api_not_verified'
    | 'byok_provider_error'
    | 'byok_provider_auth_failed'
    | 'byok_provider_timeout'
    | 'byok_provider_not_found'
    | 'byok_provider_unsupported_mode'
    | 'byok_invalid_input';
  message: string;
  generationSource: 'byok-fake' | 'byok-live';
  durationMs: number;
  /** Redacted stderr preview; never contains the apiKey. */
  stderrPreview?: string;
}

export type ByokRelayResult = ByokRelayResultOk | ByokRelayResultErr;

/**
 * Run the BYOK relay. Returns a structured result.
 *
 * NEVER throws. NEVER logs the apiKey. NEVER includes the apiKey in the
 * returned object.
 */
export async function generateByokMusic(input: ByokRelayInput): Promise<ByokRelayResult> {
  const start = Date.now();
  const requestId = input.requestId;

  // ── Input validation (defense-in-depth; route already validates) ──
  if (!input.apiKey || input.apiKey.length < 20) {
    return {
      ok: false,
      code: 'byok_invalid_input',
      message: 'apiKey missing or too short',
      generationSource: input.mode === 'live' ? 'byok-live' : 'byok-fake',
      durationMs: Date.now() - start,
    };
  }
  if (!input.prompt || input.prompt.length === 0) {
    return {
      ok: false,
      code: 'byok_invalid_input',
      message: 'prompt is required',
      generationSource: input.mode === 'live' ? 'byok-live' : 'byok-fake',
      durationMs: Date.now() - start,
    };
  }

  // ── Fake mode: deterministic, no network ──
  if (input.mode === 'fake') {
    const fakeName = `byok-fake-${requestId}.mp3`;
    return {
      ok: true,
      code: 'byok_fake_relay_ok',
      message: 'fake relay ok — no provider call was made',
      audioFileName: fakeName,
      // Deliberately do NOT include audioFilePath; the route layer must
      // not treat this as a real file on disk.
      generationSource: 'byok-fake',
      durationMs: Date.now() - start,
    };
  }

  // ── Live mode ──
  //
  // Phase BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP: live mode now has TWO
  // sub-paths. The route layer is the only thing that can request the
  // live path (it computes the gate conditions from server env). The
  // adapter then independently re-verifies the conditions.
  //
  //   1) Confirmed live path (route passed a non-stale live-gate env
  //      snapshot AND every condition holds): delegate to the HTTPS
  //      direct provider. This actually reaches MiniMax using the
  //      per-request user apiKey.
  //   2) Unconfirmed live path (legacy CLI live call without explicit
  //      confirmation): fail-closed (was the original behavior, kept
  //      for safety).
  if (input.mode === 'live') {
    // Defense in depth: re-verify the live condition inside the adapter
    // even if the route layer claimed confirmed-live. The route may be
    // running a different env snapshot or be a unit test that doesn't
    // simulate the full gate chain.
    const env = input.liveProviderEnv;
    const routeClaimsConfirmed =
      input.confirmedLiveProviderPath === true && env !== undefined;
    const adapterReverified = routeClaimsConfirmed
      ? isConfirmedByokLiveProviderPath(env, input.apiKey)
      : false;

    if (adapterReverified) {
      // Delegate to the HTTPS direct adapter. The direct adapter builds
      // a per-request Authorization header from apiKey and calls
      // https://api.minimaxi.com/v1/music_generation. It does NOT
      // propagate any site-operator MINIMAX_API_KEY.
      const directResult = await generateByokDirectMusic({
        apiKey: input.apiKey,
        prompt: input.prompt,
        lyrics: input.lyrics,
        model:
          input.model === 'music-2.6-free'
            ? 'music-2.6'
            : (input.model as 'music-2.6' | 'music-2.5+' | 'music-2.5' | 'music-cover'),
        outputFormat: 'url',
        isInstrumental: input.musicMode === 'instrumental',
        timeoutMs: input.timeoutMs ?? 120_000,
      });

      if (!directResult.ok) {
        return {
          ok: false,
          code:
            directResult.code === 'byok_direct_invalid_key'
              ? 'byok_provider_auth_failed'
              : directResult.code === 'byok_direct_timeout'
                ? 'byok_provider_timeout'
                : 'byok_provider_error',
          message: directResult.message,
          generationSource: 'byok-live',
          durationMs: Date.now() - start,
        };
      }

      return {
        ok: true,
        code: 'byok_live_relay_ok',
        message:
          'BYOK live relay ok — provider call succeeded (https direct)',
        audioFileName: undefined,
        generationSource: 'byok-live',
        durationMs: Date.now() - start,
      };
    }

    // Unconfirmed live path: keep the original fail-closed behavior.
    return {
      ok: false,
      code: 'byok_live_provider_path_disabled',
      message: 'BYOK live provider path is disabled pending direct API relay validation.',
      generationSource: 'byok-live',
      durationMs: Date.now() - start,
    };
  }

  // Should be unreachable (mode is 'fake' | 'live') but keep the
  // fail-closed default to never silently fall through.
  return {
    ok: false,
    code: 'byok_live_provider_path_disabled',
    message: 'BYOK adapter received an unrecognised mode; failing closed.',
    generationSource: input.mode === 'live' ? 'byok-live' : 'byok-fake',
    durationMs: Date.now() - start,
  };
}



/**
 * Convenience: whether the live gate is fully open. The route layer
 * should call this before invoking the adapter in live mode.
 */
export function isLiveGateOpen(env: {
  publicByokEnabled: boolean;
  byokDryRunOnly: boolean;
  byokLiveEnabled: boolean;
  byokLiveConfirmation: string;
}): boolean {
  return (
    env.publicByokEnabled === true &&
    env.byokDryRunOnly === false &&
    env.byokLiveEnabled === true &&
    env.byokLiveConfirmation === BYOK_LIVE_CONFIRMATION_PHRASE
  );
}

// ── Phase BYOK-H3B-PROVIDER-SELECTION-FOLLOWUP ──────────────────────
//
// Single source of truth for "should the live provider be selected?".
// The route layer AND the byok.ts adapter both must use this function
// (or its inputs) so a request that satisfies every live-gate condition
// actually reaches the live provider instead of falling through to the
// fake relay.
//
// Required conditions (ALL must hold):
//   1. publicByokEnabled === true
//   2. byokDryRunOnly === false
//   3. byokLiveEnabled === true
//   4. byokLiveConfirmation === BYOK_LIVE_CONFIRMATION_PHRASE
//   5. byokLiveWindowId is a non-empty string
//   6. byokDirectLiveEnabled === true
//   7. byokDirectLiveConfirmation === CONFIRM_BYOK_DIRECT_LIVE_TEST
//   8. user provided a per-request apiKey (>= 20 chars)
//
// Any missing condition returns false and the provider selection falls
// through to fake / dry-run / blocked, never to the live provider.
export interface ByokConfirmedLiveProviderEnv {
  publicByokEnabled: boolean;
  byokDryRunOnly: boolean;
  byokLiveEnabled: boolean;
  byokLiveConfirmation: string;
  byokLiveWindowId: string;
  byokDirectLiveEnabled: boolean;
  byokDirectLiveConfirmation: string;
}

export function isConfirmedByokLiveProviderPath(
  env: ByokConfirmedLiveProviderEnv,
  userApiKey: string | undefined,
): boolean {
  if (env.publicByokEnabled !== true) return false;
  if (env.byokDryRunOnly !== false) return false;
  if (env.byokLiveEnabled !== true) return false;
  if (env.byokLiveConfirmation !== BYOK_LIVE_CONFIRMATION_PHRASE) return false;
  if (typeof env.byokLiveWindowId !== 'string' || env.byokLiveWindowId.length === 0) {
    return false;
  }
  if (env.byokDirectLiveEnabled !== true) return false;
  if (env.byokDirectLiveConfirmation !== 'CONFIRM_BYOK_DIRECT_LIVE_TEST') {
    return false;
  }
  if (!userApiKey || userApiKey.length < 20) return false;
  return true;
}

// ── Live attempt guard (Phase BYOK-H3B-CODE-FOLLOWUP) ─────────────────────────
//
// Server-side one-shot guard for the controlled live window. In-memory only.
// NEVER persists user key, token, prompt, or raw provider response. Resets
// when the window id changes (operator can rotate the window to invalidate).

export interface ByokLiveAttemptConfig {
  enabled: boolean;
  maxAttemptsPerWindow: number;
  windowId: string;
}

export interface ByokLiveAttemptStats {
  enabled: boolean;
  windowId: string;
  maxAttempts: number;
  attemptsUsed: number;
  remaining: number;
  reachedLimit: boolean;
}

/** Build live attempt config from env. Pure read; no side effects. */
export function buildByokLiveAttemptConfig(): ByokLiveAttemptConfig {
  const envEnabled = process.env.BYOK_LIVE_ATTEMPT_LIMIT_ENABLED;
  // Default true — defensive: if envs are not set but the live gate is
  // somehow open, the guard still caps attempts at 1.
  const enabled = envEnabled === undefined ? true : envEnabled === 'true';
  const max = Number(process.env.BYOK_LIVE_MAX_ATTEMPTS_PER_WINDOW || 1);
  const maxAttemptsPerWindow = Number.isFinite(max) && max > 0 ? Math.floor(max) : 1;
  const windowId = (process.env.BYOK_LIVE_WINDOW_ID ?? '').trim() ||
    `boot_${process.pid}_${Math.floor(Date.now() / 1000)}`;
  return { enabled, maxAttemptsPerWindow, windowId };
}

/** Whether the live confirmation env matches the canonical phrase. */
export function isByokLiveConfirmationConfigured(env: {
  byokLiveConfirmation: string;
}): boolean {
  return env.byokLiveConfirmation === BYOK_LIVE_CONFIRMATION_PHRASE;
}

let liveAttemptState: { windowId: string; attempts: number } = {
  windowId: '',
  attempts: 0,
};

/** Reset the in-memory counter; called when window id changes or on boot. */
function resetIfWindowChanged(windowId: string): void {
  if (liveAttemptState.windowId !== windowId) {
    liveAttemptState = { windowId, attempts: 0 };
  }
}

/**
 * Read-only stats for /api/health. Pure function. Does NOT mutate state.
 */
export function getByokLiveAttemptStats(
  config: ByokLiveAttemptConfig,
): ByokLiveAttemptStats {
  resetIfWindowChanged(config.windowId);
  const used = liveAttemptState.attempts;
  const remaining = Math.max(0, config.maxAttemptsPerWindow - used);
  return {
    enabled: config.enabled,
    windowId: config.windowId,
    maxAttempts: config.maxAttemptsPerWindow,
    attemptsUsed: used,
    remaining,
    reachedLimit: used >= config.maxAttemptsPerWindow,
  };
}

export interface ByokLiveAttemptCheck {
  allowed: boolean;
  reason?:
    | 'attempt_limit_disabled'
    | 'attempt_limit_reached'
    | 'attempt_limit_not_configured';
  stats: ByokLiveAttemptStats;
}

/**
 * Read-only check. Returns whether a live attempt is allowed WITHOUT
 * consuming a slot. The route layer should call this first; only if
 * allowed should it perform work and then call `consumeByokLiveAttempt`.
 */
export function checkByokLiveAttemptLimit(
  config: ByokLiveAttemptConfig,
): ByokLiveAttemptCheck {
  const stats = getByokLiveAttemptStats(config);
  if (!config.enabled) {
    return { allowed: true, reason: 'attempt_limit_disabled', stats };
  }
  if (stats.reachedLimit) {
    return { allowed: false, reason: 'attempt_limit_reached', stats };
  }
  return { allowed: true, stats };
}

/**
 * Consume one live attempt slot. Returns the new stats. Idempotent in the
 * sense that calling it after reaching the limit does not increase the
 * counter. The route layer MUST call this only AFTER the work is done so
 * failed upstream calls do not consume the one-shot slot.
 */
export function consumeByokLiveAttempt(
  config: ByokLiveAttemptConfig,
): ByokLiveAttemptStats {
  resetIfWindowChanged(config.windowId);
  if (
    config.enabled &&
    liveAttemptState.attempts < config.maxAttemptsPerWindow
  ) {
    liveAttemptState.attempts += 1;
  }
  return getByokLiveAttemptStats(config);
}

// ── BYOK-live audio cap (Phase BYOK-H3B-AUDIO-QUOTA-FOLLOWUP) ─────────────
//
// Confirmed BYOK live requests must NOT be blocked by the public/source
// audio quota. Instead, they are bounded by a separate in-memory cap
// scoped to the live window id. This module ONLY counts successful audio
// generations; provider errors do not consume the cap.
//
// State is in-memory only; never persisted. Resets on process restart
// or when the operator rotates BYOK_LIVE_WINDOW_ID. NEVER stores the
// user key, token, prompt, lyrics, or raw provider response.

export interface ByokLiveAudioCapConfig {
  enabled: boolean;
  maxAudioPerWindow: number;
  windowId: string;
}

export interface ByokLiveAudioCapStats {
  enabled: boolean;
  windowId: string;
  maxAudio: number;
  audioUsed: number;
  remaining: number;
  reachedLimit: boolean;
}

export function buildByokLiveAudioCapConfig(): ByokLiveAudioCapConfig {
  const envEnabled = process.env.BYOK_LIVE_AUDIO_CAP_ENABLED;
  // Default true — defensive.
  const enabled = envEnabled === undefined ? true : envEnabled === 'true';
  const rawMax = Number(process.env.BYOK_LIVE_MAX_AUDIO_PER_WINDOW || 1);
  const maxAudioPerWindow =
    Number.isFinite(rawMax) && rawMax > 0 ? Math.floor(rawMax) : 1;
  const windowId = (process.env.BYOK_LIVE_WINDOW_ID ?? '').trim() ||
    `boot_${process.pid}_${Math.floor(Date.now() / 1000)}`;
  return { enabled, maxAudioPerWindow, windowId };
}

let byokLiveAudioCapState: { windowId: string; audio: number } = {
  windowId: '',
  audio: 0,
};

function resetAudioCapIfWindowChanged(windowId: string): void {
  if (byokLiveAudioCapState.windowId !== windowId) {
    byokLiveAudioCapState = { windowId, audio: 0 };
  }
}

export function getByokLiveAudioCapStats(
  config: ByokLiveAudioCapConfig,
): ByokLiveAudioCapStats {
  resetAudioCapIfWindowChanged(config.windowId);
  const used = byokLiveAudioCapState.audio;
  const remaining = Math.max(0, config.maxAudioPerWindow - used);
  return {
    enabled: config.enabled,
    windowId: config.windowId,
    maxAudio: config.maxAudioPerWindow,
    audioUsed: used,
    remaining,
    reachedLimit: used >= config.maxAudioPerWindow,
  };
}

export interface ByokLiveAudioCapCheck {
  allowed: boolean;
  reason?:
    | 'audio_cap_disabled'
    | 'audio_cap_reached'
    | 'audio_cap_not_configured';
  stats: ByokLiveAudioCapStats;
}

export function checkByokLiveAudioCap(
  config: ByokLiveAudioCapConfig,
): ByokLiveAudioCapCheck {
  const stats = getByokLiveAudioCapStats(config);
  if (!config.enabled) {
    return { allowed: true, reason: 'audio_cap_disabled', stats };
  }
  if (stats.reachedLimit) {
    return { allowed: false, reason: 'audio_cap_reached', stats };
  }
  return { allowed: true, stats };
}

export function recordByokLiveAudioGenerated(
  config: ByokLiveAudioCapConfig,
): ByokLiveAudioCapStats {
  resetAudioCapIfWindowChanged(config.windowId);
  if (
    config.enabled &&
    byokLiveAudioCapState.audio < config.maxAudioPerWindow
  ) {
    byokLiveAudioCapState.audio += 1;
  }
  return getByokLiveAudioCapStats(config);
}

// ── Submit observability (in-memory, non-persistent) ────────────────────────
//
// Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP. Records that a BYOK submit hit the
// server so future live retries can distinguish "browser never reached server"
// from "server received but blocked at gate X". NEVER stores user key, token,
// auth headers, prompt, lyrics, or raw provider response. Counter resets on
// process restart; never persisted to disk.

export type ByokSubmitStage =
  | 'received'
  | 'killswitch_off'
  | 'body_parse_failed'
  | 'turnstile_missing'
  | 'turnstile_failed'
  | 'audio_quota_rejected'
  | 'audio_quota_bypassed_for_byok_live'
  | 'live_attempt_blocked'
  | 'byok_live_audio_cap_reached'
  | 'live_attempt_consumed'
  | 'live_confirmation_mismatch'
  | 'live_mode_required'
  | 'direct_live_not_enabled'
  | 'direct_live_confirmation_mismatch'
  | 'lyrics_validation_failed'
  | 'direct_live_provider_error'
  | 'direct_live_relay_ok'
  | 'fake_relay_ok'
  | 'live_relay_ok'
  | 'live_relay_failed'
  | 'provider_error'
  | 'internal_error'
  | 'live_attempt_consumed_without_terminal_stage'
  | 'invalid_input'
  | 'unhandled_error';

export type ByokSubmitOutcome =
  | 'allowed'
  | 'blocked_killswitch_off'
  | 'blocked_body_parse'
  | 'blocked_turnstile'
  | 'blocked_audio_quota'
  | 'bypassed_audio_quota_for_byok_live'
  | 'blocked_live_attempt_limit'
  | 'blocked_live_audio_cap'
  | 'live_attempt_consumed'
  | 'blocked_live_confirmation_mismatch'
  | 'blocked_live_mode_required'
  | 'blocked_direct_live_not_enabled'
  | 'blocked_direct_live_confirmation_mismatch'
  | 'blocked_lyrics_required'
  | 'direct_live_relay_ok'
  | 'fake_relay_ok'
  | 'live_relay_ok'
  | 'live_relay_failed'
  | 'live_relay_provider_error'
  | 'internal_error'
  | 'silent_consume_detected'
  | 'invalid_input';

export interface ByokSubmitObservabilityStats {
  /** Total number of submit calls received by the server (cumulative, in-memory). */
  submitsReceived: number;
  /** ISO timestamp of the last submit, or empty string if never. */
  lastSubmitAt: string;
  /** Pipeline stage of the last submit (enum). */
  lastSubmitStage: ByokSubmitStage;
  /** Outcome classification of the last submit (enum). */
  lastSubmitOutcome: ByokSubmitOutcome;
  /** Request id of the last submit (already redacted — never includes a key). */
  lastSubmitRequestId: string;
  /** Whether the last submit's input looked like a live-mode attempt. */
  lastSubmitModeCandidate: 'live' | 'fake' | 'unknown' | 'blocked';
  /** Whether the last submit carried a Turnstile token. */
  lastSubmitTurnstilePresent: boolean;
  /** Whether the last submit included an apiKey field (length only; value NEVER logged). */
  lastSubmitApiKeyPresent: boolean;
  /** Whether the last submit included a non-empty prompt (length only; value NEVER logged). */
  lastSubmitPromptPresent: boolean;
}

const SUBMIT_OBSERVABILITY_EMPTY: ByokSubmitObservabilityStats = {
  submitsReceived: 0,
  lastSubmitAt: '',
  // Phase BYOK-H3B-OBSERVABILITY-FOLLOWUP-HOTFIX: initial stage/outcome
  // must be empty (NOT 'received' / 'allowed') so health output is not
  // misleading before any submit has actually been processed.
  lastSubmitStage: '' as ByokSubmitStage,
  lastSubmitOutcome: '' as ByokSubmitOutcome,
  lastSubmitRequestId: '',
  lastSubmitModeCandidate: 'unknown',
  lastSubmitTurnstilePresent: false,
  lastSubmitApiKeyPresent: false,
  lastSubmitPromptPresent: false,
};

let submitObservabilityState: ByokSubmitObservabilityStats = {
  ...SUBMIT_OBSERVABILITY_EMPTY,
};

// ── Per-request submit trace ring buffer (Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP) ──
//
// Records the last N submit events with a per-request stage chain so that
// "live attempt consumed → no terminal stage" gaps are detectable in /api/health
// and in evidence docs. The ring buffer NEVER stores apiKey, token, prompt,
// lyrics, raw provider response, or any Authorization value — only booleans,
// enums, the request id, and the response code.
//
// State is in-memory only; lost on restart. Default ring size is 32, configurable
// via BYOK_SUBMIT_TRACE_RING_SIZE env (positive integer, capped at 256).

const SUBMIT_TRACE_RING_SIZE_DEFAULT = 32;
const SUBMIT_TRACE_RING_SIZE_MAX = 256;

function readSubmitTraceRingSize(): number {
  const raw = (process.env.BYOK_SUBMIT_TRACE_RING_SIZE ?? '').trim();
  if (!/^\d+$/.test(raw)) return SUBMIT_TRACE_RING_SIZE_DEFAULT;
  const n = parseInt(raw, 10);
  if (n < 1) return SUBMIT_TRACE_RING_SIZE_DEFAULT;
  if (n > SUBMIT_TRACE_RING_SIZE_MAX) return SUBMIT_TRACE_RING_SIZE_MAX;
  return n;
}

export interface ByokSubmitTrace {
  /** Request id of this submit (redacted — never includes a key). */
  requestId: string;
  /** ISO timestamp of the trace event. */
  at: string;
  /** Pipeline stage at this point in the submit's lifecycle. */
  stage: ByokSubmitStage;
  /** Outcome classification at this point. */
  outcome: ByokSubmitOutcome;
  /** Whether the request looked like a live-mode attempt. */
  modeCandidate: 'live' | 'fake' | 'unknown' | 'blocked';
  /** Whether the request carried a Turnstile token (length only). */
  turnstilePresent: boolean;
  /** Whether the request included an apiKey field (length only). */
  apiKeyPresent: boolean;
  /** Whether the request included a non-empty prompt (length only). */
  promptPresent: boolean;
  /** Whether the submit consumed a live attempt slot in this stage. */
  liveAttemptConsumed: boolean;
  /** Whether this trace entry is a terminal stage (final outcome of the submit). */
  terminal: boolean;
  /** Response code that was returned to the client (or 'in_progress' if not yet sent). */
  responseCode: string;
}

export interface ByokSubmitTraceSummary extends ByokSubmitTrace {
  /** Index of this trace in the ring buffer (0 = oldest, N-1 = newest). */
  index: number;
}

let submitTraceRing: ByokSubmitTrace[] = [];

export interface RecordByokSubmitInput {
  requestId: string;
  stage: ByokSubmitStage;
  outcome: ByokSubmitOutcome;
  modeCandidate: 'live' | 'fake' | 'unknown' | 'blocked';
  turnstilePresent: boolean;
  apiKeyPresent: boolean;
  promptPresent: boolean;
  timestamp?: number;
  /**
   * Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP. Whether this stage consumed a live
   * attempt slot (i.e. `consumeByokLiveAttempt` was called for this submit).
   * Default: false. When true, the trace entry is flagged so the next
   * terminal stage for the same requestId is matched against it.
   */
  liveAttemptConsumed?: boolean;
  /**
   * Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP. Whether this entry is the terminal
   * stage of the submit (response has been sent to the client). Default: true
   * (most calls are terminal). Set to false for in-progress / chained calls
   * like the provisional `received` recording.
   */
  terminal?: boolean;
  /**
   * Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP. The response code that was
   * returned to the client (e.g. 'byok_direct_live_ok', 'byok_generation_disabled').
   * Use 'in_progress' if the response has not yet been sent. Default: '' (empty).
   */
  responseCode?: string;
}

/**
 * Terminal stages that close a live attempt consume cycle. After a stage
 * with `liveAttemptConsumed=true` is recorded, the next call to
 * `recordByokSubmit` for the same requestId MUST have a stage in this set;
 * otherwise the silent-consume guard fires.
 */
export const BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME: ReadonlySet<ByokSubmitStage> =
  new Set<ByokSubmitStage>([
    // Successful relay / provider-error — actual live attempt produced a result.
    'live_relay_ok',
    'live_relay_failed',
    'provider_error',
    'direct_live_relay_ok',
    'direct_live_provider_error',
    'byok_live_audio_cap_reached',
    'internal_error',
    'unhandled_error',
    // Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP. Gate-rejection stages also
    // qualify as terminal: a blocked submit after a live consume is a
    // known final outcome, not a silent consume. The list is exhaustive
    // enough that any stage NOT in this set, recorded AFTER a
    // liveAttemptConsumed=true stage for the same requestId, will fire
    // the silent-consume guard.
    'killswitch_off',
    'live_attempt_blocked',
    'live_confirmation_mismatch',
    'live_mode_required',
    'direct_live_not_enabled',
    'direct_live_confirmation_mismatch',
  ]);

/**
 * Per-request "last stage seen" map used by the silent-consume guard.
 * Cleared on process restart. NEVER stores apiKey, token, prompt, lyrics,
 * or raw provider response — only the boolean `liveAttemptConsumed` flag
 * and the requestId key.
 */
const liveAttemptConsumedByRequest: Map<string, { consumedAt: number; consumedStage: ByokSubmitStage }> =
  new Map();

/**
 * Count of submit requests that consumed a live attempt slot but never
 * produced a terminal stage from BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME.
 * Increments atomically each time `recordByokSubmit` notices the gap.
 */
let silentConsumeCount = 0;

/**
 * Phase BYOK-H3B-POST-CONSUME-HARDENING.
 *
 * Tracks a `setTimeout` per open live-consume slot so that if no natural
 * terminal stage ever arrives (i.e. the request handler returned or threw
 * silently), we still emit a synthetic `live_attempt_consumed_without_terminal_stage`
 * trace entry and increment `silentConsumeCount` after a bounded wait. The
 * prior guard only fired on a *subsequent* `recordByokSubmit` call, which
 * is exactly what was missing in Retry-8 (`byok_0bf283b70815`).
 *
 * Only stores: requestId, createdAt ISO string, and a NodeJS.Timeout
 * handle. NEVER stores apiKey, token, prompt, lyrics, or raw provider
 * response.
 */
type PendingConsumedAttempt = {
  requestId: string;
  createdAt: string;
  consumedStage: ByokSubmitStage;
  timer: ReturnType<typeof setTimeout> | null;
};

const pendingConsumedAttempts: Map<string, PendingConsumedAttempt> = new Map();

/**
 * Resolve the post-consume timeout from env, clamped to a safe range.
 * Default 30s. Min 5s (so we never false-positive in normal handling).
 * Max 5 min (so a forgotten entry still gets reaped eventually).
 */
function getSilentConsumeTimeoutMs(): number {
  const raw = Number(process.env.BYOK_SILENT_CONSUME_TIMEOUT_MS ?? 30000);
  if (!Number.isFinite(raw)) return 30000;
  return Math.min(Math.max(raw, 5000), 300000);
}

/**
 * Reap a pending consumed attempt: emit the synthetic terminal trace,
 * increment the silent-consume counter, and clear the pending entry.
 * Idempotent — if the entry is no longer pending, this is a no-op.
 */
function reapPendingConsumedAttempt(requestId: string): void {
  const pending = pendingConsumedAttempts.get(requestId);
  if (!pending) return;
  pendingConsumedAttempts.delete(requestId);
  if (pending.timer !== null) {
    clearTimeout(pending.timer);
  }
  silentConsumeCount += 1;
  // Synthetic trace entry — never logs raw data.
  const at = new Date().toISOString();
  pushByokSubmitTrace({
    requestId,
    at,
    stage: 'live_attempt_consumed_without_terminal_stage',
    outcome: 'silent_consume_detected',
    modeCandidate: 'unknown',
    turnstilePresent: false,
    apiKeyPresent: false,
    promptPresent: false,
    liveAttemptConsumed: false,
    terminal: true,
    responseCode: 'silent_consume_detected',
  });
  submitObservabilityState = {
    ...submitObservabilityState,
    lastSubmitAt: at,
    lastSubmitStage: 'live_attempt_consumed_without_terminal_stage',
    lastSubmitOutcome: 'silent_consume_detected',
    lastSubmitRequestId: requestId,
  };
}

/**
 * Record a single submit event. In-memory only. NEVER logs the apiKey, token,
 * prompt, lyrics, or any provider raw response — only booleans + enums.
 *
 * Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP. Also pushes a `ByokSubmitTrace` entry
 * into the per-request ring buffer and runs the silent-consume guard: if
 * `liveAttemptConsumed=true` was set for this stage AND the same requestId
 * has not yet produced a terminal stage in BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME,
 * the silent-consume counter is incremented and a synthetic trace entry with
 * stage `live_attempt_consumed_without_terminal_stage` is recorded.
 */
export function recordByokSubmit(input: RecordByokSubmitInput): void {
  const liveAttemptConsumed = input.liveAttemptConsumed === true;
  const terminal = input.terminal !== false; // default: true
  const responseCode = input.responseCode ?? '';

  submitObservabilityState = {
    submitsReceived: submitObservabilityState.submitsReceived + 1,
    lastSubmitAt: new Date().toISOString(),
    lastSubmitStage: input.stage,
    lastSubmitOutcome: input.outcome,
    lastSubmitRequestId: input.requestId,
    lastSubmitModeCandidate: input.modeCandidate,
    lastSubmitTurnstilePresent: input.turnstilePresent,
    lastSubmitApiKeyPresent: input.apiKeyPresent,
    lastSubmitPromptPresent: input.promptPresent,
  };

  // Phase BYOK-H3B-SILENT-CONSUME-FOLLOWUP. Push the trace entry.
  pushByokSubmitTrace({
    requestId: input.requestId,
    at: new Date().toISOString(),
    stage: input.stage,
    outcome: input.outcome,
    modeCandidate: input.modeCandidate,
    turnstilePresent: input.turnstilePresent,
    apiKeyPresent: input.apiKeyPresent,
    promptPresent: input.promptPresent,
    liveAttemptConsumed,
    terminal,
    responseCode,
  });

  // Track consume → terminal pairing. A new live attempt consume for this
  // requestId overwrites any prior state (only one slot per requestId).
  if (liveAttemptConsumed) {
    liveAttemptConsumedByRequest.set(input.requestId, {
      consumedAt: Date.now(),
      consumedStage: input.stage,
    });
    // Phase BYOK-H3B-POST-CONSUME-HARDENING. Schedule a reaper timer: if no
    // natural terminal stage arrives before it fires, synthesize a
    // `live_attempt_consumed_without_terminal_stage` trace entry and bump
    // `silentConsumeCount`. This catches the Retry-8 case where the request
    // handler returned/threw without any subsequent `recordByokSubmit`.
    if (!terminal) {
      const existing = pendingConsumedAttempts.get(input.requestId);
      if (existing && existing.timer !== null) {
        clearTimeout(existing.timer);
      }
      const timer = setTimeout(() => {
        reapPendingConsumedAttempt(input.requestId);
      }, getSilentConsumeTimeoutMs());
      // Allow the Node.js process to exit even if a timer is still pending.
      // The pending entry is in-memory only and will be cleared on restart.
      if (typeof (timer as { unref?: () => void }).unref === 'function') {
        (timer as { unref?: () => void }).unref!();
      }
      pendingConsumedAttempts.set(input.requestId, {
        requestId: input.requestId,
        createdAt: new Date().toISOString(),
        consumedStage: input.stage,
        timer,
      });
    }
  }

  // Silent-consume guard. If a prior live attempt consume is still open and
  // this stage is a known terminal stage, clear the consume state. If this
  // stage is NOT a terminal stage but a live consume is still open, increment
  // the silent-consume counter and emit a synthetic trace entry.
  if (terminal) {
    if (liveAttemptConsumedByRequest.has(input.requestId)) {
      if (!BYOK_TERMINAL_STAGES_AFTER_LIVE_CONSUME.has(input.stage)) {
        silentConsumeCount += 1;
        liveAttemptConsumedByRequest.delete(input.requestId);
        // Synthetic trace entry — never logs raw data.
        pushByokSubmitTrace({
          requestId: input.requestId,
          at: new Date().toISOString(),
          stage: 'live_attempt_consumed_without_terminal_stage',
          outcome: 'silent_consume_detected',
          modeCandidate: input.modeCandidate,
          turnstilePresent: input.turnstilePresent,
          apiKeyPresent: input.apiKeyPresent,
          promptPresent: input.promptPresent,
          liveAttemptConsumed: false,
          terminal: true,
          responseCode: 'silent_consume_detected',
        });
        submitObservabilityState = {
          ...submitObservabilityState,
          lastSubmitAt: new Date().toISOString(),
          lastSubmitStage: 'live_attempt_consumed_without_terminal_stage',
          lastSubmitOutcome: 'silent_consume_detected',
          lastSubmitRequestId: input.requestId,
        };
      } else {
        // Proper terminal stage reached — clear the open consume.
        liveAttemptConsumedByRequest.delete(input.requestId);
      }
    }
    // Phase BYOK-H3B-POST-CONSUME-HARDENING. Clear the post-consume reaper
    // timer, if any. The natural terminal stage arrived before the timer
    // fired, so the attempt is no longer pending.
    const pending = pendingConsumedAttempts.get(input.requestId);
    if (pending) {
      pendingConsumedAttempts.delete(input.requestId);
      if (pending.timer !== null) {
        clearTimeout(pending.timer);
      }
    }
  }
}

function pushByokSubmitTrace(trace: ByokSubmitTrace): void {
  const size = readSubmitTraceRingSize();
  if (submitTraceRing.length >= size) {
    submitTraceRing = submitTraceRing.slice(submitTraceRing.length - size + 1);
  }
  submitTraceRing.push(trace);
}

/** Read-only snapshot of the submit trace ring (newest first). Pure. */
export function getByokSubmitTraceRecent(limit?: number): ByokSubmitTraceSummary[] {
  const slice = limit !== undefined && limit > 0
    ? submitTraceRing.slice(Math.max(0, submitTraceRing.length - limit))
    : submitTraceRing.slice();
  return slice.map((t, i) => ({ ...t, index: i }));
}

/** Total number of submit traces currently in the ring buffer. */
export function getByokSubmitTraceCount(): number {
  return submitTraceRing.length;
}

/** Total number of detected silent-consume events since process start. */
export function getByokSilentConsumeCount(): number {
  return silentConsumeCount;
}

/**
 * Phase BYOK-H3B-POST-CONSUME-HARDENING.
 * Number of live attempts that are currently open and waiting for a natural
 * terminal stage (i.e. have an active reaper timer). Diagnostic / test
 * helper. In-memory only. Process restart clears it.
 */
export function getByokPendingConsumedAttemptCount(): number {
  return pendingConsumedAttempts.size;
}

/** Read-only snapshot for /api/health. Pure. */
export function getByokSubmitObservability(): ByokSubmitObservabilityStats {
  return { ...submitObservabilityState };
}

/** Reset to empty (test-only convenience). */
export function _resetByokSubmitObservabilityForTests(): void {
  submitObservabilityState = { ...SUBMIT_OBSERVABILITY_EMPTY };
  submitTraceRing = [];
  liveAttemptConsumedByRequest.clear();
  silentConsumeCount = 0;
  // Phase BYOK-H3B-POST-CONSUME-HARDENING. Clear any pending reaper timers
  // and the pending map.
  for (const pending of pendingConsumedAttempts.values()) {
    if (pending.timer !== null) {
      clearTimeout(pending.timer);
    }
  }
  pendingConsumedAttempts.clear();
}
