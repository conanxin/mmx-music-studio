# WeChat Mini Program BYOK Strategy

> **Phase 5C 产物** — 不做真实生成，不消耗额度。

## Goal

让小程序用户在当前会话中临时输入自己的 MiniMax Token Plan Key，通过自托管 server 的 BYOK API Adapter 生成音乐。Phase 5C 只做 UI 原型和代码实现，不做真实小程序 BYOK 测试（留到 Phase 5D）。

## Security Principles

| 原则 | 实现 |
|------|------|
| 小程序端不长期保存 Key | 仅模块级内存变量，不调用 `wx.setStorage` / `Taro.setStorage` |
| 不写入 localStorage | 使用 `apps/weapp/src/adapters/byok.ts` 内存 adapter |
| 不放 URL | `x-minimax-api-key` 仅在 HTTP header |
| 不放 JSON body | 生成请求 body 不包含 `apiKey` 字段 |
| 不写日志 | `byok.ts` 中所有函数均无 `console.log` key 相关内容 |
| 不写 manifest | manifest.json 不存储 key 明文 |
| 不写 audit log | audit log 只记录 job metadata，不记录 key 原文 |
| 会话后自动清除 | 页面刷新 / 小程序重启后 key 丢失 |

## Runtime Modes

| Mode | BYOK Key 生效？ | 说明 |
|------|----------------|------|
| `mock` | 不需要 | 无需 Key，模拟生成 |
| `cli` | 不生效 | 使用服务器 mmx CLI 登录状态，小程序 session key 不参与 |
| `api` + `byokEnabled=true` | 需要 | 用户必须填写 session key，否则禁止生成 |
| `api` + `byokEnabled=false` | 不生效 | 使用服务器端 key（`BYOK_MODE=disabled`） |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  小程序端                                                    │
│                                                             │
│  pages/settings/          pages/studio/                     │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │ Key 输入框    │         │ 模式选择      │                 │
│  │ [保存会话]   │ ──────► │ 音乐描述     │                 │
│  │ [清除 Key]   │         │ [生成音乐]   │                 │
│  │ sk_xxx...xxx │         └──────┬───────┘                 │
│  └──────┬───────┘                │                         │
│         │ setSessionApiKey()      │ hasSessionApiKey()      │
│         ▼                        ▼                         │
│  ┌─────────────────────────────────────────┐              │
│  │  adapters/byok.ts (内存模块)              │              │
│  │  - setSessionApiKey()                    │              │
│  │  - getSessionApiKey()                    │              │
│  │  - clearSessionApiKey()                   │              │
│  │  - hasSessionApiKey()                     │              │
│  └─────────────────────────────────────────┘              │
│         │                                                   │
│         │ getByokHeaders()                                │
│         ▼                                                   │
│  ┌─────────────────────────────────────────┐              │
│  │  adapters/request.ts                     │              │
│  │  generateTrack(input, options)            │              │
│  │  - 读取 session key from byok adapter    │              │
│  │  - 添加 x-minimax-api-key header         │              │
│  │  - body 不含 apiKey                       │              │
│  └─────────────────────────────────────────┘              │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP Request
                │ x-minimax-api-key: sk_xxx
                ▼
┌─────────────────────────────────────────────────────────────┐
│  自托管 mmx-music-studio server                            │
│  (Phase 5A: BYOK API Adapter)                              │
│                                                             │
│  ┌─────────────────────────────────────────┐              │
│  │  server/api.ts                           │              │
│  │  BYOK_MEMORY_MAP (Map<clientId, string>) │              │
│  │  getClientApiKey(clientId)               │              │
│  └─────────────────────────────────────────┘              │
│         │                                                   │
│         │ 真实 API 调用时使用 clientKey                    │
│         ▼                                                   │
│  ┌─────────────────────────────────────────┐              │
│  │  MiniMax API                            │              │
│  │  /v1/text/chatcompletion_pro  (真实请求)  │              │
│  └─────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## Key Masking

`maskApiKey()` 显示格式：`sk_xxxx...xxxx`（前 4 + 后 4，中间 `***`）

示例：`sk_abc123def456789` → `sk_abc1...6789`

## WeChat Constraints

