// library/index.tsx — 作品库页面（Phase 3C: audio + download）
// Phase 3B: server mock API integration
// Phase 3C: audio playback + download save

import { Component } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
// @ts-ignore Taro types have internal esModuleInterop issues
import Taro from '@tarojs/taro'
import { MOCK_TRACKS, formatDuration, formatRelativeTime } from '../../mock/tracks'
import { MODE_LABELS, type MusicMode } from '../../types'
import { listTracks, getTrackAudioUrl, getTrackDownloadUrl } from '../../adapters/request'
import type { ServerTrack } from '../../adapters/request'
import { createAudioController } from '../../adapters/audio'
import { downloadAndSaveAudio } from '../../adapters/download'
import type { AudioPlayer } from '../../types'
import './index.scss'

type LocalTrack = typeof MOCK_TRACKS[0]
type AnyTrack = ServerTrack | LocalTrack

// Extended type for weapp audio controller with seek/getState
type WeappAudioCtrl = AudioPlayer & { seek(s: number): void; getState(): { playing: boolean; loading: boolean; currentTime: number; duration: number; error?: string } }

export default class Library extends Component<Record<string, unknown>, {
  serverTracks: ServerTrack[]
  isLoading: boolean
  usingServer: boolean
  playingTrackId: string | null
  playingState: 'idle' | 'loading' | 'playing' | 'paused' | 'error'
  playingTrackMsg: string
  downloadingTrackId: string | null
  downloadMsg: string
}> {
  private audioCtrl: WeappAudioCtrl | null = null

  state = {
    serverTracks: [],
    isLoading: true,
    usingServer: false,
    playingTrackId: null,
    playingState: 'idle' as 'idle' | 'loading' | 'playing' | 'paused' | 'error',
    playingTrackMsg: '',
    downloadingTrackId: null,
    downloadMsg: '',
  }

  async componentDidMount() {
    // 初始化 audio controller
    this.audioCtrl = createAudioController({
      onStateChange: (audioState) => {
        this.setState({
          playingState: audioState.playing
            ? 'playing'
            : audioState.loading
            ? 'loading'
            : 'idle',
          playingTrackMsg: audioState.error ?? '',
        })
      },
      onEnded: () => {
        this.setState({ playingTrackId: null, playingState: 'idle' })
      },
      onError: (msg) => {
        this.setState({ playingState: 'error', playingTrackMsg: msg })
      },
    })

    try {
      const tracks = await listTracks()
      if (tracks.length > 0) {
        this.setState({ serverTracks: tracks, isLoading: false, usingServer: true })
        return
      }
    } catch { /* fallback */ }
    this.setState({ isLoading: false, usingServer: false })
  }

  componentWillUnmount() {
    this.audioCtrl?.destroy()
    this.audioCtrl = null
  }

  getSourceLabel(track: AnyTrack): string {
    if ('generationSource' in track) {
      const src = track.generationSource as string
      if (src === 'mock') return 'Server Mock'
      if (src === 'cli') return 'MMX CLI'
      if (src === 'api') return 'MiniMax API'
      return src
    }
    return '本地 Mock'
  }

  hasAudio(track: AnyTrack): boolean {
    if ('audioUrl' in track) {
      return !!track.audioUrl
    }
    return false
  }

  getAudioUrl(track: ServerTrack): string {
    if (track.audioUrl) {
      if (track.audioUrl.startsWith('/')) {
        return `${window.location.origin}${track.audioUrl}`
      }
      return track.audioUrl
    }
    return ''
  }

  getDownloadUrl(track: ServerTrack): string {
    if (track.downloadUrl) {
      if (track.downloadUrl.startsWith('/')) {
        return `${window.location.origin}${track.downloadUrl}`
      }
      return track.downloadUrl
    }
    return ''
  }

  handlePlayPause(track: AnyTrack) {
    const trackId = track.id
    const { playingTrackId, playingState } = this.state

    if (!this.hasAudio(track)) {
      Taro.showToast({ title: '暂无音频文件', icon: 'none' })
      return
    }

    if (playingTrackId === trackId) {
      if (playingState === 'playing') {
        this.audioCtrl?.pause()
        this.setState({ playingState: 'paused' })
      } else {
        // Resume: AudioPlayer.play(url) autoplays, just call it again
        const serverTrack = track as ServerTrack
        this.audioCtrl?.play(this.getAudioUrl(serverTrack))
      }
    } else {
      const serverTrack = track as ServerTrack
      const audioUrl = this.getAudioUrl(serverTrack)
      if (!audioUrl) {
        Taro.showToast({ title: '暂无音频文件', icon: 'none' })
        return
      }
      // play(url) loads and autoplays
      this.audioCtrl?.play(audioUrl)
      this.setState({ playingTrackId: trackId, playingState: 'loading' })
    }
  }

  handleDownload(track: AnyTrack) {
    if (!this.hasAudio(track)) {
      Taro.showToast({ title: '暂无音频文件', icon: 'none' })
      return
    }

    const serverTrack = track as ServerTrack
    const downloadUrl = this.getDownloadUrl(serverTrack)
    if (!downloadUrl) {
      Taro.showToast({ title: '下载链接无效', icon: 'none' })
      return
    }

    this.setState({ downloadingTrackId: track.id })
    Taro.showLoading({ title: '保存中…' })

    downloadAndSaveAudio({ url: downloadUrl, title: track.title })
      // @ts-ignore Taro callback result typing mismatch
      .then((result: { message: string }) => {
        Taro.hideLoading()
        Taro.showToast({ title: result.message, icon: 'none' })
      })
      .catch(() => {
        Taro.hideLoading()
        Taro.showToast({ title: '保存失败', icon: 'none' })
      })
      .finally(() => {
        this.setState({ downloadingTrackId: null })
      })
  }

  renderPlayBtn(track: AnyTrack) {
    const { playingTrackId, playingState } = this.state
    const isThisTrack = playingTrackId === track.id
    const isPlaying = isThisTrack && playingState === 'playing'
    const isLoading = isThisTrack && playingState === 'loading'
    const noAudio = !this.hasAudio(track)

    if (noAudio) {
      return (
        <View className="action-btn disabled">
          <Text>🎧 试听</Text>
        </View>
      )
    }
    return (
      <View
        className={`action-btn ${isPlaying ? 'active' : ''}`}
        onClick={() => this.handlePlayPause(track)}
      >
        <Text>{isLoading ? '⏳' : isPlaying ? '⏸' : '🎧'} 试听</Text>
      </View>
    )
  }

  renderDownloadBtn(track: AnyTrack) {
    const { downloadingTrackId } = this.state
    const isDownloading = downloadingTrackId === track.id
    const noAudio = !this.hasAudio(track)

    if (noAudio) {
      return (
        <View className="action-btn disabled">
          <Text>💾 下载</Text>
        </View>
      )
    }
    return (
      <View
        className={`action-btn ${isDownloading ? 'loading' : ''}`}
        onClick={() => this.handleDownload(track)}
      >
        <Text>{isDownloading ? '⏳' : '💾'} 下载</Text>
      </View>
    )
  }

  render() {
    const { isLoading, usingServer } = this.state
    const displayTracks = usingServer
      ? this.state.serverTracks
      : MOCK_TRACKS

    return (
      <View className="page library-page">
        <View className="library-header">
          <Text className="page-title">作品库</Text>
          <View className="status-bar">
            <View className={`status-dot ${usingServer ? 'connected' : 'mock'}`} />
            <Text className="status-text">
              {usingServer
                ? `${this.state.serverTracks.length} 个 Server 作品`
                : `${MOCK_TRACKS.length} 个本地 Mock 作品`}
            </Text>
          </View>
          {usingServer && (
            <Text className="data-source-note">
              数据来源：Server Mock · 不消耗额度
            </Text>
          )}
          <Text className="phase-label">Phase 3C</Text>
        </View>

        {isLoading ? (
          <View className="loading-state">
            <Text>正在加载作品…</Text>
          </View>
        ) : (
          <ScrollView scrollY className="track-list">
            {displayTracks.map(track => {
              const isServerTrack = usingServer
              const durationSeconds = isServerTrack
                ? Math.floor((track as ServerTrack).durationMs / 1000)
                : (track as LocalTrack).durationSeconds || 0
              const createdAt = isServerTrack
                ? (track as ServerTrack).createdAt
                : (track as LocalTrack).createdAt
              const mode = isServerTrack
                ? (track as ServerTrack).mode as MusicMode
                : (track as LocalTrack).mode

              return (
                <View key={track.id} className="track-card card">
                  <View className="track-header">
                    <View className="track-title-group">
                      <Text className="track-title">{track.title}</Text>
                      <View className="track-tags">
                        <View className={`tag ${isServerTrack ? 'tag-success' : 'tag-warning'}`}>
                          {this.getSourceLabel(track)}
                        </View>
                        <View className="tag tag-accent">{MODE_LABELS[mode]}</View>
                      </View>
                    </View>
                  </View>

                  <View className="track-meta">
                    <Text className="meta-text">
                      {formatDuration(durationSeconds)} · {formatRelativeTime(createdAt)}
                    </Text>
                  </View>

                  <View className="track-actions">
                    {this.renderPlayBtn(track)}
                    {this.renderDownloadBtn(track)}
                  </View>
                </View>
              )
            })}

            {!usingServer && (
              <View className="fallback-notice">
                <Text>后端不可用，已使用本地 Mock 数据</Text>
                <Text className="fallback-hint">
                  可在「设置」中配置 API Base 并测试连接
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        <View className="library-footer">
          <Text className="footer-note">
            Phase 3C · 音频播放 + 下载保存 · 不消耗额度
          </Text>
        </View>
      </View>
    )
  }
}
