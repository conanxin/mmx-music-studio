// ─── Mock Job System ───────────────────────────────────────────────────────────

import type { MusicGenerationInput, Track, Job, MusicMode } from './types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return `mock_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

const MOCK_DURATIONS = ['2:31', '3:44', '4:12', '3:05', '2:58', '4:37', '3:22', '5:01']

function getMockDuration(mode: MusicMode, prompt: string): string {
  // Deterministic-ish based on mode + prompt length
  const idx = (mode.length + (prompt.length % MOCK_DURATIONS.length)) % MOCK_DURATIONS.length
  return MOCK_DURATIONS[idx]
}

function getMockTitle(mode: MusicMode, prompt: string): string {
  const titles: Record<MusicMode, string[]> = {
    instrumental: ['深夜编程', '晨间冥想', '城市夜景', '雨后咖啡馆', '星空漂流'],
    auto: ['时光旅人', '城市恋曲', '梦想启航', '午夜电台', '春日光年'],
    lyrics: ['远方的诗', '听见心跳', '夜行记', '城市旅人', '孤独星球'],
    'cover-url': ['改编作品 #1', '风格重塑', '致敬演绎', '改编单曲', '灵感新声'],
    'cover-file': ['改编作品 #2', '创意翻唱', '全新诠释', '风格演绎', '灵感再现'],
  }
  const list = titles[mode] || titles.instrumental
  const idx = (mode.length + prompt.length) % list.length
  return list[idx]
}

// ── Mock Track ───────────────────────────────────────────────────────────────

export function createMockTrack(input: MusicGenerationInput): Track {
  const prompt = input.prompt || ''
  const id = generateId()
  const now = new Date().toISOString()

  return {
    id,
    title: getMockTitle(input.mode, prompt),
    mode: input.mode,
    model: input.mode === 'cover-url' || input.mode === 'cover-file'
      ? 'music-cover'
      : 'music-2.6',
    prompt,
    lyrics: 'lyrics' in input ? input.lyrics : undefined,
    referenceAudio:
      'audioUrl' in input ? input.audioUrl
      : 'fileName' in input ? input.fileName
      : undefined,
    status: 'success',
    progress: 100,
    audioUrl: '', // mock: no real URL
    durationText: getMockDuration(input.mode, prompt),
    createdAt: now,
  }
}

// ── Mock Job ─────────────────────────────────────────────────────────────────

export function createMockJob(input: MusicGenerationInput): Job {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    input,
    status: 'queued',
    progress: 0,
    createdAt: now,
    updatedAt: now,
  }
}

// ── Advance Job (simulate progress) ──────────────────────────────────────────

export type MockJobStep =
  | 'queued'
  | 'generating_20'
  | 'generating_50'
  | 'generating_80'
  | 'success'
  | 'failed'

export function advanceMockJob(job: Job, step: MockJobStep): Job {
  const now = new Date().toISOString()
  const updated = { ...job, updatedAt: now }

  switch (step) {
    case 'queued':
      return { ...updated, status: 'queued', progress: 0 }
    case 'generating_20':
      return { ...updated, status: 'generating', progress: 20 }
    case 'generating_50':
      return { ...updated, status: 'generating', progress: 50 }
    case 'generating_80':
      return { ...updated, status: 'generating', progress: 80 }
    case 'success': {
      const track = createMockTrack(job.input)
      return { ...updated, status: 'success', progress: 100, track }
    }
    case 'failed':
      return {
        ...updated,
        status: 'failed',
        progress: 0,
        error: '生成失败，请稍后重试',
      }
  }
}

// ── Mock Progress Sequence ────────────────────────────────────────────────────

export const MOCK_JOB_STEPS: MockJobStep[] = [
  'queued',
  'generating_20',
  'generating_50',
  'generating_80',
  'success',
]