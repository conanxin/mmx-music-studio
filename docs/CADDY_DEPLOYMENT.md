# Caddy 部署指南

> Phase 3E 文档 · mmx-music-studio
> 仅限有真实域名时执行。当前无域名时跳过。

---

## 前置条件

- [ ] 域名已解析 A 记录到服务器 IP（`118.195.129.137`）
- [ ] 域名已完成 ICP 备案
- [ ] 腾讯云安全组开放 TCP 80 和 443
- [ ] server 运行在 `localhost:8787`（`npm run start`）

---

## 安装 Caddy

### 方式一：官方安装脚本（推荐）

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 方式二：下载二进制

```bash
curl -o caddy https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_linux_amd64.tar.gz
tar -xzf caddy_2.8.4_linux_amd64.tar.gz
sudo mv caddy /usr/local/bin/
```

---

## 配置 Caddyfile

将以下内容写入 `/etc/caddy/Caddyfile`（或项目目录的 `Caddyfile`）：

```bash
music.yourdomain.com {
    encode gzip

    # 反代到本地 server
    reverse_proxy 127.0.0.1:8787

    # 安全响应头
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        X-Referrer-Policy "strict-origin-when-cross-origin"
        X-XSS-Protection "1; mode=block"
    }
}
```

**替换 `music.yourdomain.com` 为你的真实域名。**

---

## 启动 Caddy

### 方式一：systemd（生产推荐）

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
```

### 方式二：前台运行（调试）

```bash
caddy run --config /etc/caddy/Caddyfile
```

---

## 验证 HTTPS

```bash
# 检查证书是否自动申请
curl -I https://music.yourdomain.com

# 检查 API health
curl https://music.yourdomain.com/api/health

# 检查 JSON 响应
curl https://music.yourdomain.com/api/health | python3 -m json.tool
```

预期输出：`{"status":"ok","phase":"3E","mock":true}`

---

## 常见问题

### 域名未解析

```bash
# 检查 DNS 是否生效
dig music.yourdomain.com
# 或
nslookup music.yourdomain.com
```

确保 A 记录指向 `118.195.129.137`。

### 80/443 端口未开放

```bash
# 检查端口占用
sudo ss -tlnp | grep -E ':(80|443)'

# 腾讯云安全组检查：入站规则开放 TCP 80, 443
```

### 证书申请失败

Caddy 使用 Let's Encrypt 自动申请证书，依赖 80 端口。

```bash
# 查看 Caddy 日志
sudo journalctl -u caddy --no-pager -n 50
```

常见原因：
- 域名未解析到本服务器 IP
- 80 端口被其他程序占用
- DNS 生效延迟（等待 10 分钟后再试）

### 后端 8787 未运行

```bash
# 启动 server
cd /home/ubuntu/projects/mmx-music-studio
npm run start

# 确认 8787 端口监听
ss -tlnp | grep 8787
```

### 证书已过期

Caddy 会自动续期。如果异常，手动触发：

```bash
sudo caddy reload --config /etc/caddy/Caddyfile
```

---

## 配置微信合法域名

HTTPS 验证通过后，在微信公众平台配置：

- request 合法域名：`https://music.yourdomain.com`
- downloadFile 合法域名：`https://music.yourdomain.com`

---

## 停止 Caddy

```bash
sudo systemctl stop caddy
```

---

## 相关文档

- `deploy/Caddyfile.example` — Caddy 配置模板
- `docs/WEAPP_DOMAIN_HTTPS_GUIDE.md` — 微信小程序 HTTPS 配置总览
- `docs/NGINX_DEPLOYMENT.md` — Nginx 备选方案