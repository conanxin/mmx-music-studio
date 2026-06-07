# 运行模式 / Runtime Modes

mmx-music-studio 支持三种运行模式，分别对应不同的使用场景和安全级别。

---

## 模式总览

| 模式 | 真实生成 | 额度消耗 | 公开部署 | 访问保护 | 适用场景 |
|------|----------|----------|----------|----------|----------|
| **Demo Preview** | ❌ | ❌ | ✅ 可公开 | 可选 | 公开演示、给别人看 UI |
| **Private Real** | ✅ | ✅ | ❌ 不建议 | 建议 | 个人自用真实生成 |
| **Production Locked** | ❌ | ❌ | ✅ 可公开 | ✅ 必需 | 公网正式发布前的受保护状态 |

---

## 1. Demo Preview（安全预览模式）

### 用途
- 公开公网预览，给别人演示 UI
- 安全开发，不消耗额度
- 任何人访问都可看到完整的生成流程演示

### 环境变量

```bash
# 核心配置
REAL_GENERATION_ENABLED=false
MOCK_GENERATION_ENABLED=true
MINIMAX_BACKEND=mock

# 可选保护层
PREVIEW_ACCESS_ENABLED=false   # 不需要 PIN 保护（完全公开）
PUBLIC_DEMO_MODE=true

# 服务器
HOST=0.0.0.0
PORT=8787
MUSIC_OUTPUT_DIR=./storage/tracks
MINIMAX_REGION=cn
```

### 启动脚本

```bash
bash scripts/run-demo-preview.sh
# 或手动
npm run start
```

### UI 显示

- **创作页状态栏**：`安全预览` + `本地模拟` + `中国区`
- **设置页**：`运行模式: 安全预览` / `后端: 本地模拟` / `真实生成: 关闭`

### 特点

- 不调用 MiniMax API
- 不消耗 Token Plan 额度
- 任何人可访问（除非开启 PREVIEW_ACCESS_PIN）
- 适合 Docker one-liner 部署

---

## 2. Private Real（私有真实生成）

### 用途
- 个人自用，在服务器上真实生成音乐
- 消耗 Token Plan 额度
- 不建议公开给所有人裸奔使用

### 环境变量

```bash
# 核心配置
REAL_GENERATION_ENABLED=true
MOCK_GENERATION_ENABLED=false
MINIMAX_BACKEND=cli

# 服务器
HOST=0.0.0.0
PORT=8787
MUSIC_OUTPUT_DIR=./storage/tracks
MINIMAX_REGION=cn
```

### 前置条件

```bash
# 1. 服务器已安装 mmx CLI
mmx --version

# 2. 已登录（cn 或 global）
mmx auth login --recommend --region=cn

# 3. 确认额度充足
mmx quota
```

### 启动脚本

```bash
bash scripts/run-private-real.sh
```

启动前脚本会自动检查：
- `mmx --version` 是否可用
- `mmx auth status` 是否已登录
- `mmx quota` 是否有额度

如果任何一项异常，脚本会停止并提示，不会触发真实生成。

### UI 显示

- **创作页状态栏**：`真实生成` + `MMX CLI` + `⚠️ 会消耗额度` + `中国区`
- **设置页**：`运行模式: 真实生成` / `后端: MMX CLI` / `真实生成: 开启`

### 特点

- 真实调用 MiniMax mmx CLI
- 消耗 Token Plan 额度
- 建议配合 PREVIEW_ACCESS_PIN 或 VPN 限制访问
- **警告**：不要在不限制访问的公网 IP 上裸奔

---

## 3. Production Locked（生产锁定模式）

### 用途
- 面向公网的正式发布准备阶段
- 开启访问保护（PIN 或后续多用户鉴权）
- 真实生成功能被锁定，等待安全措施就绪

### 环境变量

```bash
# 核心配置
REAL_GENERATION_ENABLED=false
MOCK_GENERATION_ENABLED=true
MINIMAX_BACKEND=mock

# 访问保护（必需）
PREVIEW_ACCESS_ENABLED=true
PREVIEW_ACCESS_PIN=<your_preview_pin>

# 服务器
HOST=0.0.0.0
PORT=8787
MUSIC_OUTPUT_DIR=./storage/tracks
MINIMAX_REGION=cn
```

### 启动脚本

```bash
bash scripts/run-production-locked.sh
```

脚本会验证 `PREVIEW_ACCESS_PIN` 是否已设置，否则拒绝启动。

### UI 显示

- **创作页状态栏**：`访问保护` + `本地模拟` + `中国区`
- **设置页**：`运行模式: 访问保护` / `后端: 本地模拟` / `真实生成: 关闭`

### 上线真实生成前必须完成

- [ ] 登录鉴权（多用户账号体系）
- [ ] 速率限制（防止恶意刷接口）
- [ ] 额度限制（每个用户额度上限）
- [ ] 生成任务队列（后台异步处理）
- [ ] 日志脱敏（不打印 Authorization header）
- [ ] 管理后台（查看用户、额度、生成记录）
- [ ] HTTPS 域名（微信小程序必须）

---

## 模式切换

### 查看当前模式

```bash
# 查看服务器健康状态（含运行模式）
curl -s http://localhost:8787/api/health | python3 -m json.tool
```

健康响应中的关键字段：

```json
{
  "safePreviewMode": true,
  "previewAccessEnabled": false,
  "realGenerationEnabled": false,
  "mockGenerationEnabled": true,
  "backend": "mock",
  "cliAvailable": true,
  "cliAuthenticated": true
}
```

### 切换模式步骤

1. 停止服务
2. 修改 `/etc/mmx-music-studio.env` 中的环境变量
3. 重新启动服务
4. 访问 `/api/health` 验证

```bash
# 示例：切换到 Private Real
sudo systemctl stop mmx-music-studio
sudo cp /path/to/env.private-real.example /etc/mmx-music-studio.env
sudo systemctl start mmx-music-studio
curl -s http://localhost:8787/api/health | grep realGenerationEnabled
```

---

## 环境变量文件参考

| 文件 | 对应模式 |
|------|----------|
| `.env.demo.example` | Demo Preview |
| `.env.private-real.example` | Private Real |
| `.env.production-locked.example` | Production Locked |
| `.env.example` | 默认（安全模式） |

---

## deriveRuntimeMode 逻辑

UI 层使用以下逻辑判断当前运行模式（见 `src/features/studio/Studio.tsx`）：

```typescript
function deriveRuntimeMode(health: HealthInfo): string {
  if (health.previewAccessEnabled) return '访问保护';
  if (health.realGenerationEnabled && health.backend === 'cli') return '真实生成';
  if (health.realGenerationEnabled && health.backend === 'api') return 'API 实验';
  if (!health.realGenerationEnabled && health.backend === 'mock' && health.mockGenerationEnabled) return '安全预览';
  return '自定义';
}
```

| 条件 | 显示 |
|------|------|
| `previewAccessEnabled=true` | 访问保护 |
| `realGenerationEnabled=true && backend=cli` | 真实生成 |
| `realGenerationEnabled=true && backend=api` | API 实验 |
| `realGenerationEnabled=false && backend=mock && mockGenerationEnabled=true` | 安全预览 |
| 其他 | 自定义 |