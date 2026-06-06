/**
 * MMX CLI Adapter — spawns `mmx music generate` / `mmx music cover`.
 *
 * Key design decisions:
 * - No API key passed via CLI args (would appear in process list / shell history)
 * - Relies on mmx's existing auth (~/.mmx/config.json or mmx auth login)
 * - Parameters passed as spawn array (no shell interpolation risk)
 * - stdout/stderr always redacted before storage
 * - Phase 2D: no real generation — dry-run / help-check only
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type {
  MmxCliGenerationOptions,
  MmxCliGenerationResult,
  MmxCliDiagnostics,
  MmxCliRegion,
} from './types.js';
import {
  MmxCliError,
  MmxCliNotFoundError,
  MmxCliTimeoutError,
  MmxCliAuthError,
  MmxCliUnsupportedModeError,
  MmxCliGenerationError,
  redactCliOutput,
} from './errors.js';
import type { MusicGenerationInput } from '../../../core/src/types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeTitle(prompt: string): string {
  return prompt
    .replace(/[^\w\u4e00-\u9fff\-_. ]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 30) || 'untitled';
}

function timestampPrefix(): string {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 16).replace('T', '_');
}

function safeFileName(mode: string, title: string): string {
  const safe = safeTitle(title);
  return `${timestampPrefix()}_${mode}_${safe}.mp3`;
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
): Promise<{ code: number; stdout: string; stderr: string }> {
  const stderrChunks: Buffer[] = [];
  const stdoutChunks: Buffer[] = [];

  return new Promise((resolve) => {
    const proc = spawn('mmx', args, {
      // Do NOT inherit env — let mmx find its own auth
      // Pass only safe, non-secret env vars
      env: {
        ...process.env,
        // Explicitly do NOT pass MINIMAX_API_KEY to avoid it appearing in process list
        // mmx should use its own ~/.mmx/config.json auth
      },
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
      resolve({
        code: -1,
        stdout: '',
        stderr: `spawn error: ${err.message}`,
      });
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run mmx CLI diagnostics (no generation).
 * Safe to call — reads only --version, --help, auth status.
 */
export async function diagnoseMmxCli(): Promise<MmxCliDiagnostics> {
  let mmxAvailable = false;
  let version: string | null = null;
  let authStatus: 'authenticated' | 'not_authenticated' | 'unknown' = 'unknown';
  let region: MmxCliRegion | null = null;
  let quotaAvailable = false;
  let musicGenerateHelp: string | null = null;
  let musicCoverHelp: string | null = null;

  // 1. Check mmx exists
  try {
    const r = await runMmx(['--version'], 10_000);
    if (r.code === 0) {
      mmxAvailable = true;
      version = r.stdout.trim().split('\n')[0] || r.stderr.trim().split('\n')[0] || null;
    }
  } catch {
    /* not available */
  }

  if (!mmxAvailable) {
    return { mmxAvailable: false, version: null, authStatus, region, quotaAvailable: false, musicGenerateHelp: null, musicCoverHelp: null };
  }

  // 2. Auth status
  try {
    const r = await runMmx(['auth', 'status'], 10_000);
    if (r.code === 0 && !r.stdout.includes('Error') && !r.stderr.includes('Error')) {
      // Parse: if output has "logged in" or similar safe indicators
      const out = (r.stdout + r.stderr).toLowerCase();
      if (out.includes('login') || out.includes('auth') || out.includes('token') || out.includes('authenticated')) {
        authStatus = 'authenticated';
      } else if (out.includes('not') || out.includes('invalid') || out.includes('fail')) {
        authStatus = 'not_authenticated';
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Region from config (safe read — does not expose key)
  try {
    const configPath = path.join(process.env.HOME || '/root', '.mmx', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    if (cfg.region === 'cn' || cfg.region === 'global') {
      region = cfg.region;
    }
  } catch {
    /* ignore — file may not exist or may be malformed */
  }

  // 4. Quota check
  try {
    const r = await runMmx(['quota'], 10_000);
    quotaAvailable = r.code === 0 && !r.stdout.includes('Error');
  } catch {
    quotaAvailable = false;
  }

  // 5. music generate --help
  try {
    const r = await runMmx(['music', 'generate', '--help'], 15_000);
    if (r.code === 0 || r.stdout) {
      musicGenerateHelp = redactCliOutput(r.stdout || r.stderr);
    }
  } catch {
    musicGenerateHelp = null;
  }

  // 6. music cover --help
  try {
    const r = await runMmx(['music', 'cover', '--help'], 15_000);
    if (r.code === 0 || r.stdout) {
      musicCoverHelp = redactCliOutput(r.stdout || r.stderr);
    }
  } catch {
    musicCoverHelp = null;
  }

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
 *
 * Phase 2D: This function is implemented but MUST NOT be called in real generation
 * until Phase 2D-B user confirmation.
 *
 * @param input  MusicGenerationInput from core types
 * @param options CLI adapter options
 * @returns MmxCliGenerationResult with local file path
 */
export async function generateWithMmxCli(
  input: MusicGenerationInput,
  options: MmxCliGenerationOptions,
): Promise<MmxCliGenerationResult> {
  const {
    outputDir,
    timeoutMs = 180_000,
    region = 'cn',
    audioUrl,
    audioFile,
  } = options;

  // 0. Check mmx available
  const diag = await diagnoseMmxCli();
  if (!diag.mmxAvailable) {
    throw new MmxCliNotFoundError();
  }

  // 1. Ensure output dir
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = safeFileName(input.mode, input.prompt || 'untitled');
  const outputPath = path.resolve(outputDir, fileName);

  // 2. Build command based on mode
  const { mode, prompt, lyrics } = input;
  let args: string[];
  let cmdName: string;

  switch (mode) {
    case 'instrumental': {
      cmdName = 'mmx music generate';
      args = [
        'music', 'generate',
        '--prompt', prompt,
        '--instrumental',
        '--out', outputPath,
      ];
      break;
    }

    case 'auto': {
      cmdName = 'mmx music generate';
      args = [
        'music', 'generate',
        '--prompt', prompt,
        '--lyrics-optimizer',
        '--out', outputPath,
      ];
      break;
    }

    case 'lyrics': {
      if (!lyrics) throw new MmxCliGenerationError('歌词模式需要提供 lyrics 参数');
      cmdName = 'mmx music generate';
      args = [
        'music', 'generate',
        '--prompt', prompt,
        '--lyrics', lyrics,
        '--out', outputPath,
      ];
      break;
    }

    case 'cover-url': {
      if (!audioUrl) throw new MmxCliGenerationError('cover-url 模式需要提供 audioUrl 参数');
      cmdName = 'mmx music cover';
      args = [
        'music', 'cover',
        '--prompt', prompt,
        '--audio', audioUrl,
        '--out', outputPath,
      ];
      break;
    }

    case 'cover-file': {
      // Phase 2D: cover-file requires a local file path.
      // Web uploads use base64 — not directly supported yet.
      // Return UnsupportedAdapterError for now.
      throw new MmxCliUnsupportedModeError('cover-file (请使用 cover-url 或先上传文件)');
    }

    default: {
      throw new MmxCliUnsupportedModeError(mode);
    }
  }

  // 3. Run mmx
  const result = await runMmx(args, timeoutMs);
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

  // 4. Verify output file
  const info = await fileInfo(outputPath);
  if (!info || info.size === 0) {
    throw new MmxCliGenerationError(
      `mmx 声称成功但输出文件不存在或为空: ${outputPath}`,
      stderrRedacted,
    );
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