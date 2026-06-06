// ─── Core Constants ────────────────────────────────────────────────────────────

import type { AudioSettings, MiniMaxRegion } from './types.js'

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  sample_rate: 44100,
  bitrate: 256000,
  format: 'mp3',
}

export const DEFAULT_REGION: MiniMaxRegion = 'cn'
export const DEFAULT_TEXT_MUSIC_MODEL = 'music-2.6' as const
export const DEFAULT_COVER_MODEL = 'music-cover' as const
// output_format: 'url' matches mmx CLI exactly
// 'hex' is available but requires stream=true which we don't use by default
export const DEFAULT_OUTPUT_FORMAT = 'url' as const

// ── API Endpoints ─────────────────────────────────────────────────────────────

export const MINI_MAX_ENDPOINTS: Record<MiniMaxRegion, string> = {
  cn: 'https://api.minimaxi.com/v1/music_generation',
  global: 'https://api.minimax.io/v1/music_generation',
}

// ── Input Limits ──────────────────────────────────────────────────────────────

export const TEXT_PROMPT_MAX = 2000
export const INSTRUMENTAL_PROMPT_MIN = 1
export const LYRICS_MIN = 1
export const LYRICS_MAX = 3500
export const COVER_PROMPT_MIN = 10
export const COVER_PROMPT_MAX = 300
export const COVER_LYRICS_MIN = 10
export const COVER_LYRICS_MAX = 1000
export const COVER_AUDIO_MAX_BYTES = 50 * 1024 * 1024 // 50 MB

// ── Lyric Section Tags ────────────────────────────────────────────────────────

export const LYRIC_SECTION_TAGS = [
  '[Intro]',
  '[Verse]',
  '[Pre Chorus]',
  '[Chorus]',
  '[Interlude]',
  '[Bridge]',
  '[Outro]',
  '[Post Chorus]',
  '[Transition]',
  '[Break]',
  '[Hook]',
  '[Build Up]',
  '[Inst]',
  '[Solo]',
] as const

// ── Supported Audio MIME Types ────────────────────────────────────────────────

export const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/aac',
] as const

export type SupportedAudioMimeType = typeof SUPPORTED_AUDIO_MIME_TYPES[number]
