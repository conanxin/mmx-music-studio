# API Design — mmx-music-studio

> **Phase 2A Status**: UI 原型阶段，仅构建 payload，不调用真实 API。

---

## 1. 架构分层

```
┌─────────────────────────────────────────────────┐
│  apps/web (React + Vite)                        │
│  ┌───────────────────────────────────────────┐  │
│  │  UI Layer: Studio / Library / Settings    │  │
│  └───────────────────────────────────────────┘  │
│                        │                         │
│                        ▼                         │
│  packages/adapters (API / CLI / Storage ...)   │
│  packages/core (types / validation / payload)  │
│  packages/ui-tokens (design tokens)            │
└─────────────────────────────────────────────────┘
         │                               ▲
         ▼                               │
  apps/weapp (Taro/uni-app)  ←── 复用 packages/core
```

**核心原则**：`packages/core` 不依赖 React、DOM、BOM、localStorage、window、document。

---

## 2. 四种模式 → MiniMax Payload 映射

### instrumental（纯音乐）
```typescript
{
  model: "music-2.6",
  prompt: "...",           // 用户描述，trimmed
  is_instrumental: true,   // 核心标识
  output_format: "url",
  audio_setting: {
    sample_rate: 44100,
    bitrate: 256000,
    format: "mp3",
  },
  aigc_watermark: true,
}
```

### auto（自动成歌）
```typescript
{
  model: "music-2.6",
  prompt: "...",
  lyrics_optimizer: true,  // 核心标识：自动生成歌词
  output_format: "url",
  audio_setting: { ... },
  aigc_watermark: true,
}
```

### lyrics（歌词成歌）
```typescript
{
  model: "music-2.6",
  prompt: "...",           // 风格描述，可选
  lyrics: "...",           // 用户填写的歌词，核心
  output_format: "url",
  audio_setting: { ... },
  aigc_watermark: true,
}
```

### cover-url（URL 参考改编）
```typescript
{
  model: "music-cover",
  prompt: "...",           // 目标风格描述
  audio_url: "https://...", // 参考音频 URL，核心
  lyrics: "...",           // 可选歌词
  output_format: "url",
  audio_setting: { ... },
  aigc_watermark: true,
}
```

### cover-file（文件参考改编）
```typescript
// Phase 2B+：文件需要先通过 adapter 上传转 base64
{
  model: "music-cover",
  prompt: "...",
  audio_base64: "...",     // 上传后转换，核心
  lyrics: "...",
  output_format: "url",
  audio_setting: { ... },
  aigc_watermark: true,
}
```

---

## 3. Region → Endpoint 映射

| Region | Endpoint |
|--------|----------|
| `cn` | `https://api.minimaxi.com/v1/music_generation` |
| `global` | `https://api.minimax.io/v1/music_generation` |

---

## 4. 校验规则摘要

| 模式 | prompt 约束 | lyrics 约束 | audio 约束 | 模型 |
|------|------------|------------|-----------|------|
| instrumental | 1–2000 字 | — | — | music-2.6 / music-2.6-free |
| auto | 必填 1–2000 字 | — | — | music-2.6 / music-2.6-free |
| lyrics | 可选，最长 2000 | 必填 1–3500 字 | — | music-2.6 / music-2.6-free |
| cover-url | 必填 10–300 字 | 可选 10–1000 | audioUrl 必填，URL 格式 | music-cover / music-cover-free |
| cover-file | 必填 10–300 字 | 可选 10–1000 | ≤50MB，指定 MIME 类型 | music-cover / music-cover-free |

---

## 5. 为什么 core 不依赖 Web/React

- **微信小程序**：小程序没有 DOM/BOM，core 的类型、校验、payload builder 可直接复用
- **未来后端**：server-side rendering 或 API-only 部署时没有 window/document
- **纯函数测试**：核心逻辑可以用 Node.js 直接测试，无需 jsdom

`packages/core` 的约束：
- 只能使用 TC39 JavaScript 标准库（ES2020）
- 禁止 `import from 'react'`、`import from 'react-dom'`
- 禁止 `window`、`document`、`localStorage`、`sessionStorage`
- 禁止 `fetch`、`XMLHttpRequest`

---

## 6. 后续 Phase 2B 接入计划

### 6.1 API Adapter
```
Web → packages/adapters/src/minimax-api/index.ts
  → fetch POST https://api.minimax.com/v1/music_generation
  → Authorization: Bearer <key>
  → { job_id, status, audio_url }
```
- Header 禁止打印到 console
- Key 不写入 localStorage/sessionStorage（除非用户明确开启）
- 错误码映射到 `MiniMaxApiError`

### 6.2 CLI Adapter
```
Web → packages/adapters/src/minimax-cli/index.ts
  → spawn mmx music generate <prompt>
  → parse stdout JSON
```
- 不暴露 key（mmx CLI 自行读取 ~/.mmx/config.json）
- 适合自托管用户

### 6.3 Server Proxy（安全部署）
```
小程序/公共前端 → 你的后端 → MiniMax API
```
- 用户 key 不暴露给前端
- 后端做鉴权 + 额度控制
- 适合开源社区分发

