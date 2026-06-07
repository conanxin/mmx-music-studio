// audio.ts — Audio playback adapter for WeChat Mini Program
// Phase 3A: mock implementation
// Phase 3C+: use wx.createInnerAudioContext

import type { AudioPlayer } from '../types'

let _innerAudioContext: ReturnType<typeof wx.createInnerAudioContext> | null = null

const getAudio = () => {
  if (!_innerAudioContext) {
    _innerAudioContext = wx.createInnerAudioContext()
  }
  return _innerAudioContext
}

export const createPlayer = (): AudioPlayer => {
  const audio = getAudio()

  return {
    play: (url: string) => {
      audio.src = url
      audio.play()
    },
    pause: () => {
      audio.pause()
    },
    stop: () => {
      audio.stop()
    },
    destroy: () => {
      audio.destroy()
      _innerAudioContext = null
    },
    onPlay: undefined,
    onPause: undefined,
    onEnded: undefined,
    onTimeUpdate: undefined,
    onError: undefined,
  }
}

// Phase 3A: mock audio state (no real playback)
export const isAudioAvailable = (): boolean => {
  try {
    return typeof wx.createInnerAudioContext === 'function'
  } catch {
    return false
  }
}

// Phase 3A: format seconds to MM:SS
export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}