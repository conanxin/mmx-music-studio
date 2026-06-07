# HTTPS 域名部署指南

> Phase 4E-A 文档 · mmx-music-studio  
> 本阶段：预检、模板和文档准备  
> 不实际申请证书，不修改系统配置

---

## 目标架构

```
公网用户
    ↓ HTTPS (443)
Caddy / Nginx (反向代理)
    ↓ HTTP (127.0.0.1:8787)
mmx-music-studio server
    ↓
MiniMax Token Plan / MMX CLI / Mock
```

**域名：** `music.conanxin.com`（占位符，用户提供后替换）  
**公网 IP：** `118.195.129.137`

---

## 为什么需要 HTTPS 域名

| 场景 | HTTP IP | HTTPS 域名 |
|------|---------|-----------|
| Web 浏览器访问 | ✅ 可用（部分浏览器警告）| ✅ 推荐 |
| 微信开发者工具调试 | ✅ 可用 | ✅ 推荐 |
| **微信小程序正式版** | ❌ 不支持 | ✅ **必须** |
| 微信真机调试 | ❌ 不支持 | ✅ **必须** |
| 公网分享 | ⚠️ 不安全 | ✅ 推荐 |

**微信小程序强制要求 HTTPS 域名。** `http://118.195.129.137:8787` 无法配置为微信合法域名。

---

## 推荐方案：Caddy

### Caddy 优点

- **自动申请 HTTPS 证书**（Let's Encrypt / ZeroSSL）
- **自动续期**，无需手动操作
- **配置极简**，适合个人项目
- **HTTP/2 + HTTP/3** 支持
- **默认启用 TLS 1.3**

### Caddy 缺点

- 不如 Nginx 成熟（极少场景可能不稳定）
- 高并发场景（Nginx 更优）

### 安装 Caddy

```bash
# 方式一：官方脚本（推荐）
curl https://getcaddy.com | bash -s personal

# 方式二：apt
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo apt-key add -
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

### Caddy 配置

```bash
# 1. 复制模板
cp deploy/Caddyfile.safe-preview.example Caddyfile

# 2. 修改域名
# 编辑 Caddyfile，将 music.conanxin.com 替换为真实域名

# 3. 运行（开发测试）
caddy run --config Caddyfile

# 4. 生产环境（systemd）
sudo cp caddy /usr/local/bin/
sudo setcap 'cap_net_bind_service=+ep' /usr/local/bin/caddy
sudo cp deploy/caddy.service.example /etc/systemd/system/caddy.service
sudo systemctl enable --now caddy
```

**Caddyfile 配置模板位置：** `deploy/Caddyfile.safe-preview.example`  
**详细 Caddy 部署文档：** `docs/CADDY_DEPLOYMENT.md`

---

## 备选方案：Nginx

适用于已有 Nginx 或已有证书的用户。

```bash
# 安装
sudo apt install -y nginx certbot

# 申请 Let's Encrypt 证书
sudo certbot --nginx -d music.conanxin.com

# 或手动申请
sudo certbot certonly --standalone -d music.conanxin.com
```

**Nginx 配置模板位置：** `deploy/nginx.mmx-music-studio.conf.example`  
**详细 Nginx 部署文档：** `docs/NGINX_DEPLOYMENT.md`

---

## DNS 要求

在域名服务商（腾讯云 DNSPod / 阿里云 DNS）添加：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|--------|-----|
| A | `music`（或 `@`） | `118.195.129.137` | 600 |

**注意：** 域名必须完成 ICP 备案（微信小程序要求）。

### 验证 DNS 解析

```bash
nslookup music.conanxin.com
# 期望：Address: 118.195.129.137

# 或
python3 -c "import socket; print(socket.gethostbyname('music.conanxin.com'))"
```

---

## 腾讯云安全组配置

### 当前状态

| 端口 | 状态 | 说明 |
|------|------|------|
| TCP 8787 | ✅ 已开放 | 开发/预览用 |
| TCP 80 | ❌ 未确认 | Caddy ACME HTTP-01 验证需要 |
| TCP 443 | ❌ 未确认 | HTTPS 需要 |

### 需要开放

在腾讯云控制台 → 云服务器 → 安全组 → 入站规则，添加：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 80 | 0.0.0.0/0 | Caddy ACME HTTP-01 验证 |
| TCP | 443 | 0.0.0.0/0 | HTTPS |

**注意：** 开放 80/443 后，`118.195.129.137:8787` 可以关闭公网访问，由 Caddy/Nginx 统一对外。

---

## 服务启动配置

### 方式一：直接启动（开发用）

```bash
# 当前方式，server 对外暴露 8787
npm run start
```

### 方式二：只监听本机 + 反代（生产用）

```bash
# 使用脚本（推荐）
bash scripts/run-local-behind-proxy.sh

