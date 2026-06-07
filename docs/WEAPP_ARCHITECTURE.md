# 微信小程序架构 / WeApp Architecture

> 文档版本：Phase 3A · 2026-06-07
> 项目路径：`apps/weapp`

---

## 核心设计原则

### 小程序端不直接调用 MiniMax

微信小程序**不能**直接调用 MiniMax API，原因：

1. **API Key 暴露风险**：小程序代码对用户可见（通过反编译），任何写在 `app.config.ts` / `project.config.json` / env 文件中的 Key 都可被提取
2. **域名限制**：MiniMax 域名未在微信公众平台配置为合法 request 域名，无法直接请求
3. **安全合规**：微信要求正式版小程序必须使用 HTTPS + 已备案域名

### 小程序端不保存长期 API Key

Phase 3A 明确规定：**不在小程序端保存任何真实 MiniMax API Key**。后续 Phase 3E 起如需真实生成，用户必须：
- 使用自托管后端（server）作为代理
- 通过后端鉴权机制（而非小程序前端 key）调用 MiniMax

### 小程序端不运行 mmx CLI

微信小程序是客户端运行环境，无法运行服务器端 CLI 工具。mmx CLI 只能在自托管 server 上执行。

---

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户手机 / 微信                               │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │              微信小程序 (apps/weapp)                        │     │
│  │                                                            │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │     │
│  │  │   Home   │  │  Studio  │  │ Library  │  │ Settings │   │     │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │     │
│  │       │             │             │             │          │     │
│  │       └─────────────┴─────────────┴─────────────┘          │     │
│  │                         │                                  │     │
│  │              ┌──────────┴──────────┐                       │     │
│  │              │   packages/adapters  │                       │     │
│  │              │  request.ts          │  ← wx.request 封装     │     │
│  │              │  storage.ts          │  ← wx.getStorageSync   │     │
│  │              │  audio.ts            │  ← wx.createInnerAudio │     │
│  │              │  upload.ts           │  ← wx.chooseMedia       │     │
│  │              │  download.ts         │  ← wx.downloadFile     │     │
│  │              └──────────┬──────────┘                       │     │
│  └─────────────────────────┼────────────────────────────────────┘     │
│                            │ HTTPS (合法域名)                        │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  自托管 Server   │
                    │  (apps/web/server)│
                    │                  │
                    │  /api/generate    │
                    │  /api/tracks      │
                    │  /api/health      │
                    │                  │
                    │  packages/core    │  ← 业务类型/校验/payload 构建
                    │  packages/adapters│  ← MiniMax API adapter / mmx CLI
                    │  minimax-adapter  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         ┌────▼────┐   ┌─────▼────┐  ┌─────▼─────┐
         │ mock    │   │  mmx CLI  │  │ MiniMax   │
         │ 本地模拟│   │ (真实额度)│  │ API (Token)│
         └─────────┘   └──────────┘  └───────────┘
```

---

## 目录结构

```
mmx-music-studio/
├── apps/
│   ├── web/                    # Web 版（已上线）
│   └── weapp/                  # 微信小程序（Phase 3）
│       ├── package.json
│       ├── project.config.json  # 微信开发者工具配置
│       ├── config/             # Taro 构建配置
│       │   ├── index.ts         # 通用配置
│       │   ├── dev.ts           # 开发配置
│       │   └── prod.ts          # 生产配置
│       └── src/
│           ├── app.config.ts    # 小程序全局配置（页面路由、标题等）
│           ├── app.tsx         # 入口组件
│           ├── app.scss        # 全局样式
│           ├── types.ts        # 共享类型（Phase 3B 前临时）
│           ├── pages/          # 页面
│           │   ├── home/
│           │   ├── studio/
│           │   ├── library/
│           │   ├── settings/
│           │   └── docs/
│           ├── components/     # 组件
│           │   ├── AppShell.tsx     # 页面壳（导航栏）
│           │   ├── ModeTabs.tsx    # 模式选择 Tab
│           │   ├── WaveformPlayer.tsx  # 波形播放器
│           │   └── TrackCard.tsx   # 作品卡片
│           ├── adapters/       # 平台适配层（微信 API）
│           │   ├── request.ts   # HTTP 请求
│           │   ├── storage.ts  # 本地存储
│           │   ├── audio.ts   # 音频播放
│           │   ├── upload.ts  # 文件选择
│           │   └── download.ts # 文件下载
│           ├── mock/          # Mock 数据
│           │   └── tracks.ts  # 模拟作品列表
│           └── styles/        # 样式 token
│               └── tokens.scss
│
├── packages/
│   ├── core/                   # 业务核心（Phase 3B 正式接入）
│   │   └── src/
│   │       ├── types/          # 音乐生成类型
│   │       ├── modes/          # 模式定义
│   │       ├── minimax/        # MiniMax 请求参数构建
│   │       ├── prompts/        # Prompt 模板
│   │       └── schemas/        # Zod 输入校验
│   └── adapters/              # 适配器层（Web 用，WeApp 不直接用）
│
└── server/                    # 自托管后端 API
    ├── index.ts               # HTTP server
    └── adapters/              # MiniMax 真实调用
        ├── minimax-cli/       # mmx CLI adapter
        └── minimax-api/       # API adapter
```

---

## Phase 3B 接入计划

### 当前状态（Phase 3A）
- 小程序 UI Mock 原型完成
- 不调用任何真实 API
- 不接入 packages/core

### Phase 3B 目标
- 配置 `packages/adapters/weapp/request.ts` 指向自托管 server
- 通过 workspace alias 或复制方式复用 `packages/core` 的：
  - `MusicMode` 类型
  - `validateMusicInput` 校验
  - `buildExpandedPrompt` prompt 构建
  - `createMockTrack` mock 数据生成
- 接入 `/api/health` 获取后端状态

### Phase 3C 目标
- 实现 `audio.ts` 真实音频播放（`wx.createInnerAudioContext`）
- 实现 `download.ts` 真实下载（`wx.downloadFile`）
- 接入 `/api/tracks` 获取作品库
- 接入 `/api/tracks/:id/audio` 流式音频

### Phase 3D 目标
- 微信开发者工具真机调试
- 确认音频播放、文件下载、存储正常工作

### Phase 3E 目标
- 配置 HTTPS 域名（生产环境）
- 在微信公众平台配置 request 合法域名
- 小程序正式版发布

### Phase 3F 目标
- 真实生成受控测试
- 用户鉴权（可选）
- 额度限制

---

## 技术选型

| 项目 | 选型 | 理由 |
|------|------|------|
| 框架 | Taro 4 + React 18 + TypeScript | 复用 React 思路，支持多端 |
| 构建 | @tarojs/cli | 官方 CLI |
| 样式 | SCSS Modules | 与 Web 版一致 |
| 状态 | React hooks (useState/useEffect) | 简单够用 |
| 路由 | Taro 路由（pages.json） | 微信原生 |
| 请求 | 封装 wx.request | 需要配置合法域名 |
| 音频 | wx.createInnerAudioContext | 微信原生 |
| 存储 | wx.getStorageSync | 微信原生 |

---

## 已知限制

1. **微信开发者工具调试**：需要本地运行微信开发者工具打开 `apps/weapp/dist`，Taro dev 需持续运行
2. **真机测试**：需要自行在手机微信中打开调试版小程序
3. **HTTPS 域名**：微信正式版要求 HTTPS + 已备案域名，开发阶段可用 HTTP IP 临时调试
4. **packages/core 接入**：Phase 3B 需要解决 Taro workspace alias 问题，Phase 3A 先用本地 types.ts