# MiniMax 音乐创作台 — 技术架构

## 1. 架构原则

项目从第一天起就考虑微信小程序迁移，核心原则：

- **业务逻辑与平台解耦**：所有核心逻辑写在 `packages/core`，完全平台无关
- **平台能力抽象化**：存储、音频、文件上传、HTTP 请求均通过 adapter 模式抽象
- **类型系统共享**：TypeScript 类型定义是唯一真实来源（Single Source of Truth）
- **UI 组件小程序化**：Web UI 组件后续可迁移到 Taro / uni-app

## 2. Monorepo 结构

```
mmx-music-studio/
├── apps/
│   ├── web/                    # Web 前端（当前阶段实现）
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── components/     # 通用 UI 组件
│   │   │   ├── features/       # 功能页面组件
│   │   │   │   ├── studio/     # 创作台
│   │   │   │   ├── library/    # 作品库
│   │   │   │   ├── settings/   # 设置页
│   │   │   │   └── docs/       # 文档页
│   │   │   ├── adapters/       # Web 平台适配器
│   │   │   ├── hooks/          # React hooks
│   │   │   ├── routes/         # 路由配置
│   │   │   ├── styles/         # 全局样式
│   │   │   ├── mock/           # Mock 数据
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   └── vite.config.ts
│   │
│   └── weapp/                  # 微信小程序（future，占位）
│       ├── README.md
│       └── src/
│
├── packages/
│   ├── core/                   # 平台无关核心（最重要）
│   │   ├── src/
│   │   │   ├── types/          # TypeScript 类型定义
│   │   │   │   ├── music.ts    # 音乐相关类型
│   │   │   │   ├── task.ts     # 任务状态类型
│   │   │   │   └── config.ts   # 配置类型
│   │   │   ├── schemas/        # 校验逻辑（Zod / Yup）
│   │   │   │   ├── music.schema.ts
│   │   │   │   └── config.schema.ts
│   │   │   ├── minimax/        # MiniMax 请求构建
│   │   │   │   ├── request-builder.ts
│   │   │   │   └── response-parser.ts
│   │   │   ├── prompts/        # Prompt 模板
│   │   │   │   ├── music.ts
│   │   │   │   └── song.ts
│   │   │   └── modes/          # 四种生成模式定义
│   │   │       ├── pure-music.ts
│   │   │       ├── auto-song.ts
│   │   │       ├── lyric-song.ts
│   │   │       └── cover.ts
│   │   └── package.json
│   │
│   ├── adapters/               # 平台适配器集合
│   │   ├── src/
│   │   │   ├── storage/        # 存储适配器接口
│   │   │   │   ├── index.ts    # StorageAdapter 接口定义
│   │   │   │   ├── web.ts      # Web: localStorage/sessionStorage
│   │   │   │   └── weapp.ts    # WeApp: wx.setStorageSync
│   │   │   ├── audio/          # 音频播放适配器
│   │   │   │   ├── index.ts    # AudioAdapter 接口定义
│   │   │   │   ├── web.ts      # Web: HTMLAudioElement
│   │   │   │   └── weapp.ts    # WeApp: wx.createInnerAudioContext
│   │   │   ├── upload/         # 文件上传适配器
│   │   │   │   ├── index.ts    # UploadAdapter 接口定义
│   │   │   │   ├── web.ts      # Web: input[type=file]
│   │   │   │   └── weapp.ts    # WeApp: wx.chooseMessageFile
│   │   │   ├── minimax-api/    # MiniMax API 适配器
│   │   │   │   ├── index.ts
│   │   │   │   └── client.ts
│   │   │   └── minimax-cli/    # mmx CLI 适配器
│   │   │       ├── index.ts
│   │   │       └── runner.ts
│   │   └── package.json
│   │
│   └── ui-tokens/              # 设计令牌
│       ├── src/
│       │   └── tokens.ts       # 颜色、间距、圆角常量
│       └── package.json
│
├── docs/                       # 项目文档
├── storage/                    # 本地存储
│   └── tracks/                 # 生成的音频文件
├── .env.example
├── package.json                # 根 workspace 配置
├── pnpm-workspace.yaml
├── README.md
└── LICENSE
```

## 3. 核心包详解

### 3.1 `packages/core`

最关键的包，包含所有平台无关逻辑：

