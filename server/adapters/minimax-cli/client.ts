/**
 * MMX CLI Adapter — spawns `mmx music generate` / `mmx music cover`.
 *
 * Key design decisions:
 * - No API key passed via CLI args (would appear in process list / shell history)
 * - Relies on mmx's existing auth (~/.mmx/config.json or mmx auth login)
 * - Parameters passed as spawn array (no shell interpolation risk)
 * - stdout/stderr always redacted before storage
 * - Proxy env vars are cleared so mmx connects directly (bypassing socks5 which causes "Invalid URL protocol")
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MmxCliGenerationOptions, MmxCliGenerationResult, MmxCliDiagnostics } from './types.js';
import {
  MmxCliError,
  MmxCliNotFoundError,
  MmxCliTimeoutError,
  MmxCliAuthError,
  MmxCliUnsupportedModeError,
  MmxCliGenerationError,
  redactCliOutput,
} from './errors.js';
import type { MusicGenerationInput } from '../../core-wrapper.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomId(len = 6): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

function safeFileName(mode: string, title: string): string {
  const ts = Date.now();
  const id = randomId(6);
  return `track_${ts}_${id}.mp3`;
}

async function fileInfo(filePath: string): Promise<{ size: number } | null> {
  try {
    const stat = fs.statSync(filePath);
    return { size: stat.size };
  } catch {
    return null;
  }
}

/**
 * Run mmx command, capture stdout+stderr, apply timeout.
 * Returns { code, stdout, stderr } — all redacted.
 */
