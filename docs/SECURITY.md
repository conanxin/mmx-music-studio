# MiniMax 音乐创作台 — 安全设计

## 1. 核心原则

**用户 Key 安全第一**。我们默认所有人都是恶意部署者，所有操作都按最小权限原则执行。

## 2. API Key 管理

### 2.1 默认策略：不保存

- ✅ 默认**不保存**用户 API Key 到任何持久化存储
- ✅ Key 只存在于当前页面内存中（JavaScript 变量）
- ✅ 刷新页面后 Key 需要重新输入
- ✅ 页面关闭后 Key 自动销毁

### 2.2 sessionStorage（可选）

如果用户开启「记住 Key」功能，只存到 `sessionStorage`：

```typescript
// ✅ 可以（会话级）
sessionStorage.setItem('mmx_key', key)

// ❌ 不要（持久化）
localStorage.setItem('mmx_key', key)  // 禁止
```

- `sessionStorage` 在标签页关闭后自动清除
- 不同标签页不共享（除非显式 open）

### 2.3 服务端环境变量（自托管）

自托管部署时，Key 通过环境变量注入：

```bash
# 服务器上
export MINIMAX_API_KEY=your_real_key

# 代码中
const key = process.env.MINIMAX_API_KEY  // Key 不经过前端
```

此时前端完全接触不到真实 Key。

## 3. 日志安全

### 3.1 禁止打印的内容

```typescript
// ❌ 绝对禁止
console.log('Authorization:', headers['Authorization'])
console.log('API Key:', apiKey)
console.log('Bearer token:', token)

// ✅ 正确做法：只打印非敏感信息
console.log('请求已发送，任务 ID:', taskId)
console.log('生成状态:', status)
```

### 3.2 网络请求中的 Key

如果使用 fetch 发送请求，确保：

```typescript
// ✅ 正确：Key 在请求头中，但不在日志中
const response = await fetch(url, {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
})

// ❌ 错误：把 Key 打印出来
console.log('请求头:', { Authorization: `Bearer ${apiKey}` })
```

## 4. 环境变量

### 4.1 `.env.example`

```bash
# ✅ 正确：只放占位符
MINIMAX_API_KEY=<your_minimax_token_plan_key>

# ❌ 错误：放真实 Key
MINIMAX_API_KEY=sk-xxxxxxxxxxxxx  ← 禁止
```

### 4.2 `.gitignore`

确保以下文件/目录不会被提交：

```
# 环境变量（禁止提交）
.env
.env.local
.env.production

# Key 相关的临时文件
*.log（如果日志可能包含敏感信息）

# 不提交 node_modules（一般不提交）
node_modules/
```

### 4.3 CI/CD

- 构建时不打印任何包含 `KEY`、`TOKEN`、`SECRET` 的环境变量
- 使用 CI secrets 管理，不要把真实 Key 写在 `.travis.yml` / `.github/workflows` 等配置文件中

## 5. 公共部署安全

### 5.1 安全预览模式（Safe Preview Mode）

安全预览模式由三个条件共同保证，不依赖单一字段：

| 条件 | 说明 |
|------|------|
| `REAL_GENERATION_ENABLED=false` | 禁止调用 MiniMax |
| `MINIMAX_BACKEND=mock` | 使用本地模拟后端 |
| `MOCK_GENERATION_ENABLED=true` | 本地模拟生成可用 |

只要这三个条件同时满足，无论 `PUBLIC_DEMO_MODE` 是什么值，都是安全预览模式。

### 5.2 双层访问保护

Phase 2I + Phase 4C 新增。

#### Preview Access Gate（页面访问保护）

- `PREVIEW_ACCESS_ENABLED=true` + `PREVIEW_ACCESS_PIN=<pin>` 开启
- PIN 只从环境变量读取，不写入代码/git
- 验证成功设置 HttpOnly cookie，24小时有效
- 未解锁时 API 返回 401

#### Generation Access Gate（生成接口保护）

Phase 4C 新增。保护 `/api/generate` 防止未授权用户触发真实生成。

