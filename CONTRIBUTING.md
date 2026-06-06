# 贡献指南 / Contributing

感谢您对 mmx-music-studio 的兴趣！本文档帮助您了解项目结构、开发流程和安全要求。

## 开发环境

### 环境要求

- Node.js 22.x+
- npm 10.x+
- Git

### 本地开发

```bash
# 克隆（如果已有仓库则跳过）
git clone <repo-url>
cd mmx-music-studio

# 安装依赖
npm install

# 启动完整开发环境
npm run dev:full
```

### 项目结构

```
mmx-music-studio/
├── src/                     # Web 前端（React + TypeScript）
├── server/                  # API Server（TypeScript）
├── packages/                # 共享核心包
│   ├── core/               # 业务逻辑（平台无关）
│   ├── adapters/           # API 适配器（MiniMax API / CLI / Mock）
│   └── ui-tokens/          # UI 设计令牌
├── scripts/                 # 工具脚本
│   ├── release-check.sh    # 发布前检查（必跑）
│   ├── manifest-audit.ts   # manifest 审计
│   └── manifest-fix.ts     # manifest 修复
├── docs/                    # 项目文档
└── storage/tracks/          # 生成的音频（git 忽略）
```

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Web 开发服务器（Vite） |
| `npm run dev:server` | 启动 API Server（tsx） |
| `npm run dev:full` | 同时启动 Web + API Server |
| `npm run build` | 构建生产版本 |
| `npm run start` | 生产环境启动 API Server |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run manifest:audit` | 检查 manifest.json 一致性 |
| `npm run manifest:fix` | 修复 manifest 记录（dry-run） |
| `npm run release:check` | 完整发布前检查（必跑） |

## 安全要求

> ⚠️ **严格禁止**在代码、文档、commit 中包含以下内容：

### 绝对禁止

- ❌ 真实的 MiniMax API Key（`sk-...`）
- ❌ 真实的 Bearer Token / Authorization Header
- ❌ 真实的 `~/.mmx/config.json` 内容
- ❌ `~/.hermes/.env` 内容
- ❌ 生成的音频文件（`.mp3` / `.wav` / `.flac`）
- ❌ `.env` 文件（即使有占位符也不要 commit）

### 允许的内容

- ✅ `.env.example`（只含占位符 `<your_...key>`）
- ✅ 文档中的示例 key 格式（如 `sk-xxxxxxxx`）
- ✅ `MINIMAX_API_KEY` 环境变量名
- ✅ `sk-` 作为正则表达式或代码中的占位符

### 提交前必查

```bash
# 运行完整发布检查（包含 secret scan）
npm run release:check
```

如果检查失败，**不要** commit，直到问题修复。

### .gitignore 规则

以下文件类型已被 `.gitignore` 保护，不应出现在 git 中：

```
.env                    # 禁止提交
storage/tracks/*.mp3    # 禁止提交真实音频
storage/tracks/*.wav    # 禁止提交真实音频
node_modules/           # 禁止提交
dist/                   # 构建产物
```

## 分支管理

- `main` — 稳定分支，所有发布从这里出
- 功能开发在 feature 分支进行，合并前通过 `release:check`

## Pull Request 流程

1. Fork 仓库并创建功能分支
2. 开发并运行 `npm run release:check`
3. 确保所有检查通过
4. 提交 PR 并描述变更内容
5. 等待 code review

## 问题反馈

- 提交 GitHub Issue 请附上复现步骤
- 安全问题请通过私有渠道报告，不要在公开 Issue 中描述