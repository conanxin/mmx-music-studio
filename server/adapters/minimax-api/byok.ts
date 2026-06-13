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

  // ── Live mode: DISABLED ──
  //
  // CRITICAL SAFETY BUG (2026-06-11): mmx CLI does NOT read MINIMAX_API_KEY
  // from child env for `music generate`. It reads `~/.mmx/config.json` directly.
  // When we passed a placeholder apiKey via env, mmx CLI ignored it and fell
  // back to the operator config key, generating a real MP3 with the operator's
  // quota. This means the BYOK "user key" was never actually used.
  //
  // The `--api-key` flag exists but would expose the key in process argv
  // (visible via `ps` / `/proc`). The correct long-term fix is a direct HTTPS
  // provider call with per-request `Authorization` header, not CLI wrapping.
  //
  // Until BYOK-C2 (direct API relay) is designed and validated, live mode
  // remains fail-closed.
  return {
    ok: false,
    code: 'byok_live_provider_path_disabled',
    message: 'BYOK live provider path is disabled pending direct API relay validation.',
    generationSource: 'byok-live',
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
  | 'fake_relay_ok'
  | 'live_relay_ok'
  | 'provider_error'
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
  | 'fake_relay_ok'
  | 'live_relay_ok'
  | 'live_relay_provider_error'
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
  lastSubmitModeCandidate: 'live' | 'fake' | 'unknown';
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

export interface RecordByokSubmitInput {
  requestId: string;
  stage: ByokSubmitStage;
  outcome: ByokSubmitOutcome;
  modeCandidate: 'live' | 'fake' | 'unknown';
  turnstilePresent: boolean;
  apiKeyPresent: boolean;
  promptPresent: boolean;
}

/**
 * Record a single submit event. In-memory only. NEVER logs the apiKey, token,
 * prompt, lyrics, or any provider raw response — only booleans + enums.
 */
export function recordByokSubmit(input: RecordByokSubmitInput): void {
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
}

/** Read-only snapshot for /api/health. Pure. */
export function getByokSubmitObservability(): ByokSubmitObservabilityStats {
  return { ...submitObservabilityState };
}

/** Reset to empty (test-only convenience). */
export function _resetByokSubmitObservabilityForTests(): void {
  submitObservabilityState = { ...SUBMIT_OBSERVABILITY_EMPTY };
}