# 或手动设置
HOST=127.0.0.1 PORT=8787 npm run start
```

**`run-local-behind-proxy.sh` 特点：**
- 默认 mock 模式，不消耗额度
- 不输出任何 key/token
- 默认 `REAL_GENERATION_ENABLED=false`

### 方式三：systemd 管理

```bash
# 复制 systemd 模板
cp deploy/mmx-music-studio.service.example /etc/systemd/system/mmx-music-studio.service

# 编辑配置（修改 WorkingDirectory、Environment 等）
sudo nano /etc/systemd/system/mmx-music-studio.service

# 启用
sudo systemctl enable --now mmx-music-studio
```

---

## 微信小程序合法域名配置

> 详见：`docs/WEAPP_DOMAIN_HTTPS_GUIDE.md`

微信小程序正式版需要在公众平台配置合法域名：

| 域名类型 | 配置值 |
|---------|--------|
| request 合法域名 | `https://music.conanxin.com` |
| downloadFile 合法域名 | `https://music.conanxin.com` |
| uploadFile 合法域名 | `https://music.conanxin.com`（cover 场景需要）|

**域名配置后通常次日生效（首次配置）。**

---

## 安全提醒

### 真实生成时的必须保护

如果 `REAL_GENERATION_ENABLED=true`，**必须**启用以下保护：

- [ ] `GENERATION_ACCESS_ENABLED=true`（生成保护 PIN）
- [ ] `PREVIEW_ACCESS_ENABLED=true`（预览访问 PIN）
- [ ] `RATE_LIMIT_ENABLED=true`（请求限流）
- [ ] `DAILY_QUOTA_ENABLED=true`（每日生成配额）
- [ ] 使用 HTTPS 域名（微信小程序必须）
- [ ] 不要裸奔真实生成到公网

### 不要做的事

- ❌ 不要在公网暴露 8787 端口（生产环境）
- ❌ 不要在未启用 Generation Access 时开放真实生成
- ❌ 不要将 `.env` 提交到 git
- ❌ 不要在日志中输出 API Key / PIN
- ❌ 不要在 `REAL_GENERATION_ENABLED=true` 时无 Rate Limit 公网裸奔

---

## 域名就绪检查

```bash
# 基础检查（无需域名）
bash scripts/domain-readiness-check.sh

# 含域名检查
DOMAIN=music.conanxin.com bash scripts/domain-readiness-check.sh
```

检查项目：
- 本地 server health（8787）
- 端口 80 / 443 占用状态
- Caddy / Nginx 是否安装
- DNS 解析（如果提供 DOMAIN）
- HTTPS 就绪状态（如果提供 DOMAIN）

---

## 快速开始（用户提供域名后）

```bash
# 1. 开放腾讯云安全组 TCP 80/443
# 2. 确保 DNS A 记录已解析到 118.195.129.137

# 3. 安装 Caddy
curl https://getcaddy.com | bash -s personal

# 4. 配置
cp deploy/Caddyfile.safe-preview.example Caddyfile
# 编辑 Caddyfile，将 music.conanxin.com 替换为真实域名

# 5. 只监听本机
bash scripts/run-local-behind-proxy.sh &

# 6. 启动 Caddy（自动申请证书）
caddy run --config Caddyfile

# 7. 验证
curl https://music.conanxin.com/api/health
```

---

## 相关文档

- `docs/CADDY_DEPLOYMENT.md` — Caddy 详细部署步骤
- `docs/NGINX_DEPLOYMENT.md` — Nginx 详细部署步骤
- `docs/DEPLOYMENT.md` — 综合部署指南
- `docs/WEAPP_DOMAIN_HTTPS_GUIDE.md` — 微信小程序 HTTPS 配置
- `docs/SECURITY.md` — 安全设计决策
- `deploy/Caddyfile.safe-preview.example` — Caddy 安全预览配置模板
- `deploy/Caddyfile.example` — Caddy 完整配置模板
- `deploy/nginx.mmx-music-studio.conf.example` — Nginx 配置模板
- `scripts/run-local-behind-proxy.sh` — 反代模式启动脚本
- `scripts/domain-readiness-check.sh` — 域名就绪检查脚本
