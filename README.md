# MiniMax 音乐创作台 / mmx-music-studio

**开源、自托管、BYOK 的 MiniMax 音乐生成网站**

> ⚠️ **免责声明**：这是一个非官方的开源项目，与 MiniMax 无任何关联。

## 项目目标

打造一个简约、有设计感、中文界面的音乐创作工具，让用户通过自己的 MiniMax Token Plan Key 生成音乐、在线试听、下载 MP3、管理历史作品。

## 功能规划

- 🎵 **纯音乐 / BGM** — 文字描述生成背景音乐
- 🎤 **自动写歌词并生成歌曲** — 输入主题，自动写词+作曲
- ✍️ **歌词成歌** — 提供自己的歌词，生成完整歌曲
- 🔄 **参考音频 Cover / 改编** — 上传参考音频进行风格改编
- ▶️ **在线试听** — 波形播放器，无需下载即可播放
- 💾 **下载 MP3** — 一键保存高质量 MP3 文件
- 📚 **作品库** — 历史作品管理，随时回听

## 当前状态

| 模块 | 状态 |
|------|------|
| UI | ✅ PASS |
| Mock generation | ✅ PASS |
| MMX CLI adapter | ✅ PASS |
| MMX CLI 真实生成 | ✅ PASS（Phase 2D-B，2次instrumental）|
| MMX API adapter | 🔧 实验性 |
| API 真实生成 | 🔧 待 Phase 3 完善 |
| 微信小程序 | 📋 规划中 |

## 当前阶段

**Phase 2D.1 + 2D-B：CLI 真实生成链路完成** ✅

- ✅ 真实 CLI 生成成功 2 次（7.3MB + 6.2MB MP3）
- ✅ `generationSource: "mmx-cli"` 返回正确
- ✅ Download endpoint HTTP 200，Content-Length 正确
- ✅ EISDIR 修复：`--out <file>` 而非 `--out <dir>`
- ✅ Proxy bypass 修复：清空 ALL_PROXY/all_proxy 等代理变量
- ✅ track id 与文件名一致性：server 生成 `${id}.mp3`，CLI adapter 直接输出
- ✅ manifest 一致性：`manifest:audit` 0 issues
- ✅ `manifest:audit` + `manifest:fix` 工具完成
- ✅ `verify-existing-cli-track.sh` 验证现有 mmx-cli 作品可播放/可下载
- ✅ Settings「生成后端」区域显示 CLI 状态
- ✅ 前端 `mmx-cli` 标签支持（Studio + Library）
- ✅ CLI adapter smoke test 通过

**Phase 2E：收口与开源发布准备** — 进行中

- ✅ manifest 一致性修复
- ✅ `manifest:audit` + `manifest:fix` 脚本
- ✅ 文档更新
- ⏳ 截图 + 打包

参见 [docs/CLI-ADAPTER.md](docs/CLI-ADAPTER.md) |
[docs/PHASE_2D_REAL_CLI_GENERATION_REPORT.md](docs/PHASE_2D_REAL_CLI_GENERATION_REPORT.md)

## 技术栈

- React 18 + TypeScript
- Vite 5
- React Router v6
- CSS Modules / Vanilla CSS（无 Tailwind，无复杂依赖）

## 快速启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build
```

本地访问地址：http://localhost:5174

## 界面预览

本阶段为静态 UI 原型，截图均为 Mock 页面，不调用真实 API，不包含任何真实密钥。

| 资源 | 路径 |
|------|------|
| 设计评审页（HTML） | `docs/screenshots/review.html` |
| 截图拼贴总览图 | `docs/screenshots/contact-sheet.png` |
| 截图源文件 | `docs/screenshots/*.png` |
| 设计评审打包 | `docs/mmx-music-studio-ui-review.zip` |

> ⚠️ 截图为 Mock UI，不调用真实 MiniMax API。真实 API 接入将在后续阶段完成。

## 项目结构

```
mmx-music-studio/
├── apps/
│   └── web/              # Web 前端应用
├── packages/
│   ├── core/             # 平台无关核心逻辑
│   ├── adapters/         # 平台适配器（storage/audio/api）
│   └── ui-tokens/        # 设计令牌
├── docs/                 # 项目文档
├── storage/              # 本地存储（作品文件）
└── README.md
```

## 微信小程序准备

项目从第一天起就考虑了微信小程序迁移：

- 业务逻辑全在 `packages/core`（平台无关）
- API 调用通过 `packages/adapters` 适配
- UI 组件小程序端用 Taro / uni-app 接入
- 不依赖浏览器专有 API

详见 [docs/MINIPROGRAM-READY.md](./docs/MINIPROGRAM-READY.md)

## 安全原则

### 开发模式（默认）

默认 `REAL_GENERATION_ENABLED=false`，即使配置了 `MINIMAX_API_KEY` 也不会调用真实 MiniMax API，而是使用本地 Mock 生成（sine wave WAV 文件）。所有 smoke test 均在此模式下运行，**不消耗额度**。

### 真实生成模式

需要显式开启：

```bash
REAL_GENERATION_ENABLED=true
MINIMAX_BACKEND=cli   # 推荐：使用 mmx CLI（需先 mmx auth login）
# 或
MINIMAX_BACKEND=api   # 实验性：直接调用 MiniMax API（Phase 2C 发现服务可能返回错误）
PUBLIC_DEMO_MODE=false
MINIMAX_API_KEY=***
```

CLI Adapter 推荐原因：不通过 HTTP 直连 MiniMax，由 mmx CLI 管理认证和请求。

详见 [docs/SECURITY.md](./docs/SECURITY.md)

## 开源协议

MIT License

---

**Unofficial open-source project. Not affiliated with MiniMax.**