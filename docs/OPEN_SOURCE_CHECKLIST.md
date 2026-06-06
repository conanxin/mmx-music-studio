# 开源项目检查清单 / Open Source Checklist

> 本文档列出 mmx-music-studio 作为开源项目的完整性和最佳实践检查项。
> 在发布前运行 `npm run release:check` 验证所有项目。

---

## 必需文件

| 文件 | 说明 | 状态 |
|------|------|------|
| `LICENSE` | MIT License | ✅ |
| `README.md` | 项目介绍 + 快速开始 | ✅ |
| `SECURITY.md` | 安全设计文档 | ✅ |
| `.env.example` | 环境变量模板（占位符） | ✅ |
| `.gitignore` | 保护敏感文件和构建产物 | ✅ |
| `.dockerignore` | Docker 构建排除 | ✅ |
| `Dockerfile` | 多阶段构建镜像 | ✅ |
| `docker-compose.yml` | Docker Compose 部署配置 | ✅ |

---

## 代码质量

| 检查项 | 命令 | 状态 |
|--------|------|------|
| TypeScript 编译通过 | `npm run typecheck` | ✅ |
| Vite 构建成功 | `npm run build` | ✅ |
| 无 lint 错误 | — | ✅ |
| 所有 smoke tests 通过 | `npm run release:check` | ✅ |

---

## 安全检查

| 检查项 | 命令 | 状态 |
|--------|------|------|
| 无真实 API Key | `grep -r "sk-" --exclude="*.md" .` | ✅ |
| 无真实 Bearer Token | `grep -r "Bearer " --exclude="*.md" .` | ✅ |
| 无 Authorization Header 泄漏 | — | ✅ |
| `.env` 不在 git 中 | `git status --short \| grep "\.env$"` | ✅ |
| 真实音频文件不在 git 中 | `git status --short \| grep "storage/tracks/.*\.mp3"` | ✅ |
| `storage/tracks/` 在 .gitignore 中 | — | ✅ |
| `node_modules/` 在 .gitignore 中 | — | ✅ |
| `dist/` 在 .gitignore 中 | — | ✅ |
| release-check.sh 内置 secret scan | — | ✅ |

---

## 文档完整性

| 检查项 | 状态 |
|--------|------|
| README.md 包含 Quick Start | ✅ |
| README.md 包含 Docker 快速开始 | ✅ |
| README.md 包含后端模式说明 | ✅ |
| README.md 包含安全默认值说明 | ✅ |
| README.md 包含 Roadmap | ✅ |
| docs/DEPLOYMENT.md 存在 | ✅ |
| docs/SECURITY.md 存在 | ✅ |
| docs/PRODUCT.md 存在 | ✅ |
| docs/UI-SPEC.md 存在 | ✅ |
| docs/ARCHITECTURE.md 存在 | ✅ |
| docs/MINIPROGRAM-READY.md 存在 | ✅ |
| CONTRIBUTING.md 存在 | ✅ |
| CHANGELOG.md 存在 | ✅ |
| docs/release/RELEASE_NOTES_v0.1.0-alpha.md 存在 | ✅ |

---

## 项目结构

| 检查项 | 状态 |
|--------|------|
| Monorepo 结构（packages/） | ✅ |
| 平台无关核心包（packages/core） | ✅ |
| API 适配器（packages/adapters） | ✅ |
| UI 设计令牌（packages/ui-tokens） | ✅ |
| Web 前端（src/） | ✅ |
| API Server（server/） | ✅ |
| 工具脚本（scripts/） | ✅ |
| 微信小程序占位（apps/weapp/README.md） | ✅ |

---

## Docker 部署

| 检查项 | 状态 |
|--------|------|
| Dockerfile 多阶段构建 | ✅ |
| Dockerfile 默认安全模式 | ✅ |
| docker-compose.yml 安全模式默认配置 | ✅ |
| .dockerignore 排除敏感文件 | ✅ |
| Health check 配置 | ✅ |
| 非 root 用户运行 | ✅ |

---

## 发布流程

| 检查项 | 命令 | 状态 |
|--------|------|------|
| release:check 脚本存在 | `npm run release:check` | ✅ |
| manifest-audit.ts 存在 | `npm run manifest:audit` | ✅ |
| manifest-fix.ts 存在 | `npm run manifest:fix` | ✅ |
| 所有 smoke tests 存在 | — | ✅ |
| 无阻塞性 lint 错误 | — | ✅ |

---

## 截图和资产

| 检查项 | 状态 |
|--------|------|
| 至少 5 张 UI 截图 | ✅ |
| 包含移动端截图 | ✅ |
| 包含桌面端截图 | ✅ |
| Contact sheet 生成 | ✅ |
| 截图打包 ZIP | ✅ |

---

## 合规性

| 检查项 | 状态 |
|--------|------|
| LICENSE 为 MIT | ✅ |
| 无真实 API Key | ✅ |
| 无真实用户数据 | ✅ |
| 非官方声明（README + Release Notes） | ✅ |
| 禁止日志打印 Key（security.ts） | ✅ |

---

## 运行完整检查

```bash
# 一次性运行所有检查
npm run release:check

# 预期输出：✅ RELEASE CHECK: PASS
```

---

## 手动验证（可选）

```bash
# 检查 .env 不在 git
git status --short | grep "^\.env$"

# 检查 storage/tracks 无音频
git status --short storage/tracks/

# 检查 node_modules 不在 git
git status --short | grep "^node_modules/"

# 检查 dist 不在 git（除非有意提交）
git status --short | grep "^dist/"
```

---

## 常见问题

### Q: .env.example 是否算泄露？
**A**: 否。`.env.example` 只含占位符 `<your_...key>`，不含真实内容。

### Q: 文档中的 `sk-xxx` 是否算泄露？
**A**: 否。这是格式说明，不是真实 key。

### Q: storage/tracks/ 下已有音频文件怎么办？
**A**: 确认 `.gitignore` 正确配置，`git status` 中不应出现音频文件。如果已被 git 跟踪，使用 `git rm --cached <file>` 取消跟踪。

### Q: dist/ 是否应该提交到 git？
**A**: 默认不应提交。生产部署应从源码构建。使用 `.gitignore` 排除。如果需要提交预构建产物，请在 README 中明确说明。