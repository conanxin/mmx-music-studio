import { Component } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { MOCK_TRACKS, formatDuration, formatRelativeTime } from '../../mock/tracks'
import { MODE_LABELS, type MusicMode } from '../../types'
import { listTracks } from '../../adapters/request'
import { ServerTrack } from '../../adapters/request'
import './index.scss'

type LocalTrack = typeof MOCK_TRACKS[0];

export default class Library extends Component<Record<string, unknown>, {
  serverTracks: ServerTrack[]
  isLoading: boolean
  usingServer: boolean
}> {
  state = {
    serverTracks: [],
    isLoading: true,
    usingServer: false,
  }

  async componentDidMount() {
    try {
      const tracks = await listTracks()
      if (tracks.length > 0) {
        this.setState({ serverTracks: tracks, isLoading: false, usingServer: true })
        return
      }
    } catch { /* fallback */ }
    this.setState({ isLoading: false, usingServer: false })
  }

  getSourceLabel(track: ServerTrack | LocalTrack): string {
    if ('generationSource' in track) {
      const src = track.generationSource as string
      if (src === 'mock') return 'Server Mock'
      if (src === 'cli') return 'MMX CLI'
      if (src === 'api') return 'MiniMax API'
      return src
    }
    return '本地 Mock'
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
                : `${MOCK_TRACKS.length} 个本地 Mock 作品`
              }
            </Text>
          </View>
          {usingServer && (
            <Text className="data-source-note">
              数据来源：Server Mock · 不消耗额度
            </Text>
          )}
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
                    <View className="action-btn">
                     <Text>🎧 试听</Text>
                    </View>
                    <View className="action-btn">
                      <Text>💾 下载</Text>
                    </View>
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
            Phase 3B · Server Mock API · 不消耗额度
          </Text>
        </View>
      </View>
    )
  }
}

// re-export for template usage
type MusicMode = 'instrumental' | 'auto' | 'lyrics' | 'cover'