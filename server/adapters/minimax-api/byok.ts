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
 * - live: spawn mmx with the user key injected into the child env; the
 *        site operator's key is explicitly excluded.
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

import { spawn } from 'node:child_process';
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

  // ── Live mode: spawn mmx with user key injected ──
  const outputDir = input.outputDir ?? '/tmp';
  const timeoutMs = input.timeoutMs ?? 180_000;
  const fileName = safeFileName(input.musicMode ?? 'auto', input.prompt) || `byok-live-${requestId}.mp3`;
  const outputPath = path.resolve(outputDir, fileName);

  // Build clean child env: only the user's key. Site operator's
  // MINIMAX_API_KEY is explicitly NOT propagated. We also strip proxy
  // vars to avoid "Invalid URL protocol" issues (matches mmx-cli pattern).
  const childEnv: Record<string, string> = {
    MINIMAX_API_KEY: input.apiKey,
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
  };
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'MINIMAX_API_KEY') continue; // never propagate site operator key
    if (k.toLowerCase().includes('proxy')) continue;
    childEnv[k] = v ?? '';
  }

  const args: string[] = ['music', 'generate', '--prompt', input.prompt];
  if (input.musicMode === 'instrumental') {
    args.push('--instrumental');
  } else if (input.musicMode === 'lyrics' && input.lyrics) {
    args.push('--lyrics', input.lyrics);
  } else {
    // auto: ask mmx to optimize lyrics
    args.push('--lyrics-optimizer');
  }
  args.push('--out', outputPath);

  const { code, stdout, stderr } = await runMmxChild(args, childEnv, timeoutMs);
  const stderrRedacted = redactCliOutput(stderr);
  const stdoutRedacted = redactCliOutput(stdout);

  if (code === 124 /* SIGTERM from our timeout */) {
    return {
      ok: false,
      code: 'byok_provider_timeout',
      message: `provider timed out after ${Math.round(timeoutMs / 1000)}s`,
      generationSource: 'byok-live',
      durationMs: Date.now() - start,
      stderrPreview: stderrRedacted.slice(0, 2000),
    };
  }

  if (code !== 0) {
    const lower = (stdout + stderr).toLowerCase();
    if (lower.includes('not found') || lower.includes('command not found')) {
      return {
        ok: false,
        code: 'byok_provider_not_found',
        message: 'mmx CLI not found in PATH',
        generationSource: 'byok-live',
        durationMs: Date.now() - start,
        stderrPreview: stderrRedacted.slice(0, 2000),
      };
    }
    if (lower.includes('auth') || lower.includes('login') || lower.includes('invalid') || lower.includes('unauthorized')) {
      return {
        ok: false,
        code: 'byok_provider_auth_failed',
        message: 'provider rejected the supplied apiKey (auth)',
        generationSource: 'byok-live',
        durationMs: Date.now() - start,
        stderrPreview: stderrRedacted.slice(0, 2000),
      };
    }
    if (lower.includes('unsupported') || lower.includes('not supported')) {
      return {
        ok: false,
        code: 'byok_provider_unsupported_mode',
        message: 'provider does not support the requested mode',
        generationSource: 'byok-live',
        durationMs: Date.now() - start,
        stderrPreview: stderrRedacted.slice(0, 2000),
      };
    }
    return {
      ok: false,
      code: 'byok_provider_error',
      message: `provider exit ${code} (redacted)`,
      generationSource: 'byok-live',
      durationMs: Date.now() - start,
      stderrPreview: stderrRedacted.slice(0, 2000),
    };
  }

  // Verify file size via stat (no file content read)
  let sizeBytes: number | undefined;
  try {
    const fs = await import('node:fs/promises');
    const stat = await fs.stat(outputPath);
    sizeBytes = stat.size;
    if (sizeBytes === 0) {
      return {
        ok: false,
        code: 'byok_provider_error',
        message: 'provider returned empty file',
        generationSource: 'byok-live',
        durationMs: Date.now() - start,
        stderrPreview: stderrRedacted.slice(0, 2000),
      };
    }
  } catch (statErr) {
    return {
      ok: false,
      code: 'byok_provider_error',
      message: 'provider succeeded but output file missing',
      generationSource: 'byok-live',
      durationMs: Date.now() - start,
      stderrPreview: (stderrRedacted + ' ' + (statErr as Error).message).slice(0, 2000),
    };
  }

  // No need to keep stdout; do not echo it. Use a single line.
  void stdoutRedacted;

  return {
    ok: true,
    code: 'byok_live_relay_ok',
    message: 'live relay ok',
    audioFileName: fileName,
    audioFilePath: outputPath,
    sizeBytes,
    generationSource: 'byok-live',
    durationMs: Date.now() - start,
  };
}

/**
 * Spawn mmx with the given child env and return {code, stdout, stderr}.
 * Uses SIGTERM timeout (returns code 124). NEVER includes the apiKey in
 * any error path.
 */
function runMmxChild(
  args: string[],
  childEnv: Record<string, string>,
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const stderrChunks: Buffer[] = [];
    const stdoutChunks: Buffer[] = [];
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn('mmx', args, { env: childEnv });
    } catch (err) {
      resolve({ code: 127, stdout: '', stderr: `spawn error: ${(err as Error).message}` });
      return;
    }
    const timer = setTimeout(() => {
      try { proc.kill('SIGTERM'); } catch { /* ignore */ }
    }, timeoutMs);
    proc.stderr?.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    proc.stdout?.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
      });
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout: '', stderr: `spawn error: ${err.message}` });
    });
  });
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
