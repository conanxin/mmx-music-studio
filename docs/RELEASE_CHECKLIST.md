# 发布检查清单 / Release Checklist

> 发布 GitHub 开源版本前，请逐项确认。

## 代码质量

- [ ] `npm run typecheck` 通过
- [ ] `npm run build` 通过
- [ ] 无 TypeScript 错误
- [ ] 无新增 lint 警告

## 测试

- [ ] `npm run manifest:audit` 通过（0 issues）
- [ ] `bash scripts/config-smoke-test.sh` PASS
- [ ] `bash scripts/server-smoke-test.sh` PASS
- [ ] `bash scripts/web-api-smoke-test.sh` PASS
- [ ] `bash scripts/cli-adapter-smoke-test.sh` PASS
- [ ] `bash scripts/verify-existing-cli-track.sh` PASS

## 敏感信息检查

- [ ] 无 `.env` 文件被提交
- [ ] `.gitignore` 包含 `.env` 和 `.env.*`
- [ ] `.gitignore` 包含 `storage/tracks/*`（但不删除 `.gitkeep`）
- [ ] `.env.example` 只包含占位符，无真实 key
- [ ] 无 API key / Bearer / Authorization / `sk-` 被提交（运行 secret scan）
- [ ] `~/.mmx/config.json` 未被读取或输出
- [ ] `~/.hermes/.env` 未被读取或输出
- [ ] `storage/tracks/` 中的真实 MP3 文件未提交

**Secret Scan 命令：**
```bash
grep -RInE "sk-[A-Za-z0-9_-]+|Bearer [A-Za-z0-9._-]+|Authorization:|MINIMAX_API_KEY=.[A-Za-z0-9]" . \
  --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=storage \
  --exclude="*.png" --exclude="*.zip" --exclude="*.mp3" --exclude="*.wav" || true
```

## 功能验证

- [ ] Mock 生成正常工作（`MINIMAX_BACKEND=mock`）
- [ ] Settings 页面可设置 key 并保存
- [ ] Studio 页面可发起 Mock 生成
- [ ] Library 页面可展示历史作品
- [ ] Download endpoint 返回正确 Content-Type 和 Content-Disposition
- [ ] Settings「生成后端」区域显示正确后端信息

## 文档完整性

- [ ] `README.md` 包含安装说明、启动命令、安全提示
- [ ] `docs/SECURITY.md` 存在并完整
- [ ] `docs/CLI-ADAPTER.md` 记录 CLI adapter 状态
- [ ] `docs/PHASE_2D_REAL_CLI_GENERATION_REPORT.md` 记录真实生成结果
- [ ] `LICENSE` 是 MIT License
- [ ] `package.json` 包含所有必要 scripts
- [ ] `scripts/manifest-audit.ts` 和 `scripts/manifest-fix.ts` 存在

## 发布包

- [ ] 截图已更新（真实 CLI 作品可见）
- [ ] `docs/mmx-music-studio-ui-review.zip` 已重新打包
- [ ] zip 中不包含 `.env`、真实 MP3 文件、node_modules

## 微信小程序准备

- [ ] `packages/core` 不依赖浏览器专有 API
- [ ] `packages/adapters` 中的 adapter 已抽离
- [ ] `docs/MINIPROGRAM-READY.md` 已存在

## Git 操作

- [ ] `git status --short` 无未跟踪的敏感文件
- [ ] 不自动 push，不自动创建 GitHub repo（除非用户明确要求）