async function runMmx(
  args: string[],
  timeoutMs = 180_000,
  cwd?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const stderrChunks: Buffer[] = [];
  const stdoutChunks: Buffer[] = [];

  return new Promise((resolve) => {
    // Build clean env — strip ALL proxy variables so mmx connects directly.
    // This avoids the "Invalid URL protocol" error when ALL_PROXY=socks5://... is inherited.
    const safeEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      // Skip anything with "proxy" in the key name (case-insensitive)
      if (k.toLowerCase().includes('proxy')) continue;
      safeEnv[k] = v ?? '';
    }
    safeEnv.LANG = 'en_US.UTF-8';
    safeEnv.LC_ALL = 'en_US.UTF-8';

    const proc = spawn('mmx', args, {
      cwd,
      env: safeEnv,
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run mmx CLI diagnostics (no generation).
 * Safe to call — reads only --version, --help, auth status, quota.
 */
export async function diagnoseMmxCli(): Promise<MmxCliDiagnostics> {
  let mmxAvailable = false;
  let version: string | null = null;
  let authStatus: 'authenticated' | 'not_authenticated' | 'unknown' = 'unknown';
  let region: 'cn' | 'global' | null = null;
  let quotaAvailable = false;
  let musicGenerateHelp: string | null = null;
  let musicCoverHelp: string | null = null;

  // 1. Check mmx exists
  try {
    const r = await runMmx(['--version'], 10_000);
    if (r.code === 0) {
      mmxAvailable = true;
      version = (r.stdout.trim().split('\n')[0] || r.stderr.trim().split('\n')[0] || null) ?? null;
    }
  } catch { /* not available */ }

  if (!mmxAvailable) {
    return { mmxAvailable: false, version: null, authStatus, region, quotaAvailable: false, musicGenerateHelp: null, musicCoverHelp: null };
  }

  // 2. Auth status (safe — does not expose credentials)
  try {
    const r = await runMmx(['auth', 'status'], 10_000);
    if (r.code === 0) {
      const out = (r.stdout + r.stderr).toLowerCase();
      if (out.includes('login') || out.includes('authenticated') || out.includes('token')) {
        authStatus = 'authenticated';
      } else if (out.includes('not') || out.includes('invalid') || out.includes('fail') || out.includes('error')) {
        authStatus = 'not_authenticated';
      }
    }
  } catch { /* ignore */ }

  // 3. Region from env (safe — no file read, no credential exposure)
  const envRegion = process.env.MINIMAX_REGION;
  if (envRegion === 'cn' || envRegion === 'global') {
    region = envRegion as 'cn' | 'global';
  }

  // 4. Quota check
  try {
    const r = await runMmx(['quota'], 10_000);
    quotaAvailable = r.code === 0 && !r.stdout.includes('Error');
  } catch { quotaAvailable = false; }

  // 5. music generate --help
  try {
    const r = await runMmx(['music', 'generate', '--help'], 15_000);
    musicGenerateHelp = r.code === 0 ? redactCliOutput(r.stdout || r.stderr) : null;
  } catch { musicGenerateHelp = null; }

  // 6. music cover --help
  try {
    const r = await runMmx(['music', 'cover', '--help'], 15_000);
    musicCoverHelp = r.code === 0 ? redactCliOutput(r.stdout || r.stderr) : null;
  } catch { musicCoverHelp = null; }

  return {
    mmxAvailable,
    version,
    authStatus,
    region,
    quotaAvailable,
    musicGenerateHelp: musicGenerateHelp?.slice(0, 4000) ?? null,
    musicCoverHelp: musicCoverHelp?.slice(0, 4000) ?? null,
  };
}

/**
 * Main generation function — calls `mmx music generate` or `mmx music cover`.
 */
export async function generateWithMmxCli(
  input: MusicGenerationInput,
  options: MmxCliGenerationOptions,
): Promise<MmxCliGenerationResult> {
  const { outputDir, audioFileName: serverFileName, timeoutMs = 180_000, audioUrl, audioFile: _audioFile } = options;

  const diag = await diagnoseMmxCli();
  if (!diag.mmxAvailable) throw new MmxCliNotFoundError();

  const { mode, prompt } = input;
  const lyrics = (input as { lyrics?: string }).lyrics;
  // Prefer the server-provided filename for consistency; fall back to temp rename.
  const fileName = serverFileName ?? safeFileName(mode, prompt ?? 'untitled');
  const outputPath = path.resolve(outputDir, fileName);
  const tempOutputPath = path.resolve(outputDir, '.tmp_cli_output.mp3');
  // Ensure directory exists
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  let args: string[];

  switch (mode) {
    case 'instrumental': {
      args = ['music', 'generate', '--prompt', prompt ?? '', '--instrumental', '--out', outputPath];
      break;
    }
    case 'auto': {
      args = ['music', 'generate', '--prompt', prompt ?? '', '--lyrics-optimizer', '--out', outputPath];
      break;
    }
    case 'lyrics': {
      if (!lyrics) throw new MmxCliGenerationError('歌词模式需要提供 lyrics 参数');
      args = ['music', 'generate', '--prompt', prompt ?? '', '--lyrics', lyrics, '--out', outputPath];
      break;
    }
    case 'cover-url': {
      if (!audioUrl) throw new MmxCliGenerationError('cover-url 模式需要提供 audioUrl 参数');
      args = ['music', 'cover', '--prompt', prompt ?? '', '--audio', audioUrl, '--out', outputPath];
      break;
    }
    case 'cover-file': {
      throw new MmxCliUnsupportedModeError('cover-file (请使用 cover-url 或先上传文件)');
    }
    default: {
      throw new MmxCliUnsupportedModeError(mode);
    }
  }

  const result = await runMmx(args, timeoutMs, outputDir);
  const stderrRedacted = redactCliOutput(result.stderr);
  const stdoutRedacted = redactCliOutput(result.stdout);

  if (result.code !== 0) {
    const out = (result.stdout + result.stderr).toLowerCase();
    if (out.includes('auth') || out.includes('login') || out.includes('invalid')) {
      throw new MmxCliAuthError(stderrRedacted);
    }
    throw new MmxCliGenerationError(
      `exit ${result.code}: ${stderrRedacted || stdoutRedacted}`.slice(0, 500),
      stderrRedacted,
    );
  }

  // Verify output file exists (mmx writes directly to outputPath when audioFileName is provided)
  const info = await fileInfo(outputPath);
  if (!info || info.size === 0) {
    throw new MmxCliGenerationError(`mmx 声称成功但输出文件不存在或为空: ${outputPath}`, stderrRedacted);
  }

  return {
    audioFilePath: outputPath,
    audioFileName: fileName,
    audioMimeType: 'audio/mpeg',
    audioFormat: 'mp3',
    sizeBytes: info.size,
    generationSource: 'mmx-cli',
    stderrPreview: stderrRedacted.slice(0, 2000),
  };
}

export { redactCliOutput, runMmx };
export type { MmxCliGenerationOptions, MmxCliGenerationResult, MmxCliDiagnostics } from './types.js';
export { MmxCliError, MmxCliNotFoundError, MmxCliTimeoutError, MmxCliAuthError, MmxCliUnsupportedModeError, MmxCliGenerationError } from './errors.js';
