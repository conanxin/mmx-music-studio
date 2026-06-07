import { Component } from 'react'
import { View, Text, Textarea, Button, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import type { MusicMode } from '../../types'
import { MODE_LABELS, MODE_BTN_LABELS, STYLE_TAGS, type StyleTag } from '../../types'
import { MOCK_TRACKS } from '../../mock/tracks'
import './index.scss'

const MODE_ORDER: MusicMode[] = ['instrumental', 'auto', 'lyrics', 'cover']

const PROGRESS_MESSAGES = [
  '正在提交任务…',
  '正在生成音乐…',
  '生成时间较长，请耐心等待…',
  '仍在生成中，请不要重复点击…',
]

export default function Studio() {
  const [mode, setMode] = useState<MusicMode>('instrumental')
  const [prompt, setPrompt] = useState('')
  const [selectedStyles, setSelectedStyles] = useState<StyleTag[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMessage, setProgressMessage] = useState('')
  const [progressElapsed, setProgressElapsed] = useState(0)
  const [showPlayer, setShowPlayer] = useState(false)
  const [currentTrack, setCurrentTrack] = useState(MOCK_TRACKS[0])

  const toggleStyle = (style: StyleTag) => {
    setSelectedStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    )
  }

  const handleGenerate = () => {
    if (isGenerating) return
    setIsGenerating(true)
    setProgressMessage(PROGRESS_MESSAGES[0])
    setProgressElapsed(0)

    let step = 0
    const elapsed = setInterval(() => {
      setProgressElapsed(prev => prev + 1)
    }, 1000)

    const messages = ['正在提交任务…', '正在调用生成服务…', 'MiniMax 正在生成音乐…', '生成时间较长，请耐心等待…']
    let msgIdx = 0
    const msgTimer = setInterval(() => {
      msgIdx++
      if (msgIdx < messages.length) {
        setProgressMessage(messages[msgIdx])
      }
    }, 3000)

    setTimeout(() => {
      clearInterval(elapsed)
      clearInterval(msgTimer)
      setIsGenerating(false)
      setProgressMessage('')
      setProgressElapsed(0)
      setShowPlayer(true)
    }, 5000)
  }

  return (
    <View className="page studio-page">
      {/* Header */}
      <View className="studio-header">
        <Text className="page-title">今天想创作什么音乐？</Text>
        <View className="status-bar" style="margin-top:8px">
          <View className="status-dot mock" />
          <Text>Mock 模式 · 未消耗额度</Text>
        </View>
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
          onInput={(e) => setPrompt((e.detail as {value:string}).value)}
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
          <Text className="progress-elapsed">
            {Math.floor(progressElapsed / 60)}:{String(progressElapsed % 60).padStart(2, '0')} elapsed
          </Text>
        </View>
      )}

      {/* Generate button */}
      <Button
        className={`btn-primary generate-btn ${isGenerating ? 'disabled' : ''}`}
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        <Text>{isGenerating ? '生成中…' : MODE_BTN_LABELS[mode]}</Text>
      </Button>

      {/* Mock player */}
      {showPlayer && (
        <View className="player-card card">
          <View className="player-title-row">
            <Text className="player-title">{currentTrack.title}</Text>
            <View className="tag tag-warning">Mock</View>
          </View>
          <View className="player-waveform">
            {Array.from({ length: 40 }).map((_, i) => (
              <View
                key={i}
                className="waveform-bar"
                style={`height:${20 + Math.random() * 40}px;opacity:${0.4 + Math.random() * 0.6}`}
              />
            ))}
          </View>
          <View className="player-time">
            <Text>0:00</Text>
            <Text>{(currentTrack.durationSeconds || 0) / 60 | 0}:{String((currentTrack.durationSeconds || 0) % 60).padStart(2, '0')}</Text>
          </View>
          <View className="player-controls">
            <View className="play-btn">
              <Text className="play-icon">▶</Text>
            </View>
            <View className="action-btns">
              <View className="action-btn">
                <Text>下载</Text>
              </View>
            </View>
          </View>
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
                {MODE_LABELS[track.mode]} · {Math.floor((track.durationSeconds || 0) / 60)}:{String((track.durationSeconds || 0) % 60).padStart(2, '0')}
              </Text>
            </View>
            <View className="tag tag-warning">Mock</View>
          </View>
        ))}
      </View>
    </View>
  )
}