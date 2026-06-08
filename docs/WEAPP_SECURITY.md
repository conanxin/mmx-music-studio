# 微信小程序安全规范 / WeApp Security

> 文档版本：Phase 3E · 2026-06-07
> 重要程度：**高** — 违反以下规范可能导致用户 Token Plan 被盗用或小程序被封禁

---

## 核心安全原则

### ❌ 严禁在小程序端写入真实 API Key

**无论任何原因，都不要将真实 MiniMax API Key 写入以下位置：**

```typescript
// ❌ 错误 — app.config.ts
export default {
  apiKey: 'sk-xxxxxxxxxxxxxxxx'  // 可被反编译提取！
}

// ❌ 错误 — project.config.json
{
  "setting": {
    "urlCheck": false
  },
  "appid": "wx1234567890",
  "apiKey": "sk-xxxxxxxxxxxxxxxx"
}

// ❌ 错误 — app.tsx 中的常量
const API_KEY = 'sk-xxxxxxxxxxxxxxxx';

// ❌ 错误 — wx.setStorage / wx.getStorage（即使加密也可被提取）
wx.setStorage({ key: 'apiKey', data: 'sk-xxxxxxxxxxxxxxxx' });

// ❌ 错误 — env 文件
MINIMAX_API_KEY=sk-xxxxxxxxxxxxxxxx
```

**原因**：微信小程序代码对用户可见（通过反编译工具），任何写在客户端的 Key 都可被提取并滥用。

### ✅ 正确做法：后端代理模式

```
用户操作 → 小程序 → 自托管 Server → MiniMax API
              ↑          ↑
           不带 key    server 有 key
```

小程序**永远不直接请求 MiniMax**。所有请求经自托管 server 代理：

1. Server 持有 MiniMax API Key（存在服务端环境变量）
2. 小程序只请求 `https://your-domain.com/api/*`
3. Server 鉴权后转发请求到 MiniMax

---

## 微信平台安全要求

### HTTPS 域名（正式版必须）

| 环境 | 要求 |
|------|------|
| 开发阶段 | 可用 HTTP IP（如 `http://192.168.1.100:8787`）临时调试 |
| 正式版 | **必须**使用 HTTPS + 已备案域名 |
| 微信公众平台 | 需在「开发」→「开发管理」→「开发设置」中配置 request 合法域名 |

**配置步骤：**
1. 购买并备案域名
2. 配置 HTTPS（推荐 Caddy 自动 HTTPS）
3. 在微信公众平台添加 request 合法域名：`https://your-domain.com`

### HTTP IP 临时调试说明

```
⚠️ 开发阶段可用 HTTP IP 调试：
- 微信开发者工具：「详情」→「本地调试」可跳过域名检查
- 手机真机：需打开调试模式或设置不校验域名（开发阶段）

⚠️ 正式发布前必须：
- 配置 HTTPS 域名
- 在微信公众平台配置合法域名
- 移除所有 hardcoded IP
```

---

## 数据存储安全

### ❌ 禁止长期存储 API Key

```typescript
// ❌ 错误 — 长期存储
wx.setStorageSync('minimax_key', 'sk-xxxxxxxxxxxxxxxx')

// ❌ 错误 — 加密存储（仍可被提取）
const encrypted = encrypt('sk-xxx', deviceId)
wx.setStorageSync('apiKey', encrypted)
```

### ✅ 允许的存储

```typescript
// ✅ 用户偏好设置（非敏感）
wx.setStorageSync('theme', 'dark')
wx.setStorageSync('lastMode', 'instrumental')

// ✅ 临时会话标识（不含 key）
wx.setStorageSync('sessionId', 'sess_abc123')

// ✅ 后端颁发的临时 token（由 server 控制生命周期）
wx.setStorageSync('serverToken', 'Bearer eyJhbGci...')
```

---

## 公网真实生成安全

### ⚠️ 真实生成必须经后端代理

```bash
# server 环境变量（不在小程序端）
MINIMAX_API_KEY=sk-xxxxxxxxxxxxxxxx  # server 持有
REAL_GENERATION_ENABLED=true         # server 控制
```

