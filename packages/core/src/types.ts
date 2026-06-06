// ─── Platform-Independent Types (no DOM/BOM/React) ─────────────────────────────

// ── Region ─────────────────────────────────────────────────────────────────────

export type MiniMaxRegion = 'cn' | 'global'

// ── Models ─────────────────────────────────────────────────────────────────────

export type MiniMaxTextMusicModel = 'music-2.6' | 'music-2.6-free'
export type MiniMaxCoverModel = 'music-cover' | 'music-cover-free'
export type MiniMaxMusicModel = MiniMaxTextMusicModel | MiniMaxCoverModel

// ── Generation Modes ────────────────────────────────────────────────────────────

export type MusicMode =
  | 'instrumental'
  | 'auto'
  | 'lyrics'
  | 'cover-url'
  | 'cover-file'

// ── Audio Settings ─────────────────────────────────────────────────────────────

export type AudioFormat = 'mp3' | 'wav'
export type OutputFormat = 'url' | 'hex'

export type AudioSettings = {
  sample_rate: 16000 | 24000 | 32000 | 44100
  bitrate: 32000 | 64000 | 128000 | 256000
  format: AudioFormat
}

// ── Form Input Types (Discriminated Union) ─────────────────────────────────────

export interface InstrumentalInput {
  mode: 'instrumental'
  prompt: string
  model?: MiniMaxTextMusicModel
  region?: MiniMaxRegion
  outputFormat?: OutputFormat
  audioSettings?: Partial<AudioSettings>
}

export interface AutoSongInput {
  mode: 'auto'
  prompt: string
  language?: 'zh' | 'en' | 'ja' | 'ko'
  model?: MiniMaxTextMusicModel
  region?: MiniMaxRegion
  outputFormat?: OutputFormat
  audioSettings?: Partial<AudioSettings>
}

export interface LyricsSongInput {
  mode: 'lyrics'
  prompt: string
  lyrics: string
  model?: MiniMaxTextMusicModel
  region?: MiniMaxRegion
  outputFormat?: OutputFormat
  audioSettings?: Partial<AudioSettings>
}

export interface CoverUrlInput {
  mode: 'cover-url'
  prompt: string
  audioUrl: string
  lyrics?: string
  model?: MiniMaxCoverModel
  region?: MiniMaxRegion
  outputFormat?: OutputFormat
  audioSettings?: Partial<AudioSettings>
}

export interface CoverFileInput {
  mode: 'cover-file'
  prompt: string
  fileName?: string
  fileSizeBytes?: number
  mimeType?: string
  audioBase64?: string
  lyrics?: string
  model?: MiniMaxCoverModel
  region?: MiniMaxRegion
  outputFormat?: OutputFormat
  audioSettings?: Partial<AudioSettings>
}

export type MusicGenerationInput =
  | InstrumentalInput
  | AutoSongInput
  | LyricsSongInput
  | CoverUrlInput
  | CoverFileInput

// ── Normalized Input ───────────────────────────────────────────────────────────
// Intersection with the base discriminated union preserves narrowing in switches.
// Using `type` (not `interface extends`) because MusicGenerationInput is a union.

export type NormalizedMusicInput = MusicGenerationInput & {
  region: MiniMaxRegion
  model: MiniMaxMusicModel
  outputFormat: OutputFormat
  audioSettings: AudioSettings
}

// ── MiniMax API Payload ────────────────────────────────────────────────────────

export interface MiniMaxAudioSettingPayload {
  sample_rate?: number
  bitrate?: number
  format?: string
}

export interface MiniMaxMusicGenerationPayload {
  model: string
  prompt?: string
  lyrics?: string
  stream?: boolean
  output_format?: OutputFormat
  audio_setting?: MiniMaxAudioSettingPayload
  aigc_watermark?: boolean
  lyrics_optimizer?: boolean
  is_instrumental?: boolean
  audio_url?: string
  audio_base64?: string
  cover_feature_id?: string
}

// ── Build Result ───────────────────────────────────────────────────────────────

export interface BuildMusicPayloadResult {
  endpoint: string
  payload: MiniMaxMusicGenerationPayload
  normalizedInput: NormalizedMusicInput
  /** True when cover-file input has no audioBase64 (adapter-level upload required) */
  needsUpload?: boolean
}

// ── Validation Result ──────────────────────────────────────────────────────────

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationWarning {
  field: string
  message: string
  code: string
}

export interface ValidationResult {
  ok: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

// ── Track ─────────────────────────────────────────────────────────────────────

export type TrackStatus =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'success'
  | 'failed'

export interface Track {
  id: string
  title: string
  mode: MusicMode
  model: string
  prompt: string
  lyrics?: string
  referenceAudio?: string
  status: TrackStatus
  progress?: number
  audioUrl?: string
  audioPath?: string
  durationText?: string
  sizeBytes?: number
  error?: string
  createdAt: string // ISO 8601
}

// ── Job ───────────────────────────────────────────────────────────────────────

export interface Job {
  id: string
  input: MusicGenerationInput
  status: TrackStatus
  progress: number
  track?: Track
  error?: string
  createdAt: string
  updatedAt: string
}

// ── Prompt Builder ─────────────────────────────────────────────────────────────

export interface ExpandedPromptOptions {
  mode: MusicMode
  description: string
  moodTags?: string[]
  instrumentTags?: string[]
  language?: 'zh' | 'en' | 'ja' | 'ko'
  vocalDirection?: string
  useCase?: string
}