### 6.4 文件保存
```
packages/adapters/src/storage/index.ts
  Web → localStorage / File System API
  小程序 → wx.getStorageSync / 文件系统
```
- 作品元数据（id, title, mode, prompt, createdAt）
- 音频文件路径

### 6.5 在线试听
```
packages/adapters/src/audio/index.ts
  Web → HTMLAudioElement / <audio> element
  小程序 → wx.createInnerAudioContext()
```
- 统一的 `play()`, `pause()`, `seek()`, `onProgress` 接口

### 6.6 下载
```
packages/adapters/src/upload/index.ts
  Web → <a download> / fetch + blob
  小程序 → wx.saveFileToDisk / 分享
```

---

## 7. 安全要求（必须遵守）

### 7.1 日志安全
- **禁止**在任何 log、console.log、console.error 中打印 `Authorization` header
- **禁止**打印 `apiKey`、`token`、`secret`
- **禁止**将 key 写入日志文件

### 7.2 存储安全
- **默认**不保存用户 key（除非用户主动开启）
- sessionStorage 仅用于当前会话临时 key
- 公共部署（GitHub Pages 等）**禁止**开放真实生成功能，需后端鉴权

### 7.3 .env 安全
- `.env` 永不提交
- `.env.example` 只放占位符 `<your_minimax_token_plan_key>`
- CI/CD 使用 secrets 管理，不在代码中硬编码

### 7.4 小程序安全
- **不要**在小程序前端长期存储用户 key
- 推荐通过自托管后端代理调用 MiniMax
- 如果必须在小程序使用用户 key，需明确告知风险

---

## 8. 类型导出（core public API）

```typescript
// types
export type {
  MusicMode, MiniMaxRegion, MiniMaxMusicModel,
  MusicGenerationInput, InstrumentalInput, AutoSongInput,
  LyricsSongInput, CoverUrlInput, CoverFileInput,
  AudioSettings, AudioFormat, OutputFormat,
  MiniMaxMusicGenerationPayload, BuildMusicPayloadResult,
  ValidationResult, Track, Job, TrackStatus,
}

// functions
export { validateMusicInput }
export { buildMiniMaxMusicPayload, normalizeMusicInput, getMiniMaxMusicEndpoint, createAuthorizationHeaders }
export { buildExpandedPrompt }
export { createMockTrack, createMockJob, advanceMockJob, MOCK_JOB_STEPS }

// errors
export { MusicValidationError, MissingApiKeyError, MiniMaxApiError, UnsupportedAdapterError }

// constants
export { DEFAULT_AUDIO_SETTINGS, DEFAULT_REGION, LYRIC_SECTION_TAGS, ... }

---

## Phase 2C 受控真实生成测试记录

### 2026-06-06 — 第一次真实生成尝试

**模式**：instrumental（纯音乐）
**结果**：FAIL — `minimax_api` 错误，`invalid params`

**观察**：
- Shell 环境有 `MINIMAX_API_KEY`（来自 `~/.hermes/auth.json` 注入）
- `REAL_GENERATION_ENABLED=true` 时 server 调用了 MiniMax API
- MiniMax 返回 `invalid params`，HTTP 响应码非 200
- `hasServerKey=true`（key 有效但参数格式不被接受）

**可能原因**：
- MiniMax 音乐生成 API 的 `output_format` 和 `audio_setting` 参数组合可能不被当前 API 版本支持
- `aigc_watermark` 字段可能需要特定值
- `is_instrumental` 参数名或值可能需要调整
- MiniMax 音乐生成 API 端点可能已更新

**后续行动**：
- 需要 MiniMax 官方 API 文档确认最新参数 schema
- 可能需要逐步移除可选参数（`output_format`、`audio_setting`、`aigc_watermark`）以隔离问题
- 建议先通过 mmx CLI adapter 或 curl 直接测试 MiniMax API 参数

---

### 2026-06-06 — Phase 2C-C1: MiniMax 参数隔离诊断（不调用 API）

**结果**：PASS — 无真实 API 调用，找到了根因并修复

**方法**：
- 读取 mmx CLI 源码（`openclaw/dist/music-generation-provider-DdIKzFBP.js`）
- 对比 server 的 `request-builder.ts` 构建的 payload
- 创建 `/api/debug/payload` 做离线 payload 检查
- 创建 `scripts/preview-payload.ts` 跑 4 个场景

**根因（已确认）**：
1. `aigc_watermark: true` — mmx CLI 完全不传此字段，server 旧代码无条件传入
2. `output_format: "mp3/aac"` — 这是无效的 enum 值；MiniMax 只接受 `"url"` 或 `"hex"`

**修复内容**：
- `packages/core/src/constants.ts`：`DEFAULT_OUTPUT_FORMAT = 'url'`
- `packages/core/src/request-builder.ts`：移除 `aigc_watermark: true`
- `server/types.ts`：新增 `'guard'`、`'security'` 错误类型
- `server/index.ts`：新增 `POST /api/debug/payload` endpoint
- `server/core-wrapper.ts`：重新导出 `MusicGenerationInput` 类型

**新 payload（instrumental 模式）**：
```json
{
  "model": "music-2.6",
  "prompt": "warm electronic ambient, calm, focused, no vocals",
  "is_instrumental": true,
  "output_format": "url",
  "audio_setting": {
    "sample_rate": 44100,
    "bitrate": 256000,
    "format": "mp3"
  }
}
```

**工具验证**：
- `scripts/preview-payload.ts` — 4 场景 payload 预览，运行时安全检查通过
- `/api/debug/payload` — HTTP 200，payload 干净，无 Bearer/sk-/key
- `npm run typecheck` — ✅
- `npm run build` — ✅ (216KB JS + 30KB CSS)
- `bash scripts/config-smoke-test.sh` — ✅
- `bash scripts/server-smoke-test.sh` — ✅
- `bash scripts/web-api-smoke-test.sh` — ✅

**Phase 2C-C2 状态**：待用户确认执行单次真实生成（Variant A），已准备好 `docs/real-generation-variants.md`
```

