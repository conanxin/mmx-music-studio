# Nginx 部署指南

> Phase 3E 文档 · mmx-music-studio
> 仅限有真实域名时执行。当前无域名时跳过。
> 推荐使用 Caddy（自动 HTTPS + 更简单），仅在已有 Nginx 经验时使用此方案。

---

## 前置条件

- [ ] 域名已解析 A 记录到服务器 IP（`118.195.129.137`）
- [ ] 域名已完成 ICP 备案
- [ ] 腾讯云安全组开放 TCP 80 和 443
- [ ] server 运行在 `localhost:8787`（`npm run start`）
- [ ] 已获取 SSL 证书（或使用 Let's Encrypt 自动获取）

---

## SSL 证书准备

### 方式一：Let's Encrypt（免费，自动续期）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d music.yourdomain.com
```

### 方式二：使用已有证书

证书文件路径（填入下方配置）：
- 完整证书链：`/path/to/fullchain.pem`
- 私钥：`/path/to/privkey.pem`

---

## 配置 Nginx

将以下内容写入 `/etc/nginx/sites-available/mmx-music-studio`：

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name music.yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS 反代
server {
    listen 443 ssl http2;
    server_name music.yourdomain.com;

    # SSL 证书（使用 Let's Encrypt 时 certbot 自动写入）
    ssl_certificate     /etc/letsencrypt/live/music.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/music.yourdomain.com/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 安全响应头
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Referrer-Policy "strict-origin-when-cross-origin" always;

    # 反代到本地 server
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 音乐生成是长请求，增加超时
        proxy_read_timeout 180s;
        proxy_connect_timeout 60s;

        # 关闭代理缓冲，支持流式响应
        proxy_buffering off;
    }
}
```

**替换所有 `music.yourdomain.com` 为你的真实域名。**

### 启用配置

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/mmx-music-studio /etc/nginx/sites-enabled/

# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

---

## 验证 HTTPS

```bash
# 检查证书
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
dig music.yourdomain.com
```

确保 A 记录指向 `118.195.129.137`。

### 80/443 端口被占用

```bash
sudo ss -tlnp | grep -E ':(80|443)'
```

确保只有 Nginx 监听这两个端口。

### SSL 证书路径错误

```bash
# 检查证书文件是否存在
ls -la /etc/letsencrypt/live/music.yourdomain.com/
```

### proxy_read_timeout 不足

音乐生成是长请求（可能超过默认 60s）。如果生成过程中断，将 `proxy_read_timeout` 设为 180s 或更高。

### HTTP/2 不生效

确保 Nginx 编译时包含 `--with-http_v2_module`，并监听 `http2`：

```nginx
listen 443 ssl http2;
```

---

## 配置微信合法域名

HTTPS 验证通过后，在微信公众平台配置：

- request 合法域名：`https://music.yourdomain.com`
- downloadFile 合法域名：`https://music.yourdomain.com`

---

## 相关文档

- `deploy/nginx.mmx-music-studio.conf.example` — Nginx 配置模板
- `docs/WEAPP_DOMAIN_HTTPS_GUIDE.md` — 微信小程序 HTTPS 配置总览
- `docs/CADDY_DEPLOYMENT.md` — Caddy 备选方案（更简单，推荐）