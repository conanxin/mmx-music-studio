import { Component } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import {
  getApiBaseFromConfig,
  setApiBaseToConfig,
  clearApiBaseFromConfig,
  DEFAULT_API_BASE,
} from '../../config/api'
import { testConnection } from '../../adapters/request'
import { HealthInfo } from '../../adapters/request'
import {
  setSessionApiKey,
  clearSessionApiKey,
  maskApiKey,
  hasSessionApiKey,
  getSessionApiKey,
} from '../../adapters/byok'
import './index.scss'

export default class Settings extends Component<Record<string, unknown>, {
  apiBase: string
  connectionStatus: 'idle' | 'testing' | 'ok' | 'error'
  healthInfo: HealthInfo | null
  statusMessage: string
  byokInputKey: string
  byokHasKey: boolean
  byokMaskedKey: string
}> {
  state = {
    apiBase: getApiBaseFromConfig() || DEFAULT_API_BASE,
    connectionStatus: 'idle' as 'idle' | 'testing' | 'ok' | 'error',
    healthInfo: null as HealthInfo | null,
    statusMessage: '',
    byokInputKey: '',
byokHasKey: hasSessionApiKey(),
    byokMaskedKey: hasSessionApiKey() ? maskApiKey(getSessionApiKey() || '') : '',
  }

  async componentDidMount() {
    //初始化时自动测试连接
    this.testConnection()
  }

  handleApiBaseChange = (e: { detail: { value: string } }) => {
    this.setState({ apiBase: e.detail.value })
  }

  handleSave = () => {
    const { apiBase } = this.state
    setApiBaseToConfig(apiBase)
    this.setState({ statusMessage: '已保存' })
    setTimeout(() => this.setState({ statusMessage: '' }), 2000)
  }

  handleClear = () => {
    clearApiBaseFromConfig()
    this.setState({
      apiBase: DEFAULT_API_BASE,
      statusMessage: '已清除，使用默认地址',
    })
    setTimeout(() => this.setState({ statusMessage: '' }), 2000)
  }

  handleTest = () => {
    this.testConnection()
  }

  testConnection = async () => {
    this.setState({ connectionStatus: 'testing', healthInfo: null, statusMessage: '正在测试连接...' })
    try {
      const result = await testConnection()
      if (result.ok && result.info) {
        this.setState({
          connectionStatus: 'ok',
          healthInfo: result.info,
          statusMessage: '连接成功',
        })
      } else {
        this.setState({
          connectionStatus: 'error',
          statusMessage: result.error ?? '无法连接后端',
        })
      }
    } catch (err) {
      this.setState({
        connectionStatus: 'error',
        statusMessage: '无法连接后端，将使用本地 Mock 数据',
      })
    }
    setTimeout(() => this.setState({ statusMessage: '' }), 3000)
  }

  // ── Phase 5C: BYOK Handlers ─────────────────────────────────────────────

  handleByokInputChange = (e: { detail: { value: string } }) => {
    this.setState({ byokInputKey: e.detail.value })
  }

  handleSaveByokKey = () => {
    const { byokInputKey } = this.state
    if (!byokInputKey.trim()) return
    setSessionApiKey(byokInputKey.trim())
    const key = byokInputKey.trim()
    this.setState({
      byokInputKey: '',
      byokHasKey: true,
      byokMaskedKey: maskApiKey(key),
      statusMessage: 'Key 已保存到当前会话',
    })
    setTimeout(() => this.setState({ statusMessage: '' }), 2000)
  }

  handleClearByokKey = () => {
    clearSessionApiKey()
    this.setState({
      byokHasKey: false,
      byokMaskedKey: '',
      statusMessage: 'Key 已清除',
    })
    setTimeout(() => this.setState({ statusMessage: '' }), 2000)
  }

  getStatusDotClass = (): string => {
    const { connectionStatus } = this.state
    if (connectionStatus === 'ok') return 'status-dot connected'
    if (connectionStatus === 'error') return 'status-dot error'
    if (connectionStatus === 'testing') return 'status-dot testing'
    return 'status-dot idle'
  }

  getStatusLabel = (): string => {
    const { connectionStatus } = this.state
    if (connectionStatus === 'ok') return '已连接'
    if (connectionStatus === 'error') return '未连接'
    if (connectionStatus === 'testing') return '测试中...'
    return '未测试'
  }

  getBackendModeLabel = (): string => {
    const { healthInfo } = this.state
    if (!healthInfo) return '—'
    const { backend, mockGenerationEnabled, realGenerationEnabled } = healthInfo
    if (backend === 'mock') return 'Server Mock（安全模式）'
    if (backend === 'cli') return 'MMX CLI'
    if (backend === 'api') return 'MiniMax API'
    return backend ?? '—'
  }

  render() {
    const { apiBase, healthInfo, statusMessage, byokInputKey, byokHasKey, byokMaskedKey } = this.state
    const statusDotClass = this.getStatusDotClass()
    const statusLabel = this.getStatusLabel()
    const backendModeLabel = this.getBackendModeLabel()

    return (
      <View className="page settings-page">
        <View className="settings-header">
          <Text className="page-title">设置</Text>
        </View>

        {/* Backend connection */}
        <View className="settings-section card">
          <Text className="section-title">后端连接</Text>

          <View className="api-base-row">
            <View className="api-base-label">
              <Text>API Base</Text>
            </View>
            <Input
              className="api-base-input"
              placeholder="https://music.yourdomain.com"
              value={apiBase}
              onInput={this.handleApiBaseChange}
            />
          </View>

          <View className="api-base-actions">
            <Button
              className="btn-secondary btn-small"
              onClick={this.handleTest}
            >测试连接</Button>
            <Button
              className="btn-secondary btn-small"
              onClick={this.handleSave}
            >保存</Button>
            <Button
              className="btn-ghost btn-small"
              onClick={this.handleClear}
            >清除</Button>
          </View>

          <View className="status-bar">
            <View className={`status-dot ${statusDotClass.split(' ')[1]}`} />
            <Text className="status-label">{statusLabel}</Text>
            {statusMessage && (
              <Text className="status-message"> · {statusMessage}</Text>
            )}
          </View>
        </View>

        {/* Backend status */}
        {healthInfo && (
          <View className="settings-section card">
            <Text className="section-title">后端状态</Text>
            <View className="status-grid">
              <View className="status-item">
                <Text className="status-key">当前模式</Text>
                <Text className="status-val">{backendModeLabel}</Text>
              </View>
              <View className="status-item">
                <Text className="status-key">Backend</Text>
                <Text className="status-val">{healthInfo.backend}</Text>
              </View>
              <View className="status-item">
                <Text className="status-key">Mock 生成</Text>
                <Text className={`status-val ${healthInfo.mockGenerationEnabled ? 'val-ok' : 'val-warn'}`}>
                  {healthInfo.mockGenerationEnabled ? '已启用' : '未启用'}
                </Text>
              </View>
              <View className="status-item">
                <Text className="status-key">真实生成</Text>
                <Text className={`status-val ${healthInfo.realGenerationEnabled ? 'val-warn' : 'val-ok'}`}>
                  {healthInfo.realGenerationEnabled ? '已启用 ⚠️' : '未启用（安全）'}
                </Text>
              </View>
              <View className="status-item">
                <Text className="status-key">地区</Text>
                <Text className="status-val">{healthInfo.region}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Key mode */}
        <View className="settings-section card">
          <Text className="section-title">Key 模式</Text>
          <View className="key-mode-list">
            <View className="key-mode-item">
              <Text className="key-mode-dot ok">✓</Text>
              <View className="key-mode-content">
                <Text className="key-mode-title">不在小程序保存长期 Key</Text>
                <Text className="key-mode-desc">推荐 · 安全</Text>
              </View>
            </View>
            <View className="key-mode-item">
              <Text className="key-mode-dot ok">✓</Text>
              <View className="key-mode-content">
                <Text className="key-mode-title">使用自托管后端代理</Text>
                <Text className="key-mode-desc">后端持有 Key，小程序不暴露</Text>
              </View>
            </View>
          </View>
        </View>

        {/* MiniMax Token Plan Key — Phase 5C: Session BYOK */}
        <View className="settings-section card byok-key-section">
          <Text className="section-title">🔑 MiniMax Token Plan Key</Text>
          <Text className="byok-subtitle">
            当前小程序 BYOK 为会话级 Key，只保存在当前运行内存中，关闭小程序后会清空。
          </Text>

          {/* Status indicator */}
          <View className="byok-status-row">
            <Text className="byok-status-dot">{}</Text>
            <Text className="byok-status-label">{byokHasKey ? 'Key 已填写' : 'Key 未填写'}</Text>
          </View>

          {/* Masked key display */}
          {byokHasKey && (
            <View className="byok-masked">
              <Text className="byok-masked-text">{byokMaskedKey}</Text>
            </View>
          )}

          {/* Key input */}
          <View className="byok-input-row">
            <View className="byok-input-wrap">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Input
                className="byok-input"
                type="text"
                password={false}
                placeholder="输入您的 Key（sk- 开头）"
                value={byokInputKey}
                onInput={this.handleByokInputChange}
              />
            </View>
          </View>

          {/* Action buttons */}
          <View className="byok-actions">
            <View
              className={`byok-btn primary ${!byokInputKey ? 'disabled' : ''}`}
              onClick={this.handleSaveByokKey}
            >
              <Text className="byok-btn-text">保存到当前会话</Text>
            </View>
            {byokHasKey && (
              <View className="byok-btn danger" onClick={this.handleClearByokKey}>
                <Text className="byok-btn-text">清除 Key</Text>
              </View>
            )}
          </View>

          {/* Security reminder */}
          <View className="byok-security-note">
            <Text className="byok-security-text">
              ⛔ Key 不会写入本地存储，不会进入 URL 或请求 body。
            </Text>
          </View>
        </View>

        {/* Audio capabilities status */}
        <View className="settings-section card audio-capability">
          <Text className="section-title">🎵 音频能力</Text>
          <View className="capability-items">
            <View className="capability-item">
              <Text className="capability-dot ok">✓</Text>
              <Text className="capability-label">播放：已接入 wx.createInnerAudioContext</Text>
            </View>
            <View className="capability-item">
              <Text className="capability-dot ok">✓</Text>
              <Text className="capability-label">下载保存：已接入 wx.downloadFile + wx.saveFile</Text>
            </View>
            <View className="capability-item">
              <Text className="capability-dot pending">○</Text>
              <Text className="capability-label">真机调试：待验证</Text>
            </View>
          </View>
          <View className="capability-hint">
            <Text className="hint-text">
              ⚠️ 小程序正式环境播放和下载远程音频，需要后端域名配置为 HTTPS 合法域名。微信开发者工具可临时关闭合法域名校验调试 HTTP IP。
            </Text>
          </View>
        </View>

        {/* Security notice */}
        <View className="settings-section card security-notice">
          <Text className="security-title">🔒 安全说明</Text>
          <View className="security-items">
            <Text className="security-item ok">✓ 小程序端不保存 MiniMax Key</Text>
            <Text className="security-item ok">✓ 不在代码中硬编码真实 Key</Text>
            <Text className="security-item ok">✓ 当前 Phase 3C 已接入音频播放 + 下载保存</Text>
            <Text className="security-item warn">⚠ 正式小程序必须使用 HTTPS 域名</Text>
            <Text className="security-item warn">⚠ 需在微信公众平台配置 request 合法域名</Text>
          </View>
        </View>

        {/* Version */}
        <View className="settings-section">
          <Text className="version-text">
            mmx-music-studio v0.1.0-alpha · Phase 3C
          </Text>
        </View>
      </View>
    )
  }
}