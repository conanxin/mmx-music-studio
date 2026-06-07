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
import './index.scss'

export default class Settings extends Component<Record<string, unknown>, {
  apiBase: string
  connectionStatus: 'idle' | 'testing' | 'ok' | 'error'
  healthInfo: HealthInfo | null
  statusMessage: string
}> {
  state = {
    apiBase: getApiBaseFromConfig() || DEFAULT_API_BASE,
    connectionStatus: 'idle' as 'idle' | 'testing' | 'ok' | 'error',
    healthInfo: null as HealthInfo | null,
    statusMessage: '',
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
    const { apiBase, healthInfo, statusMessage } = this.state
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
              placeholder="http://your-server:8787"
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

        {/* Security notice */}
        <View className="settings-section card security-notice">
          <Text className="security-title">🔒 安全说明</Text>
          <View className="security-items">
            <Text className="security-item ok">✓ 小程序端不保存 MiniMax Key</Text>
            <Text className="security-item ok">✓ 不在代码中硬编码真实 Key</Text>
            <Text className="security-item ok">✓ 当前 Phase 3B 只连接 Server Mock</Text>
            <Text className="security-item warn">⚠ 正式小程序必须使用 HTTPS 域名</Text>
            <Text className="security-item warn">⚠ 需在微信公众平台配置 request 合法域名</Text>
          </View>
        </View>

        {/* Version */}
        <View className="settings-section">
          <Text className="version-text">
            mmx-music-studio v0.1.0-alpha · Phase 3B
          </Text>
        </View>
      </View>
    )
  }
}