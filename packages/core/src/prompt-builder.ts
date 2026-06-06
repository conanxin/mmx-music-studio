// ─── Prompt Builder ────────────────────────────────────────────────────────────

import type { ExpandedPromptOptions } from './types.js'

const MOOD_MAP: Record<string, string> = {
  安静: 'quiet, calm, serene',
  明亮: 'bright, uplifting, cheerful',
  梦幻: 'dreamy, ethereal, atmospheric',
  '电影感': 'cinematic, epic, dramatic',
  电子: 'electronic, synth, digital',
  钢琴: 'piano-driven, melodic',
  吉他: 'guitar-driven, acoustic',
  'Lo-fi': 'lo-fi, chilled, relaxed',
  悲伤: 'sad, melancholic, emotional',
  欢快: 'joyful, upbeat, lively',
  神秘: 'mysterious, dark, intriguing',
  浪漫: 'romantic, tender, warm',
  激烈: 'intense, powerful, energetic',
  放松: 'relaxing, soothing, laid-back',
  励志: 'inspirational, uplifting, motivational',
}

const VOCAL_MAP: Record<string, string> = {
  zh: 'Mandarin vocal',
  en: 'English vocal',
  ja: 'Japanese vocal',
  ko: 'Korean vocal',
}

export function buildExpandedPrompt(options: ExpandedPromptOptions): string {
  const parts: string[] = []
  const { mode, description, moodTags = [], instrumentTags = [], language } = options

  // Base description
  if (description.trim()) {
    parts.push(description.trim())
  }

  // Mood tags
  for (const tag of moodTags) {
    const mapped = MOOD_MAP[tag]
    if (mapped) parts.push(mapped)
    else parts.push(tag.toLowerCase())
  }

  // Instrument tags
  for (const tag of instrumentTags) {
    const mapped = MOOD_MAP[tag]
    if (mapped) parts.push(mapped)
    else parts.push(tag.toLowerCase())
  }

  // Mode-specific additions
  if (mode === 'instrumental') {
    parts.push('instrumental')
    parts.push('no vocals')
  } else if (mode === 'auto') {
    const lang = language || 'zh'
    const vocal = VOCAL_MAP[lang] || 'vocal'
    parts.push(vocal)
  } else if (mode === 'lyrics') {
    const lang = language || 'zh'
    const vocal = VOCAL_MAP[lang] || 'vocal'
    parts.push(vocal)
  } else if (mode === 'cover-url' || mode === 'cover-file') {
    parts.push('cover version')
    parts.push('style adaptation')
  }

  // Join and cap at 1000 chars
  let result = parts.join(', ')
  if (result.length > 1000) {
    result = result.slice(0, 997) + '...'
  }
  return result
}