---

## Phase 2C-C2：单次真实生成重测

**状态**：PARTIAL — 协议正确执行，MiniMax 返回服务侧错误

**日期**：2026-06-06

**Protocol**：
1. 停止所有旧 server，确保 8787 端口空闲
2. 安全模式 payload precheck（`/api/debug/payload`）✅
3. 启动唯一真实模式 server ✅
4. 调用 `/api/generate` 一次 ✅（正确 body: `mode=instrumental`）
5. 立刻切回安全模式 ✅

**Payload Precheck 结果**：
```
payload_keys=audio_setting,is_instrumental,model,output_format,prompt
✅ 无 secret 泄露
✅ model=music-2.6
✅ is_instrumental=true
✅ output_format=url
✅ 无 aigc_watermark/lyrics/lyrics_optimizer/stream
```

**真实调用结果**：
```
generation_result=FAIL
error.type=minimax_api
error.message=MiniMax 调用失败：参数不兼容
MiniMax 原始错误=音乐生成准备失败，请稍后重试
requestId=req_2375388c71cf
```

**同时发现的 Bug（已修复）**：
- `callMiniMaxApi` 中 `params.payload.payload` vs `params.payload` 包装 bug → 已修复
- `callMiniMaxApi` 无 fetch timeout 保护 → 已添加 2 分钟 AbortController

**结论**：
- API Adapter 的 minimal payload 结构正确（已 precheck 验证）
- MiniMax API 返回的是**服务侧错误**，非参数格式错误
- 不继续盲目重试 API（避免消耗额度）
- Phase 2D 转向 MMX CLI Adapter

---

## Phase 2D：MMX CLI Adapter

**状态**：IMPLEMENTED — CLI Adapter 已实现，待 Phase 2D-B 用户确认后真实生成测试

**日期**：2026-06-06

### 新增文件

```
server/adapters/minimax-cli/
├── index.ts         — 导出
├── client.ts        — generateWithMmxCli() / diagnoseMmxCli()
├── errors.ts        — MmxCliError 家族 + redactCliOutput()
└── types.ts         — 类型定义
```

### 新增端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/debug/cli` | GET | 安全模式下 mmx CLI 诊断 |

### 新增配置

```
MINIMAX_BACKEND=mock   # mock | api | cli
```

`REAL_GENERATION_ENABLED=false` 时始终走 mock，`MINIMAX_BACKEND` 仅在 `REAL_GENERATION_ENABLED=true` 时生效。

### Backend 路由逻辑

```
realGenerationEnabled=false  → mock（与 backend 无关）
realGenerationEnabled=true + backend=mock  → mock
realGenerationEnabled=true + backend=api   → MiniMax API（experimental）
realGenerationEnabled=true + backend=cli    → mmx CLI（推荐）
PUBLIC_DEMO_MODE=true         → mock（强制）
```

### mmx CLI Adapter Phase 2D.1

CLI adapter 已完成（Phase 2D.1）。服务器 mmx CLI 当前 auth 异常，需手动修复后进行 Phase 2D-B 真实生成测试。

详见 `docs/CLI-ADAPTER.md`。

### API vs CLI Adapter

| 特性 | API Adapter | CLI Adapter |
|------|------------|------------|
| 认证方式 | `MINIMAX_API_KEY` env | mmx auth |
| 请求方式 | HTTP POST | spawn 子进程 |
| 进度 | 需自己轮询 | mmx CLI 管理 |
| Phase 2C 状态 | 服务错误 | 未测试 |
| Phase 2D 状态 | experimental | 已实现，待 2D-B |

---

## Backend 选择建议

| 用户场景 | 推荐 Backend |
|----------|-------------|
| 开发调试 / 演示 | mock |
| 自托管，有有效 API key | api（需 Phase 2C-C2 后确认） |
| 有 mmx CLI auth | cli（推荐） |
| 公共部署 | mock（安全） |
