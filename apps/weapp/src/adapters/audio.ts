// audio.ts — Audio playback adapter for WeChat Mini Program
// Phase 3C: wx.createInnerAudioContext implementation
// Platform: WeChat Mini Program (Taro weapp)

// @ts-ignore Taro types have internal esModuleInterop issues
import Taro from '@tarojs/taro';
import type { AudioPlayer } from '../types';

// Audio state managed outside React state for performance
export interface WeappAudioState {
  playing: boolean
  loading: boolean
  currentTime: number
  duration: number
  error?: string
}

interface AudioControllerOptions {
  onStateChange?: (state: WeappAudioState) => void
  onEnded?: () => void
  onError?: (message: string) => void
}

// Singleton audio context (one track at a time in mini program)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _audioCtx: any = null
let _currentSrc = ''
let _options: AudioControllerOptions = {}
let _state: WeappAudioState = {
  playing: false,
  loading: false,
  currentTime: 0,
  duration: 0,
  error: undefined,
}

interface InnerAudioContext {
  src: string
  startTime: number
  autoplay: boolean
  loop: boolean
  volume: number
  obeyMuteSwitch: boolean
  onCanplay: (fn: () => void) => InnerAudioContext
  onTimeUpdate: (fn: () => void) => InnerAudioContext
  onEnded: (fn: () => void) => InnerAudioContext
  onError: (fn: (e: { errMsg: string }) => void) => InnerAudioContext
  onWaiting: (fn: () => void) => InnerAudioContext
  onPlay: (fn: () => void) => InnerAudioContext
  onPause: (fn: () => void) => InnerAudioContext
  play: () => void
  pause: () => void
  stop: () => void
  seek: (position: number) => void
  destroy: () => void
}

function getCtx(): InnerAudioContext {
  if (!_audioCtx) {
    // Taro wrapper for wx.createInnerAudioContext
    _audioCtx = Taro.createInnerAudioContext()
    _audioCtx.onCanplay(onCanplay)
    _audioCtx.onTimeUpdate(onTimeUpdate)
    _audioCtx.onEnded(onEnded)
    _audioCtx.onError(onError)
    _audioCtx.onWaiting(onWaiting)
    _audioCtx.onPlay(onPlay)
    _audioCtx.onPause(onPause)
  }
  return _audioCtx
}

function emit(state: Partial<WeappAudioState>) {
  _state = { ..._state, ...state }
  _options.onStateChange?.(_state)
}

function onCanplay() {
  emit({ loading: false })
}

function onTimeUpdate() {
  if (_audioCtx) {
    emit({ currentTime: _audioCtx.currentTime, duration: _audioCtx.duration })
  }
}

function onEnded() {
  emit({ playing: false, currentTime: 0 })
  _options.onEnded?.()
}

function onError(e: { errMsg: string }) {
  let msg = '音频加载失败'
  if (e?.errMsg) {
    if (e.errMsg.includes('net::ERR') || e.errMsg.includes('dns')) {
      msg = '网络连接失败'
    } else if (e.errMsg.includes('abort')) {
      msg = '音频暂时无法播放'
    } else {
      msg = '音频加载失败'
    }
  }
  emit({ playing: false, loading: false, error: msg })
  _options.onError?.(msg)
}

function onWaiting() {
  emit({ loading: true })
}

function onPlay() {
  emit({ playing: true, loading: false })
}

function onPause() {
  emit({ playing: false })
}

// AudioPlayer interface already has play(url), pause, stop, destroy
// Weapp adapter extends it with seek() and getState()
export function createAudioController(options: AudioControllerOptions = {}): AudioPlayer & { seek(s: number): void; getState(): WeappAudioState } {
  _options = options
  return {
    play(src: string) {
      const ctx = getCtx()
      _currentSrc = src
      emit({ loading: true, currentTime: 0, error: undefined })
      ctx.src = src
    },
    pause() { getCtx().pause() },
    stop() {
      const ctx = getCtx()
      ctx.stop()
      ctx.seek(0)
      emit({ playing: false, currentTime: 0 })
    },
    destroy() {
      if (_audioCtx) {
        _audioCtx.destroy()
        _audioCtx = null
        _currentSrc = ''
        _state = { playing: false, loading: false, currentTime: 0, duration: 0, error: undefined }
      }
    },
    seek(seconds: number) {
      getCtx().seek(seconds)
      emit({ currentTime: seconds })
    },
    getState() {
      return { ..._state }
    },
  }
}
