import { Component } from 'react'
import { View, Text, Input, RadioGroup, Radio } from '@tarojs/components'
import './index.scss'

export default function Settings() {
  return (
    <View className="page settings-page">
      <View className="settings-header">
        <Text className="page-title">设置</Text>
      </View>

      {/* Backend status */}
      <View className="settings-section card">
        <Text className="section-title">后端状态</Text>
        <View className="status-bar">
          <View className="status-dot mock" />
          <Text>Mock 小程序模式</Text>
        </View>
        <Text className="settings-hint">
          Phase 3A 仅使用 Mock 数据，不调用真实 Server
        </Text>
      </View>

      {/* API Base */}
      <View className="settings-section card">
        <Text className="section-title">API Base（Phase 3B 配置）</Text>
        <Input
          className="settings-input"
          placeholder="https://your-domain.example"
          value="https://your-domain.example"
          disabled
        />
        <Text className="settings-hint">
          占位符。Phase 3B 需配置为真实自托管 Server URL
        </Text>
      </View>

      {/* Key mode */}
      <View className="settings-section card">
        <Text className="section-title">Key 模式</Text>
        <View className="radio-group">
          <Radio value="none" checked>不在小程序保存长期 Key</Radio>
          <Radio value="server">使用自托管后端代理</Radio>
        </View>
        <Text className="settings-hint">
          ⚠️ 微信小程序禁止在前端存储真实 API Key
        </Text>
      </View>

      {/* Security notice */}
      <View className="settings-section card security-notice">
        <Text className="security-title">🔒 安全说明</Text>
        <View className="security-items">
          <Text className="security-item">✗ 小程序端不保存 MiniMax Key</Text>
          <Text className="security-item">✗ 不在代码中硬编码真实 Key</Text>
          <Text className="security-item">✗ 不使用 HTTP IP 作为生产 API</Text>
          <Text className="security-item">✓ 真实生成必须由后端代理</Text>
          <Text className="security-item">✓ 正式版需要 HTTPS + 合法域名</Text>
        </View>
      </View>

      {/* Version info */}
      <View className="settings-section">
        <Text className="version-text">
          mmx-music-studio v0.1.0-alpha · Phase 3A
        </Text>
      </View>
    </View>
  )
}