- `GENERATION_ACCESS_ENABLED=true` + `GENERATION_ACCESS_PIN=<pin>` 开启
- 独立于 Preview Access 的第二层保护
- 配合速率限制（`RATE_LIMIT_ENABLED=true`）和每日额度（`DAILY_QUOTA_ENABLED=true`）使用
- 建议在公网部署时同时开启两层保护

详见 [docs/AUTH_AND_QUOTA.md](AUTH_AND_QUOTA.md)。

### 5.3 公共部署建议

如果你在公网上部署此项目（不是自用）：

- ✅ 保持安全预览模式（`REAL_GENERATION_ENABLED=false` + `backend=mock`）
- ✅ 开启 `PREVIEW_ACCESS_ENABLED=true` 保护公网预览
- ✅ 如果要开启真实生成，需要添加用户认证
- ✅ 添加生成频率限制（防止滥用额度）
- ✅ 添加使用量监控
- ❌ 不要让任意访客都能使用你的 API Key 生成音乐

### 5.3 认证方案（future）

若要支持多用户：

- 方案 A：每个用户填自己的 Key（BYOK，Key 不经过你的服务器）
- 方案 B：你的服务器持有 Key，用户通过 OAuth 登录（你控制额度）
- 方案 C：Stripe 订阅 + 你的服务器持有 Key（商业化）

## 6. 前端安全

### 6.1 不要在源代码中硬编码 Key

```typescript
// ❌ 错误
const API_KEY = 'sk-xxxxxxxxxxxxx'

// ✅ 正确
const API_KEY = import.meta.env.VITE_MINIMAX_API_KEY
```

### 6.2 CSP（Content Security Policy）

生产环境建议配置 CSP header：

```
Content-Security-Policy:
  default-src 'self';
  connect-src 'self' https://api.minimax.chat https://api.minimaxi.chat;
  media-src 'self' blob:;
```

### 6.3 XSS 防护

- 用户输入的歌词/描述不做 HTML 渲染，只做纯文本展示
- 使用 React 的默认 XSS 防护
- 音频 URL 使用 `audio` 元素，不使用 `iframe`

## 7. 小程序特别注意事项

### 7.1 不要在 storage 中存 Key

```typescript
// ❌ 小程序中禁止
wx.setStorageSync('mmx_key', apiKey)

// ✅ 推荐：只存内存
let apiKey = ''  // 内存变量，页面销毁即消失
```

### 7.2 后端代理

小程序推荐使用后端代理调用 MiniMax：

```
小程序 → 你的后端 → MiniMax
           ↑
       （Key 在这里）
```

这样 Key 完全不需要传到小程序前端。

### 7.3 安全提示

在设置页显示安全提示：

```
⚠️ 安全提示
• 我们不会保存您的 Key
• 您的 Key 仅用于当前会话
• 请勿在公共网络环境下输入真实 Key
• 建议使用后端代理模式，避免 Key 暴露在前端
```

## 8. 安全检查清单

部署前检查：

- [ ] `.env` 文件不在 git 仓库中
- [ ] 没有 console.log 打印 Authorization 或 Key
- [ ] `.env.example` 只有占位符
- [ ] 公共部署默认开启安全预览模式（`REAL_GENERATION_ENABLED=false` + `backend=mock`）
- [ ] 公网部署开启 `PREVIEW_ACCESS_ENABLED=true`
- [ ] 没有硬编码的 API Key
- [ ] 小程序端不使用 wx.setStorageSync 存储 Key
- [ ] PIN 不写入代码/git/文档（只通过环境变量配置）

### 8.1 任务历史安全（Phase 4D）

Job History Admin 遵循以下安全原则：

- **不保存敏感信息。** Job record 不保存 API key / Authorization header / PIN
- **Retry 保护。** Retry 操作仍受 Generation Access PIN + Rate Limit + Daily Quota 保护，真实生成不会绕过后端防护
- **运行中任务不可删除。** DELETE 只允许对 succeeded/failed/cancelled 状态的任务执行
- **操作可溯源。** 所有 DELETE / RETRY 操作均通过 HTTP method 区分，日志可查