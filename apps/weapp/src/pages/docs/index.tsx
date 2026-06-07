import { Component } from 'react'
import { View, Text, Navigator } from '@tarojs/components'
import './index.scss'

export default function Docs() {
  return (
    <View className="page docs-page">
      <View className="docs-header">
        <Text className="page-title">关于项目</Text>
      </View>

      {/* Project intro */}
      <View className="doc-section card">
        <Text className="doc-title">MiniMax 音乐创作台</Text>
        <Text className="doc-body">
          开源、自托管、BYOK 的 MiniMax 音乐生成网站。
          不隶属于 MiniMax，由社区独立开发。
        </Text>
        <View className="tag-row">
          <View className="tag tag-accent">MIT License</View>
          <View className="tag tag-warning">Phase 3A</View>
          <View className="tag tag-secondary">Taro + React</View>
        </View>
      </View>

      {/* Current phase */}
      <View className="doc-section card">
        <Text className="doc-title">当前阶段</Text>
        <Text className="doc-body">
          Phase 3A — 微信小程序 Mock UI 原型
        </Text>
        <View className="phase-items">
          <Text className="phase-item">✓ 5 个页面（首页/创作/作品库/设置/关于）</Text>
          <Text className="phase-item">✓ 模式选择 Tab（纯音乐/自动成歌/歌词成歌/参考改编）</Text>
          <Text className="phase-item">✓ Mock 生成流程（不消耗额度）</Text>
          <Text className="phase-item">✓ 微信 adapter 占位</Text>
          <Text className="phase-item">✗ 未接入真实 Server API</Text>
          <Text className="phase-item">✗ 未实现音频播放/下载</Text>
        </View>
      </View>

      {/* Web version */}
      <View className="doc-section card">
        <Text className="doc-title">Web 版</Text>
        <Text className="doc-body">
          完整 Web 版本已上线，支持真实生成（需自托管后端）。
        </Text>
        <View className="web-status">
          <View className="status-dot mock" />
          <Text>当前 Web 公网：http://118.195.129.137:8787</Text>
        </View>
      </View>

      {/* Roadmap */}
      <View className="doc-section card">
        <Text className="doc-title">Phase 3 Roadmap</Text>
        <View className="roadmap-list">
          <View className="roadmap-item">
            <Text className="roadmap-phase">3A</Text>
            <Text className="roadmap-desc">Taro UI + Mock ✅</Text>
          </View>
          <View className="roadmap-item">
            <Text className="roadmap-phase">3B</Text>
            <Text className="roadmap-desc">接入自托管 Server API</Text>
          </View>
          <View className="roadmap-item">
            <Text className="roadmap-phase">3C</Text>
            <Text className="roadmap-desc">音频播放与下载</Text>
          </View>
          <View className="roadmap-item">
            <Text className="roadmap-phase">3D</Text>
            <Text className="roadmap-desc">微信开发者工具真机预览</Text>
          </View>
          <View className="roadmap-item">
            <Text className="roadmap-phase">3E</Text>
            <Text className="roadmap-desc">HTTPS 域名 + 合法域名配置</Text>
          </View>
          <View className="roadmap-item">
            <Text className="roadmap-phase">3F</Text>
            <Text className="roadmap-desc">真实生成受控测试</Text>
          </View>
        </View>
      </View>

      {/* Security */}
      <View className="doc-section card security-section">
        <Text className="doc-title">🔒 安全说明</Text>
        <Text className="doc-body">
          微信小程序禁止在前端存储真实 API Key。
          真实生成必须通过自托管后端代理。
          正式版需要 HTTPS 域名和微信公众平台 request 合法域名配置。
        </Text>
      </View>

      {/* Links */}
      <View className="doc-section links-section">
        <Text className="links-title">相关链接</Text>
        <View className="link-item">
          <Text>GitHub: conanxin/mmx-music-studio</Text>
        </View>
        <View className="link-item">
          <Text>docs/WEAPP_SECURITY.md — 安全规范</Text>
        </View>
        <View className="link-item">
          <Text>docs/WEAPP_ROADMAP.md — 开发路线图</Text>
        </View>
      </View>

      <View className="docs-footer">
        <Text className="footer-text">
          不隶属于 MiniMax · MIT License · 社区项目
        </Text>
      </View>
    </View>
  )
}