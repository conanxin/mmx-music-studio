// studio/index.tsx — 创作台页面（Phase 3C: audio + download）
// Phase 3B: server mock API integration
// Phase 3C: audio playback + download for generated tracks

import { useState, useEffect, useRef } from 'react'
import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
// @ts-ignore Taro types have internal esModuleInterop issues
import Taro from '@tarojs/taro'
import type { MusicMode, AudioPlayer } from '../../types'
import { MODE_LABELS, MODE_BTN_LABELS, STYLE_TAGS, type StyleTag } from '../../types'
import { MOCK_TRACKS } from '../../mock/tracks'
import { generateTrack, getHealth, HealthInfo } from '../../adapters/request'
import { getApiBaseFromConfig, DEFAULT_API_BASE } from '../../config/api'
import { createAudioController } from '../../adapters/audio'
import { downloadAndSaveAudio } from '../../adapters/download'
import { hasSessionApiKey } from '../../adapters/byok'
import './index.scss'

const MODE_ORDER: MusicMode[] = ['instrumental', 'auto', 'lyrics', 'cover']

const PROGRESS_MESSAGES = [
  '正在连接后端…',
  '正在提交任务…',
  '正在生成音乐（Server Mock）…',
  '生成时间较长，请耐心等待…',
]

type TrackLike = {
  id: string
  title: string
  mode: MusicMode
  durationSeconds: number
  source: string
  createdAt: string
  audioUrl?: string
  downloadUrl?: string
}

// Extended type for weapp audio controller
type WeappAudioCtrl = AudioPlayer & { seek(s: number): void; getState(): { playing: boolean; loading: boolean; currentTime: number; duration: number; error?: string } }