### 前置安全措施（公网开放前必须实现）

| 措施 | 说明 | 必须 |
|------|------|------|
| 用户鉴权 | 用户需登录才能生成 | ⚠️ 推荐 |
| 速率限制 | 防止滥用额度 | ⚠️ 推荐 |
| 额度限制 | 单用户额度上限 | ⚠️ 推荐 |
| 请求日志 | 审计异常行为 | ⚠️ 可选 |
| IP 限制 | 仅允许已知 IP | ⚠️ 可选 |

### 公网真实生成前检查清单

- [ ] 用户鉴权已实现
- [ ] 速率限制已配置
- [ ] 额度限制已配置
- [ ] HTTPS 域名已配置
- [ ] request 合法域名已在微信公众平台配置
- [ ] 小程序代码中无真实 API Key
- [ ] server 环境变量已正确设置
- [ ] 日志记录已开启

---

## adapter 安全规范

### request.ts

```typescript
// ✅ 正确 — 不在代码中硬编码真实生产 IP
const getApiBase = (): string => {
  const base = wx.getStorageSync('api_base')
  // 开发阶段可临时使用 localhost，但必须通过配置而非硬编码
  return base || 'https://your-domain.example'  // 占位符，非真实 IP
}

// ❌ 错误 — 硬编码真实生产 IP
const API_BASE = 'http://118.195.129.137:8787'  // 暴露真实服务器
```

### storage.ts

```typescript
// ✅ 正确 — 不存储 key
wx.setStorageSync('theme', 'dark')

// ❌ 错误 — 存储 key
wx.setStorageSync('minimax_api_key', 'sk-xxx')
```

### audio.ts

```typescript
// Phase 3A：mock 实现
// Phase 3C+：使用 wx.createInnerAudioContext，不涉及 key
```

---

## 微信平台审核注意事项

1. **不得在小程序中展示真实 API Key**（审核被拒原因之一）
2. **不得调用未备案域名**（审核被拒原因之一）
3. **不得使用 HTTP（非 HTTPS）作为 API base**（正式版）
4. **不得收集用户敏感信息未告知**（需隐私政策）

---

## 安全事件响应

如果发现 Token Plan 被盗用：

1. **立即**：在 MiniMax 控制台撤销当前 Key
2. **立即**：在自托管 server 端关闭真实生成（`REAL_GENERATION_ENABLED=false`）
3. **检查**：server 日志中的异常请求
4. **更新**：生成新 Key，替换 server 环境变量
5. **通知**：受影响的用户

---

## 相关文档

- `docs/SECURITY.md` — Web 版安全规范
- `docs/DEPLOYMENT.md` — 部署指南（含安全默认值）
- `docs/WEAPP_ARCHITECTURE.md` — 小程序架构说明
- `docs/WEAPP_ROADMAP.md` — 开发路线图


---

## 小程序 BYOK 策略（Phase 5C 规划）

> ⚠️ **小程序端强烈不建议直接暴露用户 API key**

### 推荐架构

```
用户小程序
  → 填写 BYOK Key（存在小程序本地 storage，仅本人可见）
    → 请求自托管后端（/api/generate + x-minimax-api-key header）
      → 后端 BYOK guard
        → 验证 key 格式
        → 存入 job.id → key 内存 Map
          → 调用 MiniMax API
```

### 关键安全要求

1. **小程序本地存储 key**：用户 key 存在小程序 `wx.setStorageSync`，不经过你的服务器存储
2. **后端 BYOK**：key 只存后端内存 Map，不落盘，不记录日志
3. **自托管后端代理**：小程序不直接调用 MiniMax API，而是通过你的后端代理
4. **HTTPS**：小程序必须使用 HTTPS，所有 key 传输走 HTTPS
5. **域名白名单**：小程序必须通过已备案的服务器域名调用

### Phase 5C 待实现

- [ ] apps/weapp/src/adapters/byok-storage.ts（小程序 storage adapter）
- [ ] 后端 BYOK 小程序白名单（可选）
- [ ] 小程序端 BYOK UI
- [ ] 安全提示页面

详见 [docs/BYOK_MODE.md](BYOK_MODE.md)。

