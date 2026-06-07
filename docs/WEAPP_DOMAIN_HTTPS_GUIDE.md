

---

## 正式生产地址（Phase 4E-B 实装）

**HTTPS 地址：** https://music.conanxin.com

| 域名类型 | 配置值 | 状态 |
|---------|--------|------|
| request 合法域名 | `https://music.conanxin.com` | ✅ 可配置 |
| downloadFile 合法域名 | `https://music.conanxin.com` | ✅ 可配置 |
| uploadFile 合法域名 | `https://music.conanxin.com` | ✅ 可配置 |

> ⚠️ 微信公众平台域名配置通常次日生效（首次配置）。

---

# 微信小程序 HTTPS 域名配置指南

> Phase 4E-B 文档 · mmx-music-studio
> **HTTPS 已实装：** https://music.conanxin.com
> 当前 HTTP IP `http://118.195.129.137:8787` 建议关闭公网，由 Caddy 统一对外。

---

## 为什么正式小程序需要 HTTPS 域名

微信小程序**正式环境**（即用户通过微信正式版访问，而非开发者工具）**强制要求 HTTPS**：

| 场景 | 要求 |
|------|------|
| `wx.request`（API 请求） | 目标域名必须在微信公众平台配置为 **request 合法域名** |
| `wx.downloadFile`（文件下载） | 目标域名必须在微信公众平台配置为 **downloadFile 合法域名** |
| `wx.uploadFile`（文件上传，cover 场景） | 目标域名必须在微信公众平台配置为 **uploadFile 合法域名** |
| 音频播放（`src` 属性） | 必须 HTTPS URL，否则 iOS 微信可能无法播放 |

**HTTP 裸 IP（如 `http://118.195.129.137:8787`）无法配置为微信合法域名。** 微信只接受域名，不接受 IP 地址。

---

## 开发阶段 vs 正式环境

### 开发阶段（当前）

- API Base：`http://118.195.129.137:8787`
- 微信开发者工具中勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」
- 不需要在微信公众平台配置域名
- 适合：本地开发、开发者工具调试

### 正式发布阶段（Phase 3E+）

- 需要准备 HTTPS 域名
- 微信公众平台 → 开发管理 → 开发设置 → 服务器域名 → 添加合法域名
- 小程序代码中的 API Base 改为 `https://music.conanxin.com`
- 开发者工具也需要更新 API Base 并关闭合法域名校验

---

## 目标生产地址（示例）

> ⚠️ 以下为占位符域名，请替换为你的真实域名。

```
API Base（生产）：https://music.conanxin.com
```

---

## 微信公众平台域名配置

