import { Component } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { MOCK_TRACKS, formatDuration, formatRelativeTime } from '../../mock/tracks'
import { MODE_LABELS } from '../../types'
import './index.scss'

export default function Library() {
  return (
    <View className="page library-page">
      <View className="library-header">
        <Text className="page-title">作品库</Text>
        <View className="status-bar" style="margin-top:8px">
          <View className="status-dot mock" />
          <Text>{MOCK_TRACKS.length} 个 Mock 作品</Text>
        </View>
      </View>

      <ScrollView scrollY className="track-list">
        {MOCK_TRACKS.map(track => (
          <View key={track.id} className="track-card card">
            <View className="track-header">
              <View className="track-title-group">
                <Text className="track-title">{track.title}</Text>
                <View className="track-tags">
                  <View className="tag tag-warning">Mock</View>
                  <View className="tag tag-accent">{MODE_LABELS[track.mode]}</View>
                </View>
              </View>
            </View>

            <View className="track-meta">
              <Text className="meta-text">
                {formatDuration(track.durationSeconds || 0)} · {formatRelativeTime(track.createdAt)}
              </Text>
            </View>

            <View className="track-actions">
              <View className="action-btn">
                <Text>🎧 试听</Text>
              </View>
              <View className="action-btn">
                <Text>💾 下载</Text>
              </View>
              <View className="action-btn action-btn-danger">
                <Text>🗑 删除</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View className="library-footer">
        <Text className="footer-note">
          Phase 3A · Mock 数据，不消耗额度
        </Text>
      </View>
    </View>
  )
}