// mock/tracks.ts — Mock track data for Phase 3A
// No real API calls, no real audio, no API keys

import type { Track } from '../types'

export const MOCK_TRACKS: Track[] = [
  {
    id: 'mock_track_001',
    title: '深夜编程',
    mode: 'instrumental',
    model: 'music-2.6',
    prompt: '深夜编程，warm electronic ambient, calm, focused',
    status: 'success',
    audioUrl: undefined,
    downloadUrl: undefined,
    audioFormat: 'mp3',
    durationSeconds: 223,
    generationSource: 'mock',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'mock_track_002',
    title: '周末咖啡馆',
    mode: 'instrumental',
    model: 'music-2.6',
    prompt: 'lo-fi hip hop, study, coffee shop, relaxed',
    status: 'success',
    audioUrl: undefined,
    downloadUrl: undefined,
    audioFormat: 'mp3',
    durationSeconds: 187,
    generationSource: 'mock',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'mock_track_003',
    title: '夏夜海滩',
    mode: 'auto',
    model: 'music-2.6',
    prompt: 'summer night beach, upbeat pop, happy vibes',
    status: 'success',
    audioUrl: undefined,
    downloadUrl: undefined,
    audioFormat: 'mp3',
    durationSeconds: 201,
    generationSource: 'mock',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'mock_track_004',
    title: '梦境漫游',
    mode: 'instrumental',
    model: 'music-2.6',
    prompt: 'dreamy, ambient, ethereal, cinematic',
    status: 'success',
    audioUrl: undefined,
    downloadUrl: undefined,
    audioFormat: 'mp3',
    durationSeconds: 264,
    generationSource: 'mock',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
]

export const getMockTrack = (id: string): Track | undefined => {
  return MOCK_TRACKS.find(t => t.id === id)
}

export const addMockTrack = (track: Track): void => {
  // Phase 3A: in-memory only (not persisted)
  MOCK_TRACKS.unshift(track)
}

export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const formatRelativeTime = (isoString: string): string => {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  return `${days} 天前`
}