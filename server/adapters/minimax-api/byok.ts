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
