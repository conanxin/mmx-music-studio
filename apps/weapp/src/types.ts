// Shared types — Phase 3A (copied from packages/core for independence)
// Phase 3B will replace these with direct imports from packages/core

export type MusicMode = 'instrumental' | 'auto' | 'lyrics' | 'cover'

export interface MusicGenerationInput {
  mode: MusicMode
  prompt: string
  lyrics?: string | null
  audioUrl?: string | null
  model?: string
  outputFormat?: string
  audioSettings?: {
    sampleRate?: number
    bitrate?: string
  }
  region?: string
}

export interface Track {
  id: string
  title: string
  mode: MusicMode
  model: string
  prompt: string
  lyrics?: string | null
  status: 'pending' | 'generating' | 'success' | 'failed'
  audioUrl?: string
  downloadUrl?: string
  audioMimeType?: string
  audioFormat?: string
  sizeBytes?: number
  durationSeconds?: number
  generationSource: 'mock' | 'mmx-cli' | 'minimax-api'
  createdAt: string
}

export interface GenerationResult {
  ok: boolean
  track?: Track
  error?: {
    type: string
    message: string
  }
  generationSource?: 'mock' | 'mmx-cli' | 'minimax-api'
}

// Validation result
export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

// Adapter interfaces
export interface RequestAdapter {
  requestJson: <T>(path: string, options?: RequestOptions) => Promise<T>
  getApiBase: () => string
  setApiBase: (base: string) => void
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  body?: Record<string, unknown>
  headers?: Record<string, string>
}

export interface StorageAdapter {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export interface AudioAdapter {
  createPlayer: () => AudioPlayer
}

export interface AudioPlayer {
  play: (url: string) => void
  pause: () => void
  stop: () => void
  destroy: () => void
  onPlay?: () => void
  onPause?: () => void
  onEnded?: () => void
  onTimeUpdate?: (currentTime: number) => void
  onError?: (err: string) => void
}

// Mock generation state
export interface GenerationState {
  isGenerating: boolean
  progressMessage: string
  progressElapsed: number
  error: string | null
}

// Style tags
export const STYLE_TAGS = [
  '安静', '明亮', '梦幻', '电影感',
  '电子', '钢琴', '吉他', 'Lo-fi',
] as const

export type StyleTag = typeof STYLE_TAGS[number]

// Mode labels
export const MODE_LABELS: Record<MusicMode, string> = {
  instrumental: '纯音乐',
  auto: '自动成歌',
  lyrics: '歌词成歌',
  cover: '参考改编',
}

export const MODE_BTN_LABELS: Record<MusicMode, string> = {
  instrumental: '生成纯音乐',
  auto: '生成歌曲',
  lyrics: '按歌词生成',
  cover: '生成改编',
}