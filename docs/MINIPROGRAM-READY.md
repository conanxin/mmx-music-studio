# MiniMax 音乐创作台 — 微信小程序迁移准备

本文档详细说明项目如何从第一天起就为微信小程序迁移做准备。

## 1. 核心原则：平台无关优先

### 1.1 必须平台无关的代码

以下代码**必须**写在 `packages/core` 中，不能依赖任何浏览器或 Node.js 专有 API：

- ✅ TypeScript 类型定义（`types/`）
- ✅ 校验逻辑（`schemas/`）
- ✅ Prompt 构建逻辑（`prompts/`）
- ✅ MiniMax 请求参数构建（`minimax/request-builder.ts`）
- ✅ 四种生成模式的定义和配置（`modes/`）
- ✅ 业务常量（标签列表、默认值）

### 1.2 必须 adapter 化的能力

| 能力 | Adapter 接口位置 | Web 实现 | 小程序实现 |
|------|----------------|---------|-----------|
| 本地存储 | `adapters/storage` | localStorage / sessionStorage | wx.setStorageSync |
| 音频播放 | `adapters/audio` | HTMLAudioElement | wx.createInnerAudioContext |
| 文件选择 | `adapters/upload` | input[type=file] | wx.chooseMessageFile |
| HTTP 请求 | `adapters/minimax-api` | fetch | wx.request |
| 文件下载 | `adapters/download` | a[download] / blob | wx.downloadFile |

### 1.3 Web 端专有代码（允许）

以下代码可以留在 `apps/web` 中，无需考虑小程序迁移：

- React 组件（后续用 Taro/uni-app 重写）
- 路由配置（小程序用自身路由系统）
- CSS 样式（后续用小程序 WXSS/SCSS 重写）
- Vite 配置

## 2. UI 设计移动端优先

### 2.1 布局规范

- **手机单栏**：所有页面默认单栏卡片布局，375px 宽度完美呈现
- **桌面双栏**：桌面端（1024px+）使用双栏，表单在左，输出在右
- **不要三栏布局**：无论手机还是桌面，最多双栏
- **底部固定按钮**：生成按钮在手机端固定在主要表单下方

### 2.2 触控优先

- **点击区域 ≥ 44px**：所有可点击元素最小 44×44px
- **不使用 hover 状态**：交互不依赖 hover，只依赖点击
- **hover 作为增强**：hover 只能用于视觉增强，不能用于关键交互
- **滑动操作克制**：第一版不使用复杂滑动交互

### 2.3 表单适合手机

- **字体 16px**：iOS 上 `<input>` 字体小于 16px 会触发自动缩放
- **大触摸目标**：输入框高度至少 48px
- **简化下拉**：避免复杂多级下拉，使用单选标签代替
- **日期/时间**：使用原生 picker，避免自定义复杂选择器

### 2.4 播放器适合移动端

- **底部卡片播放器**：播放器固定在页面底部，不遮挡主内容
- **简洁波形**：波形用 CSS/SVG mock，不依赖复杂库
- **大播放按钮**：播放/暂停按钮至少 56×56px
- **进度条**：进度条足够粗（8px+），方便拖动

### 2.5 生成状态适合移动端

- **实时进度**：生成状态用进度条或百分比展示
- **推送通知**：小程序可用模板消息/WebSocket 推送状态
- **失败重试**：失败状态要有明确的「重新生成」按钮
- **后台提示**：小程序切后台后生成完成时用消息通知

## 3. 小程序安全要求

### 3.1 不要在前端存储真实 Key

- ❌ **不要**把用户 Key 存在 `wx.setStorage`
- ❌ **不要**把用户 Key 存在小程序的 `globalData`
- ✅ Key 只存在于内存中，页面销毁后自动清除

### 3.2 推荐：后端代理模式

```
小程序前端
    ↓（无 Key）
你的后端服务（自托管）
    ↓（有 Key）
MiniMax API
```

后端服务可以：
- 验证用户身份
- 控制生成频率/额度
- 隐藏真实 API Key
- 记录使用日志

### 3.3 如果必须在前端使用用户 Key

必须在小程序端显示**强安全提示**：

```
⚠️ 安全提示
您将使用自己的 MiniMax Token Plan Key 生成音乐。
我们不会保存您的 Key，但请确认您在可信的网络环境下操作。
不要在不安全的公共网络中输入真实 Key。
```

## 4. 小程序审核注意事项

- 音频内容生成可能涉及**虚拟音乐版权**，需在描述中注明「AI 生成」
- 如果有用户上传歌词功能，需要内容审核机制
- 参考音频改编可能涉及版权，需添加免责声明
- 音乐类小程序需要相关类目资质（若有商业化计划）

## 5. 技术栈建议

### 5.1 Taro vs uni-app

| 维度 | Taro | uni-app |
|------|------|---------|
| 生态 | 京东团队，活跃 | DCloud 团队，活跃 |
| React 支持 | ✅ 原生支持 | ✅ 通过 render-jsx |
| TypeScript | ✅ 完善 | ⚠️ 需插件 |
| 复用 packages/core | ✅ 直接复用 | ✅ 直接复用 |
| 微信小程序优化 | ✅ 更好 | ⚠️ 一般 |
| 包体积 | 较大 | 较小 |

推荐：**Taro**（React 开发者更熟悉，TypeScript 支持更好）

### 5.2 第一步小程序接入路径

1. Web 端 `apps/web` 完整实现
2. 创建 `apps/weapp`（Taro 项目）
3. 接入 `packages/core` 作为 npm 依赖
4. 实现 `packages/adapters/src/storage/weapp.ts`
5. 实现 `packages/adapters/src/audio/weapp.ts`
6. 实现 `packages/adapters/src/upload/weapp.ts`
7. 重写 UI 组件（Taro 版本）
8. 测试 + 提交审核

## 6. 平台差异速查表

| 特性 | Web | 微信小程序 |
|------|-----|----------|
| 存储 | localStorage | wx.setStorageSync |
| 会话存储 | sessionStorage | wx.getStorageSync（需手动管理） |
| 音频 | HTMLAudioElement | wx.createInnerAudioContext |
| 文件选择 | input[type=file] | wx.chooseMessageFile |
| 网络 | fetch / axios | wx.request |
| 文件下载 | a[download] | wx.downloadFile |
| 页面标题 | document.title | wx.setNavigationBarTitle |
| 截图 | html2canvas | wx.createCanvasContext |
| 路由 | react-router | 页面栈（navigateTo） |
| 环境变量 | import.meta.env | 单独配置 |
| 剪贴板 | navigator.clipboard | wx.setClipboardData |
| 分享 | Web Share API | wx.showShareMenu |

## 7. 第一阶段小程序占位

`apps/weapp/README.md` 已创建，说明：

- 小程序是未来计划
- 当前阶段只做 Web 端
- 接入时会复用 `packages/core` 和 `packages/adapters`