| 约束 | 当前状态 | 解决方案 |
|------|----------|----------|
| 正式版需要 HTTPS 合法域名 | 备案未完成 | Phase 5D 之后接入真实域名 |
| request 合法域名需配置 | 未配置 | 开发者工具可临时关闭域名校验 |
| downloadFile 合法域名需配置 | 未配置 | 开发者工具可临时关闭域名校验 |
| 前端代码可被反编译 | 是 | key 仅内存存在，重启即失 |
| 小程序正式版需审核 | 是 | 后续按微信流程提交 |

## UX Flow

### 设置页 (pages/settings/)

```
┌─────────────────────────────────────────────┐
│  设置                                   ⚙️   │
├─────────────────────────────────────────────┤
│                                             │
│  MiniMax Token Plan Key                    │
│  ─────────────────────────────────────────  │
│                                             │
│  当前小程序 BYOK 为会话级 Key，             │
│  只保存在当前运行内存中，关闭小程序后会清空。 │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 请输入你的 MiniMax Token Plan Key   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [    保存到当前会话    ]                   │
│                                             │
│  Key 状态：未填写 / 已填写 (sk_xxx...xxx)   │
│                                             │
│  [    清除 Key    ]                        │
│                                             │
│  ⚠️ Key 不会写入本地存储，                │
│     不会进入 URL 或请求 body。             │
│                                             │
└─────────────────────────────────────────────┘
```

### 创作页 (pages/studio/)

```
┌─────────────────────────────────────────────┐
│  创作                                   ⚙️   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐              │
│  │纯音乐│ │自动成歌││歌词成歌││参考改编│              │
│  └────┘ └────┘ └────┘ └────┘              │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ 描述你想要的音乐...                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [        生成音乐         ]               │
│                                             │
│  ⚠️ backend=api + 无 session key:          │
│  「请先在设置页填写 MiniMax Token Plan Key」│
│                                             │
│  ⚠️ backend=api + 有 session key:           │
│  「真实生成会消耗你的 Token Plan 额度」    │
│                                             │
│  ⚠️ backend=mock:                          │
│  「当前为模拟模式，不消耗额度」            │
│                                             │
│  ⚠️ backend=cli:                          │
│  「CLI 模式使用服务器登录状态」            │
│                                             │
└─────────────────────────────────────────────┘
```

## Files Changed / Added (Phase 5C)

| File | Action |
|------|--------|
| `apps/weapp/src/adapters/byok.ts` | **NEW** — 内存 key adapter |
| `apps/weapp/src/adapters/request.ts` | UPDATE — `getByokHeaders()` + `x-minimax-api-key` header |
| `apps/weapp/src/pages/settings/index.tsx` | UPDATE — BYOK UI 区块 |
| `apps/weapp/src/pages/settings/index.scss` | UPDATE — BYOK 样式 |
| `apps/weapp/src/pages/studio/index.tsx` | UPDATE — BYOK 状态检查和提示 |
| `apps/weapp/src/pages/studio/index.scss` | UPDATE — BYOK 提示样式 |
| `docs/WEAPP_BYOK_STRATEGY.md` | **NEW** — 本文档 |
| `docs/WEAPP_SECURITY.md` | UPDATE — 小程序 BYOK 安全说明 |
| `docs/WEAPP_DEV_GUIDE.md` | UPDATE — 开发说明 |
| `docs/BYOK_MODE.md` | UPDATE — 补充小程序 BYOK 章节 |
| `docs/DEVELOPMENT_HANDOFF.md` | UPDATE — Phase 5C handoff 说明 |
| `README.md` | UPDATE — Phase 5C 状态 |
| `scripts/weapp-byok-strategy-smoke-test.sh` | **NEW** — 小程序 BYOK 静态检查 |
| `CHANGELOG.md` | UPDATE — v0.3.2-alpha entry |
| `docs/release/RELEASE_NOTES_v0.3.2-alpha.md` | **NEW** — Phase 5C release notes |

## Phase 5D: Real Mini Program BYOK Controlled Test

Phase 5C 只做原型，不做真实小程序 BYOK 测试。Phase 5D 将：

1. 在开发者工具中填入真实 key
2. 调用自托管 server 的 `/api/generate` with `x-minimax-api-key` header
3. 验证真实音乐生成
4. 验证额度和 manifest 正确性
5. 验证 no key leakage

## Future (Phase 5E+)

- 用户授权 / 登录系统
- 额度管理界面
- 小程序正式版 HTTPS 域名接入
- 微信登录 + 自托管后端认证