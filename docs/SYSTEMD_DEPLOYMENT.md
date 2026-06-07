# Systemd 部署指南

本文档说明如何使用 systemd 在 Linux 服务器上部署 mmx-music-studio。

---

## 前置条件

- Linux 服务器（Ubuntu 22.04+ / Debian 12+）
- Node.js 18+ 已安装
- 已克隆项目到服务器

---

## 步骤 1：创建专用用户（推荐）

```bash
# 创建非 root 用户（可选但推荐）
sudo useradd -r -m -s /bin/false mmx 2>/dev/null || true
sudo mkdir -p /opt
sudo chown mmx:mmx /opt
```

---

## 步骤 2：克隆并构建

```bash
# 以 mmx 用户身份 clone（如果创建了专用用户）
# sudo -u mmx git clone https://github.com/conanxin/mmx-music-studio.git /opt/mmx-music-studio

# 或直接 clone 到 /opt
cd /opt
sudo git clone https://github.com/conanxin/mmx-music-studio.git mmx-music-studio
cd mmx-music-studio

# 安装依赖
sudo npm install

# 构建
sudo npm run build

# 创建存储目录
sudo mkdir -p /opt/mmx-music-studio/storage/tracks
sudo chmod 755 /opt/mmx-music-studio/storage/tracks
```

---

## 步骤 3：配置环境变量

从示例文件复制并编辑：

```bash
# 选择一种运行模式
sudo cp /opt/mmx-music-studio/.env.demo.example /etc/mmx-music-studio.env
# 或
sudo cp /opt/mmx-music-studio/.env.private-real.example /etc/mmx-music-studio.env
# 或
sudo cp /opt/mmx-music-studio/.env.production-locked.example /etc/mmx-music-studio.env

# 编辑
sudo vim /etc/mmx-music-studio.env
```

> **注意**：`/etc/mmx-music-studio.env` 包含敏感信息，确保权限正确：
> ```bash
> sudo chmod 600 /etc/mmx-music-studio.env
> sudo chown root:root /etc/mmx-music-studio.env
> ```

---

## 步骤 4：安装 systemd 服务

```bash
# 复制服务模板
sudo cp /opt/mmx-music-studio/deploy/mmx-music-studio.service.example \
   /etc/systemd/system/mmx-music-studio.service

# 编辑服务文件（调整 User/Group/路径）
sudo vim /etc/systemd/system/mmx-music-studio.service

# 重新加载 systemd
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable mmx-music-studio

# 启动服务
sudo systemctl start mmx-music-studio

# 检查状态
sudo systemctl status mmx-music-studio
```

---

## 步骤 5：验证部署

```bash
# 检查服务是否运行
sudo systemctl is-active mmx-music-studio

# 检查健康状态
curl -s http://localhost:8787/api/health | python3 -m json.tool

# 查看日志
sudo journalctl -u mmx-music-studio -f --no-pager
```

---

## 切换运行模式

### 查看当前模式

```bash
curl -s http://localhost:8787/api/health | grep -E 'realGenerationEnabled|backend|mockGenerationEnabled'
```

### 切换到 Demo Preview

```bash
sudo systemctl stop mmx-music-studio
sudo cp /opt/mmx-music-studio/.env.demo.example /etc/mmx-music-studio.env
# 编辑并填入真实值
sudo vim /etc/mmx-music-studio.env
sudo systemctl start mmx-music-studio
```

### 切换到 Private Real

```bash
sudo systemctl stop mmx-music-studio
sudo cp /opt/mmx-music-studio/.env.private-real.example /etc/mmx-music-studio.env
# 编辑并填入真实值（确保 mmx auth login）
sudo vim /etc/mmx-music-studio.env
sudo systemctl start mmx-music-studio
```

### 切换到 Production Locked

```bash
sudo systemctl stop mmx-music-studio
sudo cp /opt/mmx-music-studio/.env.production-locked.example /etc/mmx-music-studio.env
# 编辑并设置 PREVIEW_ACCESS_PIN
sudo vim /etc/mmx-music-studio.env
sudo systemctl start mmx-music-studio
```

---

## 常用命令

```bash
# 启动
sudo systemctl start mmx-music-studio

# 停止
sudo systemctl stop mmx-music-studio

# 重启
sudo systemctl restart mmx-music-studio

# 查看日志
sudo journalctl -u mmx-music-studio -f --no-pager

# 查看最近日志
sudo journalctl -u mmx-music-studio -n 50 --no-pager
```

---

## 安全建议

1. **不要以 root 运行服务**（已在模板中注释了 `User=mmx`）
2. **设置访问保护**（PREVIEW_ACCESS_PIN）防止公开访问
3. **不要在 `/etc/mmx-music-studio.env` 中暴露真实 key**（使用 server env 模式时 key 在环境变量中，单独管理）
4. **配置防火墙**：只开放必要端口（8787）
   ```bash
   sudo ufw allow 8787/tcp
   ```
5. **定期检查额度**：`mmx quota`

---

## 使用 PM2 替代 systemd（可选）

如果不想用 systemd，可用 PM2：

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动
cd /opt/mmx-music-studio
pm2 start npm --name "mmx-music-studio" -- start

# 保存 PM2 进程列表
pm2 save

# 设置开机自启
pm2 startup
```