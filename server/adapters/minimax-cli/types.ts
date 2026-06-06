/**
 * MMX CLI Adapter — spawn mmx CLI for music generation.
 *
 * Security guarantees:
 * - No API key passed via command line (uses mmx auth or env injection)
 * - No shell interpolation — args passed as array to spawn
 * - stdout/stderr are redacted before storage
 * - No真实 key/Bearer/sk- logged
 */

export type MmxCliRegion = 'cn' | 'global';

export interface MmxCliGenerationOptions {
  outputDir: string;
  /**
   * Optional canonical filename for the output.
   * When provided, mmx outputs directly to this name (no rename needed).
   * Server should set this so track id and filename are consistent.
   */
  audioFileName?: string;
  /** Default: 180000ms (3 min) */
  timeoutMs?: number;
  region?: MmxCliRegion;
  /** For cover-url mode */
  audioUrl?: string;
  /** For cover-file mode — local path to audio file */
  audioFile?: string;
}

export interface MmxCliGenerationResult {
  /** Absolute path to generated audio file */
  audioFilePath: string;
  audioFileName: string;
  audioMimeType: 'audio/mpeg';
  audioFormat: 'mp3';
  sizeBytes: number;
  generationSource: 'mmx-cli';
  /** Redacted stderr preview (max 2000 chars) */
  stderrPreview?: string;
}

export interface MmxCliDiagnostics {
  mmxAvailable: boolean;
  version: string | null;
  authStatus: 'authenticated' | 'not_authenticated' | 'unknown';
  region: MmxCliRegion | null;
  quotaAvailable: boolean;
  musicGenerateHelp: string | null;
  musicCoverHelp: string | null;
}