export type MusicMode = 'pure-music' | 'auto-song' | 'lyric-song' | 'cover'

export type TaskStatus = 'idle' | 'generating' | 'completed' | 'failed'

export interface MusicTask {
  id: string
  title: string
  mode: MusicMode
  prompt: string
  status: TaskStatus
  audioUrl?: string
  duration?: number
  createdAt: Date
}

export interface KeyConfig {
  key: string
  region: 'cn' | 'global'
  backend: 'api' | 'cli'
  storageMode: 'session' | 'server'
}

export const MODE_LABELS: Record<MusicMode, string> = {
  'pure-music': '纯音乐',
  'auto-song': '自动成歌',
  'lyric-song': '歌词成歌',
  'cover': '参考改编',
}

export const STYLE_TAGS = [
  '安静', '明亮', '梦幻', '电影感', '电子', '钢琴', '吉他', 'Lo-fi',
  '流行', '民谣', '摇滚', 'R&B', '古风', '古典', '爵士', '蓝调',
]

export const MODELS = [
  { value: 'music-2.6', label: 'music-2.6（最新）' },
  { value: 'music-2.5', label: 'music-2.5' },
]

export const OUTPUT_FORMATS = [
  { value: 'mp3', label: 'MP3' },
  { value: 'wav', label: 'WAV' },
]

export const QUALITY_OPTIONS = [
  { value: '44.1kHz/256kbps', label: '44.1kHz / 256kbps' },
  { value: '48kHz/320kbps', label: '48kHz / 320kbps' },
]

export const MOCK_TASKS: MusicTask[] = [
  {
    id: '1',
    title: '深夜编程',
    mode: 'pure-music',
    prompt: '深夜编程、专注、轻松爵士、咖啡馆氛围',
    status: 'completed',
    audioUrl: '/mock/track1.mp3',
    duration: 224,
    createdAt: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: '2',
    title: '夏日旅行',
    mode: 'pure-music',
    prompt: '夏日旅行、明亮、清新、民谣吉他',
    status: 'completed',
    audioUrl: '/mock/track2.mp3',
    duration: 151,
    createdAt: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: '3',
    title: '雨后咖啡馆',
    mode: 'pure-music',
    prompt: '雨后、咖啡馆、放松、钢琴独奏',
    status: 'completed',
    audioUrl: '/mock/track3.mp3',
    duration: 252,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: '4',
    title: '赛博朋克',
    mode: 'pure-music',
    prompt: '赛博朋克、未来感、电子合成器、紧张氛围',
    status: 'completed',
    audioUrl: '/mock/track4.mp3',
    duration: 198,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
]

export const MOCK_CURRENT_TRACK: MusicTask = {
  id: 'current',
  title: '深夜编程',
  mode: 'pure-music',
  prompt: '深夜编程、专注、轻松爵士、咖啡馆氛围',
  status: 'completed',
  audioUrl: '/mock/track1.mp3',
  duration: 224,
  createdAt: new Date(),
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString('zh-CN')
}