// app.tsx — MiniMax 音乐创作台 · 微信小程序入口
// Phase 3A: Taro v4 + React 18 project scaffold
/// <reference types="@tarojs/taro" />

import { Component } from 'react'
import { View } from '@tarojs/components'
import './app.scss'

class App extends Component {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render() {
    return (
      <View className="app">
        {/* children 是将要被渲染的页面组件 */}
        {(this.props as any).children}
      </View>
    )
  }
}

export default App