登录 [微信公众平台](https://mp.weixin.qq.com/) → 开发管理 → 开发设置 → 服务器域名：

| 域名类型 | 配置值 | 说明 |
|----------|--------|------|
| request 合法域名 | `https://music.conanxin.com` | API 请求（health、generate、tracks 等） |
| downloadFile 合法域名 | `https://music.conanxin.com` | 音频文件下载 |
| uploadFile 合法域名 | `https://music.conanxin.com` | cover 参考音频上传（如需要） |
| socket 合法域名 | 不需要 | 当前无 WebSocket 用例 |

> 注意：域名必须备案（国内服务器）；配置后次日生效（首次配置）。

---

## 域名准备清单

在配置微信合法域名之前，需要先完成以下步骤：

### 1. 域名准备

- [ ] 已有可用的域名（如 `music.conanxin.com`）
- [ ] 域名已完成 ICP 备案（微信要求）
- [ ] 域名解析 A 记录指向服务器 IP：`118.195.129.137`
- [ ] 等待 DNS 生效（通常 10 分钟~48 小时）

### 2. 服务器端口开放

- [ ] 腾讯云安全组开放 **TCP 80**（HTTP，用于 Let's Encrypt 证书申请）
- [ ] 腾讯云安全组开放 **TCP 443**（HTTPS）
- [ ] 确认 `curl http://music.conanxin.com` 能访问到服务器

### 3. 反向代理配置

- [ ] 安装并配置 Caddy 或 Nginx（见下方配置模板）
- [ ] 证书自动申请（Let's Encrypt）
- [ ] 反代到 `127.0.0.1:8787`

### 4. 验证 HTTPS

- [ ] `curl https://music.conanxin.com/api/health` 返回 JSON
- [ ] 浏览器访问 `https://music.conanxin.com` 无证书警告

### 5. 微信公众平台配置

- [ ] 在 request 合法域名中添加 `https://music.conanxin.com`
- [ ] 在 downloadFile 合法域名中添加 `https://music.conanxin.com`
- [ ] 等待域名审核生效（通常次日）

### 6. 小程序更新

- [ ] 将 `apps/weapp/src/config/api.ts` 中的 `apiBase` 更新为 `https://music.conanxin.com`
- [ ] 或在设置页面填写新的 API Base
- [ ] 重新编译：`npm run weapp:build`
- [ ] 在开发者工具中验证请求正常

---

## 配置模板

### Caddy（推荐，自动 HTTPS）

配置文件：`deploy/Caddyfile.example`

```bash
music.conanxin.com {
    encode gzip
    reverse_proxy 127.0.0.1:8787
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

详细说明见 `docs/CADDY_DEPLOYMENT.md`。

### Nginx

配置文件：`deploy/nginx.mmx-music-studio.conf.example`

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name music.conanxin.com;
    return 301 https://$host$request_uri;
}

# HTTPS 反代
server {
    listen 443 ssl http2;
    server_name music.conanxin.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_read_timeout 180s;
        proxy_buffering off;
    }
}
```

详细说明见 `docs/NGINX_DEPLOYMENT.md`。

---

## 小程序 API Base 切换

### 当前开发配置（apps/weapp/src/config/api.ts）

```typescript
export const API_CONFIG = {
  // 开发默认：HTTP IP + 微信开发者工具关闭合法域名校验
  defaultApiBase: 'http://118.195.129.137:8787',
  // 生产占位符（用户提供域名后替换）
  productionApiBase: 'https://music.conanxin.com',
}
```

### 设置页面提示

设置页会显示：
> ⚠️ 正式小程序请使用 **HTTPS 域名**，并在微信公众平台「开发设置」→「服务器域名」中配置 `request` 和 `downloadFile` 合法域名。HTTP IP 仅适合开发者工具调试。

---

## 安全提示

**重要：公网开放真实生成前的必备措施**

- [ ] **登录鉴权**：不要让未登录用户免费调用生成 API
- [ ] **额度限制**：每个用户限额（如每天 10 次），防止滥用
- [ ] **速率限制**：防止刷接口
- [ ] **额度追踪**：记录每个用户的生成次数和消耗
- [ ] **管理员功能**：可查看/管理用户额度
- [ ] **日志与告警**：异常调用触发告警
- [ ] **不存储 key 在小程序端**：真实生成由 server 后端代理或 CLI adapter 执行

**小程序的 BYOK 模式**：用户可在设置页填入自己的 MiniMax key，server 用用户的 key 调用 MiniMax API（用户自付额度）。这种情况下 server 仍需鉴权，只是不需要存储 key。

---

## 常见问题

**Q: 微信公众平台域名配置审核需要多久？**
A: 首次配置通常次日生效，之后修改一般几分钟~几小时。

**Q: 域名已解析但 curl 报错？**
A: 检查腾讯云安全组是否开放 80/443 端口；检查 Caddy/Nginx 是否已启动。

**Q: 微信开发者工具可以正常请求，但真机不行？**
A: 确认已在微信公众平台配置合法域名；确认手机网络可以访问该域名；确认证书有效。

**Q: 证书申请失败？**
A: 确保域名已解析到服务器 IP；确保 80 端口未被占用；查看 Caddy 日志 `caddy logs`。

---

## 相关文档

- `docs/CADDY_DEPLOYMENT.md` — Caddy 部署详细指南
- `docs/NGINX_DEPLOYMENT.md` — Nginx 部署详细指南
- `docs/WEAPP_TROUBLESHOOTING.md` — 微信小程序问题排查
- `docs/WEAPP_SECURITY.md` — 安全规范
- `deploy/Caddyfile.example` — Caddy 配置模板
- `deploy/nginx.mmx-music-studio.conf.example` — Nginx 配置模板
- `scripts/weapp-domain-readiness-check.sh` — 域名就绪检查脚本