```
core/src/
├── types/music.ts
│   ├── MusicMode     // 'pure-music' | 'auto-song' | 'lyric-song' | 'cover'
│   ├── MusicTask     // { id, mode, prompt, status, audioUrl, createdAt }
│   ├── MusicConfig   // { model, outputFormat, quality }
│   └── GenerateParams // 各模式输入参数联合类型
│
├── schemas/music.schema.ts
│   ├── validatePureMusic()   // 纯音乐参数校验
│   ├── validateAutoSong()    // 自动成歌参数校验
│   ├── validateLyricSong()   // 歌词成歌参数校验
│   └── validateCover()      // 参考改编参数校验
│
├── minimax/request-builder.ts
│   ├── buildApiRequest()     // 构建 MiniMax API 请求体
│   └── parseTaskStatus()     // 解析任务状态响应
│
├── prompts/music.ts
│   ├── buildPureMusicPrompt()  // 纯音乐 prompt
│   └── buildSongPrompt()       // 歌曲 prompt（含歌词处理）
│
└── modes/pure-music.ts
    ├── PureMusicMode   // 模式定义对象
    ├── DEFAULT_TAGS     // 默认风格标签
    └── FIELDS           // 所需字段列表
```

### 3.2 `packages/adapters`

平台能力抽象层，所有 adapter 实现统一接口：

```typescript
// storage/index.ts
export interface StorageAdapter {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
  remove(key: string): void
  clear(): void
}

// audio/index.ts
export interface AudioAdapter {
  play(url: string): void
  pause(): void
  seek(time: number): void
  getCurrentTime(): number
  getDuration(): number
  onEnded(fn: () => void): void
  onTimeUpdate(fn: (time: number) => void): void
}

// upload/index.ts
export interface UploadAdapter {
  chooseFile(options: ChooseFileOptions): Promise<ChosenFile>
  chooseFiles(options: ChooseFileOptions): Promise<ChosenFile[]>
}
```

## 4. 技术选型说明

### Web 端：Vite + React + TypeScript

**选择 Vite 而非 Next.js 的原因：**

| 维度 | Vite | Next.js |
|------|------|---------|
| 复杂度 | 轻量，简单 | 重，约定多 |
| SSR | 不需要 | 不需要（纯客户端） |
| 与 core 解耦 | 容易，core 无需感知框架 | 困难，core 可能间接依赖 Next |
| 小程序迁移 | 更容易替换 | 需要更多重构 |
| 学习曲线 | 低 | 中 |

当前阶段 MVP 是纯客户端静态页面，不需要 SSR，Vite 更合适。

### 样式方案

使用 **CSS Modules + CSS 变量**（无 Tailwind）：

- 每个组件 `.module.css`
- 设计令牌通过 CSS 变量在 `:root` 定义
- 简单、直观、无构建复杂度

### 状态管理

React Context + useReducer（无 Redux/Zustand）：

- KeyContext：API Key 状态
- TaskContext：生成任务状态
- 足够简单，不需要额外依赖

## 5. 数据流

```
用户输入
    │
    ▼
packages/core → 校验 schema → 构建 MiniMax 请求参数
    │
    ▼
packages/adapters/minimax-api → HTTP 请求（携带 Key）
    │
    ▼
轮询任务状态 / WebSocket 推送
    │
    ▼
任务完成 → packages/adapters/storage → 保存到本地
    │
    ▼
packages/adapters/audio → 播放音频
```

## 6. 小程序迁移策略

### Web 端实现后，小程序接入路径：

1. `apps/weapp` 使用 Taro 或 uni-app
2. 复用 `packages/core` 所有逻辑
3. `packages/adapters` 替换为小程序 adapter：
   - `storage/web.ts` → `storage/weapp.ts`（wx.setStorageSync）
   - `audio/web.ts` → `audio/weapp.ts`（wx.createInnerAudioContext）
   - `upload/web.ts` → `upload/weapp.ts`（wx.chooseMessageFile）
   - `minimax-api/web.ts` → `minimax-api/weapp.ts`（wx.request）

### 关键差异处理

| 能力 | Web 实现 | 小程序实现 |
|------|---------|-----------|
| 音频 | HTMLAudioElement | wx.createInnerAudioContext |
| 存储 | localStorage | wx.setStorageSync |
| 上传 | input[type=file] | wx.chooseMessageFile |
| 网络 | fetch | wx.request |
| 文件路径 | blob URL | wx.env.USER_DATA_PATH |

### 部署架构建议

小程序推荐**自托管后端代理**模式：

```
小程序 → 你的后端 API → MiniMax API
         （Key 在后端）
```

而不推荐在小程序前端直接暴露用户 Key。