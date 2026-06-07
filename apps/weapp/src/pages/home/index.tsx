import { Component } from 'react'
import { View, Text, Navigator } from '@tarojs/components'
import './index.scss'

export default class Home extends Component {
  render() {
    return (
      <View className="page home-page">
        {/* Header */}
        <View className="home-header">
          <Text className="product-name">MiniMax 音乐创作台</Text>
          <Text className="product-subtitle">
            用你的 Token Plan 创作音乐
          </Text>
          <Text className="mock-badge tag tag-warning">
            小程序 Mock 原型
          </Text>
        </View>

        {/* Status bar */}
        <View className="status-bar">
          <View className="status-dot mock" />
          <Text>当前模式：Mock（未调用真实 MiniMax）</Text>
        </View>

        {/* CTA */}
        <Navigator
          url="/pages/studio/index"
          className="btn-primary home-cta"
        >
          <Text>开始创作</Text>
        </Navigator>

        {/* Feature cards */}
        <View className="feature-grid">
          <View className="feature-card card">
            <Text className="feature-icon">🎵</Text>
            <Text className="feature-title">纯音乐</Text>
            <Text className="feature-desc">文字描述生成背景音乐</Text>
          </View>
          <View className="feature-card card">
            <Text className="feature-icon">🎤</Text>
            <Text className="feature-title">自动成歌</Text>
            <Text className="feature-desc">输入主题，自动写词+作曲</Text>
          </View>
          <View className="feature-card card">
            <Text className="feature-icon">✍️</Text>
            <Text className="feature-title">歌词成歌</Text>
            <Text className="feature-desc">提供歌词，生成完整歌曲</Text>
          </View>
          <View className="feature-card card">
            <Text className="feature-icon">🔄</Text>
            <Text className="feature-title">参考改编</Text>
            <Text className="feature-desc">上传参考音频风格改编</Text>
          </View>
        </View>

        {/* Footer hint */}
        <View className="home-footer">
          <Text className="footer-text">
            Phase 3A · 微信小程序原型 · 未调用真实 MiniMax
          </Text>
          <Navigator url="/pages/docs/index" className="footer-link">
            <Text>了解更多 →</Text>
          </Navigator>
        </View>
      </View>
    )
  }
}