export default function Studio() {
  const [mode, setMode] = useState<MusicMode>('instrumental')
  const [prompt, setPrompt] = useState('')
  const [selectedStyles, setSelectedStyles] = useState<StyleTag[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [progressStep, setProgressStep] = useState(0)
  const [showPlayer, setShowPlayer] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<TrackLike | null>(null)
  const [sourceLabel, setSourceLabel] = useState('Mock')
  const [generationSource, setGenerationSource] = useState('local-mock')
  const [playingState, setPlayingState] = useState<'idle' | 'loading' | 'playing' | 'paused' | 'error'>('idle')
  const [downloadState, setDownloadState] = useState<'idle' | 'loading'>('idle')
  const [byokKeyMissing, setByokKeyMissing] = useState(false)
  const [byokQuotaWarning, setByokQuotaWarning] = useState(false)
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null)

  const audioCtrlRef = useRef<WeappAudioCtrl | null>(null)

  // Initialize audio controller once
  useEffect(() => {
    audioCtrlRef.current = createAudioController({
      onStateChange: (audioState) => {
        setPlayingState(
          audioState.error
            ? 'error'
            : audioState.loading
            ? 'loading'
            : audioState.playing
            ? 'playing'
            : 'idle',
        )
      },
      onEnded: () => setPlayingState('idle'),
      onError: () => setPlayingState('error'),
    })
    return () => {
      audioCtrlRef.current?.destroy()
      audioCtrlRef.current = null
    }
  }, [])

  // Phase 5C: Check health info + BYOK key status on mount
  useEffect(() => {
    const checkByokStatus = async () => {
      try {
        const info = await getHealth()
        setHealthInfo(info)
        // Check if real generation requires BYOK key
        if (
          info.backend === 'api' &&
          info.realGenerationEnabled &&
          info.byokEnabled === true &&
          !hasSessionApiKey()
        ) {
          setByokKeyMissing(true)
        }
        if (
          info.backend === 'api' &&
          info.realGenerationEnabled &&
          info.byokEnabled
        ) {
          setByokQuotaWarning(true)
        }
      } catch {
        // health check failed — ignore, continue in mock mode
      }
    }
    checkByokStatus()
  }, [])

  const toggleStyle = (style: StyleTag) => {
    setSelectedStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style],
    )
  }

  const hasAudio = (track: TrackLike | null): boolean => {
    if (!track) return false
    return !!track.audioUrl
  }

  const getAudioUrl = (track: TrackLike | null): string => {
    if (!track?.audioUrl) return ''
    if (track.audioUrl.startsWith('/')) {
      return `${window.location.origin}${track.audioUrl}`
    }
    return track.audioUrl
  }

  const getDownloadUrl = (track: TrackLike | null): string => {
    if (!track?.downloadUrl) return ''
    if (track.downloadUrl.startsWith('/')) {
      return `${window.location.origin}${track.downloadUrl}`
    }
    return track.downloadUrl
  }

  const handlePlayPause = () => {
    const ctrl = audioCtrlRef.current
    if (!ctrl) return

    if (playingState === 'playing') {
      ctrl.pause()
    } else {
      const url = getAudioUrl(currentTrack)
      if (!url) {
        Taro.showToast({ title: '暂无音频文件', icon: 'none' })
        return
      }
      // play(url) loads and autoplays
      ctrl.play(url)
    }
  }

  const handleDownload = () => {
    const url = getDownloadUrl(currentTrack)
    if (!url) {
      Taro.showToast({ title: '暂无音频文件', icon: 'none' })
      return
    }

    setDownloadState('loading')
    Taro.showLoading({ title: '保存中…' })

    downloadAndSaveAudio({ url, title: currentTrack!.title })
      // @ts-ignore Taro callback result typing mismatch
      .then((result: { message: string }) => {
        Taro.hideLoading()
        Taro.showToast({ title: result.message, icon: 'none' })
      })
      .catch(() => {
        Taro.hideLoading()
        Taro.showToast({ title: '保存失败', icon: 'none' })
      })
      .finally(() => setDownloadState('idle'))
  }

  const handleGenerate = async () => {
    if (isGenerating) return
    if (!prompt.trim()) {
      setProgressMessage('请输入音乐描述')
      setTimeout(() => setProgressMessage(''), 2000)
      return
    }

    setIsGenerating(true)
    setShowPlayer(false)
    setProgressStep(0)
    setProgressMessage(PROGRESS_MESSAGES[0])

    let step = 0
    const stepTimer = setInterval(() => {
      step++
      if (step < PROGRESS_MESSAGES.length) {
        setProgressStep(step)
        setProgressMessage(PROGRESS_MESSAGES[step])
      }
    }, 3000)

    const styleStr = selectedStyles.length > 0 ? selectedStyles.join('、') : ''

    try {
      const res = await generateTrack({
        mode,
        prompt: styleStr ? `${prompt.trim()}，${styleStr}` : prompt.trim(),
        model: 'music-2.6',
        outputFormat: 'mp3',
      })

      clearInterval(stepTimer)

      if (res.ok && res.track) {
        const track = res.track
        const audioUrl = track.audioUrl
          ? (track.audioUrl.startsWith('/')
            ? `${window.location.origin}${track.audioUrl}`
            : track.audioUrl)
          : undefined
        const downloadUrl = track.downloadUrl
          ? (track.downloadUrl.startsWith('/')
            ? `${window.location.origin}${track.downloadUrl}`
            : track.downloadUrl)
          : undefined

        setCurrentTrack({
          id: track.id,
          title: track.title,
          mode: track.mode as MusicMode,
          durationSeconds: Math.floor(track.durationMs / 1000),
          source: res.generationSource as string,
          createdAt: track.createdAt,
          audioUrl,
          downloadUrl,
        })
        setSourceLabel('Server Mock')
        setGenerationSource(res.generationSource)
        setShowPlayer(true)
      } else {
        fallbackToLocalMock()
      }
    } catch {
      clearInterval(stepTimer)
      fallbackToLocalMock()
    } finally {
      setIsGenerating(false)
      setProgressMessage('')
      setProgressStep(0)
    }
  }

  const fallbackToLocalMock = () => {
    const mock = MOCK_TRACKS[Math.floor(Math.random() * MOCK_TRACKS.length)]
    setCurrentTrack({
      id: mock.id,
      title: mock.title,
      mode: mock.mode,
      durationSeconds: mock.durationSeconds || 0,
      source: 'local-mock',
      createdAt: mock.createdAt,
      audioUrl: undefined,
      downloadUrl: undefined,
    })
    setSourceLabel('本地 Mock')
    setGenerationSource('local-mock')
    setShowPlayer(true)
  }

  const playable = hasAudio(currentTrack)
  const playableIcon =
    playingState === 'loading' ? '⏳' : playingState === 'playing' ? '⏸' : '▶'
  const downloadLabel = downloadState === 'loading' ? '保存中…' : '💾 下载'

  return (
    <View className="page studio-page">
      {/* Header */}
      <View className="studio-header">
        <Text className="page-title">今天想创作什么音乐？</Text>
        <View className="status-bar">
          <View className="status-dot mock" />
          <Text className="status-text">
            {getApiBaseFromConfig() || DEFAULT_API_BASE}
          </Text>
        </View>
        <Text className="phase-label">Phase 3C</Text>
      </View>

      {/* Mode tabs */}
      <ScrollView scrollX className="mode-tabs-wrap">
        <View className="mode-tabs">
          {MODE_ORDER.map(m => (
            <View
              key={m}
              className={`mode-tab ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              <Text>{MODE_LABELS[m]}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Prompt */}
      <View className="form-group">
        <Text className="section-title">音乐描述</Text>
        <Textarea
          className="prompt-input"
          placeholder="描述你想要音乐的感觉…例如：深夜编程，温暖电子氛围，放松专注"
          value={prompt}
          onInput={(e) => setPrompt(((e as unknown as {detail: {value: string}}).detail?.value) || '')}
          maxlength={500}
        />
      </View>

      {/* Style tags */}
      <View className="form-group">
        <Text className="section-title">风格标签</Text>
        <View className="style-tags">
          {STYLE_TAGS.map(style => (
            <View
              key={style}
              className={`style-tag ${selectedStyles.includes(style) ? 'selected' : ''}`}
              onClick={() => toggleStyle(style)}
            >
              <Text>{style}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Progress */}
      {isGenerating && (
        <View className="progress-card">
          <Text className="progress-message">{progressMessage}</Text>
          <View className="progress-bar-wrap">
            <View
              className="progress-bar-fill"
              style={`width:${((progressStep + 1) / PROGRESS_MESSAGES.length) * 100}%`}
            />
          </View>
          <Text className="progress-hint">当前为 Server Mock，不消耗额度</Text>
        </View>
      )}

      {/* Phase 5C: BYOK key missing warning */}
      {byokKeyMissing && (
        <View className="byok-banner byok-banner--warn">
          <Text className="byok-banner-text">
            ⚠️ 请先在「设置」填入您的 MiniMax Token Plan Key，否则无法生成真实音乐
          </Text>
        </View>
      )}

      {/* Phase 5C: Quota warning for BYOK mode */}
      {byokQuotaWarning && !byokKeyMissing && (
        <View className="byok-banner byok-banner--info">
          <Text className="byok-banner-text">
            💡 您的额度由 MiniMax Token Plan 提供，请留意剩余额度
          </Text>
        </View>
      )}

      {/* Generate button */}
      <Button
        className={`btn-primary generate-btn ${isGenerating ? 'btn-disabled' : ''} ${byokKeyMissing ? 'btn-disabled' : ''}`}
        onClick={byokKeyMissing ? undefined : handleGenerate}
        disabled={isGenerating || byokKeyMissing}
      >
        <Text>{isGenerating ? '生成中…' : MODE_BTN_LABELS[mode]}</Text>
      </Button>

      {/* Player card */}
      {showPlayer && currentTrack && (
        <View className="player-card card">
          <View className="player-title-row">
            <Text className="player-title">{currentTrack.title}</Text>
            <View className={`tag ${generationSource === 'mock' ? 'tag-success' : 'tag-warning'}`}>
              {sourceLabel}
            </View>
          </View>
          <View className="player-waveform">
            {Array.from({ length: 40 }).map((_, i) => (
              <View
                key={i}
                className="waveform-bar"
                style={`height:${20 + Math.sin(i * 0.5) * 20 + 20}px;opacity:${0.4 + Math.cos(i * 0.3) * 0.3}`}
              />
            ))}
          </View>
          <View className="player-time">
            <Text>0:00</Text>
            <Text>
              {Math.floor((currentTrack.durationSeconds || 0) / 60)}:
              {String((currentTrack.durationSeconds || 0) % 60).padStart(2, '0')}
            </Text>
          </View>
          <View className="player-controls">
            <View
              className={`play-btn ${!playable ? 'disabled' : ''}`}
              onClick={playable ? handlePlayPause : undefined}
            >
              <Text className="play-icon">{playableIcon}</Text>
            </View>
            <View className="action-btns">
              <View
                className={`action-btn ${downloadState === 'loading' ? 'loading' : ''} ${!playable ? 'disabled' : ''}`}
                onClick={playable ? handleDownload : undefined}
              >
                <Text>{downloadLabel}</Text>
              </View>
            </View>
          </View>
          {!playable && (
            <Text className="player-no-audio">暂无音频文件</Text>
          )}
        </View>
      )}

      {/* Recent tracks */}
      <View className="recent-section">
        <Text className="section-title">最近作品</Text>
        {MOCK_TRACKS.slice(0, 3).map(track => (
          <View key={track.id} className="track-item card">
            <View className="track-info">
              <Text className="track-title">{track.title}</Text>
              <Text className="track-meta">
                {MODE_LABELS[track.mode]} ·{' '}
                {Math.floor((track.durationSeconds || 0) / 60)}:
                {String((track.durationSeconds || 0) % 60).padStart(2, '0')}
              </Text>
            </View>
            <View className="tag tag-warning">本地 Mock</View>
          </View>
        ))}
      </View>
    </View>
  )
}
