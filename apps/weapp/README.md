# 微信小程序（Taro / uni-app）

## 状态：占位（Future）

这是 mmx-music-studio 的微信小程序入口占位目录。

## 接入计划

1. Web 端 `apps/web` 完整实现后，再启动小程序项目
2. 使用 Taro 或 uni-app 构建
3. 复用 `packages/core` 和 `packages/adapters`
4. 实现 `packages/adapters/src/*/weapp.ts` 小程序适配器

## 技术选型

推荐 **Taro**（React 开发者更熟悉，TypeScript 支持更好）

## 关键适配点

| 能力 | Web | 小程序 |
|------|-----|--------|
| 存储 | localStorage | wx.setStorageSync |
| 音频 | HTMLAudioElement | wx.createInnerAudioContext |
| 文件选择 | input[type=file] | wx.chooseMessageFile |
| 网络 | fetch | wx.request |

## 安全注意

- 不要在 storage 中存 Key（使用后端代理模式）
- Key 只存在内存，页面销毁后自动清除
- 推荐通过自托管后端代理调用 MiniMax API

## 等待

等待 `apps/web` 稳定后开始。