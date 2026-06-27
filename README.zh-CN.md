# mmx-music-studio 中文说明

English README: [README.md](README.md)

## 项目是什么

mmx-music-studio 是一个自托管的 MiniMax AI 音乐生成 demo。

当前项目主打 **Public Lite BYOK** 模式：用户使用自己的 MiniMax API Key，在网页里输入音乐描述，提交后由服务器排队执行生成任务。生成完成后，可以在页面中播放、下载 MP3，并在作品库中查看。

这是一个非官方开源项目，与 MiniMax 官方无关联。

## 当前版本

当前版本：**v0.5.0-public-lite-byok**

当前状态：

- 5 人内轻量公开 BYOK 排队生成版已上线。
- 真实 BYOK 生成闭环已完成。
- Demo Ready Pack 已上线。
- Launch Share Pack 已完成。
- GitHub Release 已发布：`v0.5.0-public-lite-byok`。

发布说明：

- [v0.5.0 Public Lite BYOK release note](docs/launch/V0_5_0_PUBLIC_LITE_BYOK_RELEASE.md)
- [分享文案](docs/launch/SHARE_COPY_PUBLIC_LITE_BYOK.md)
- [试用反馈清单](docs/launch/FEEDBACK_CHECKLIST_PUBLIC_LITE_BYOK.md)

## 在线地址

- 首页：https://music.conanxin.com/
- 创作页：https://music.conanxin.com/studio

## 如何使用

1. 打开 Studio：https://music.conanxin.com/studio
2. 选择一个模板，或自己输入音乐描述。
3. 选择生成模式和模型。
4. 填写你自己的 MiniMax API Key。
5. 按页面提示完成 Turnstile 验证。
6. 点击“生成音乐”。
7. 等待队列执行完成。
8. 生成完成后播放、下载 MP3，或在作品库中查看。

## BYOK 是什么

BYOK 是 “Bring Your Own Key” 的缩写。

在这个项目里，它表示：

- 用户使用自己的 MiniMax API Key。
- 网站不提供共享的服务器端 MiniMax Key。
- 生成任务会用用户提交的 Key 执行本次排队任务。
- Key 只在服务器内存中临时存在，任务完成、失败、取消或过期后删除。

## API Key 是否保存

本站不保存 API Key。

当前设计边界：

- 不写入磁盘。
- 不写入浏览器 localStorage / sessionStorage。
- 不写入作品库。
- 不写入 manifest。
- 不写入日志。
- 不写入 Git。
- 只在本次排队任务期间临时保存在服务器内存中。

## 费用由谁承担

- MiniMax 生成费用：由用户自己的 MiniMax API Key / MiniMax 账号承担。
- 服务器运行费用：由站点维护者承担。

## 5 人内轻量公开模式

当前线上 demo 是小范围公开试用，不是大规模 public launch。

限制：

- 最多 5 个活跃用户。
- 超过 5 个活跃用户时，生成会暂时暂停。
- 页面和作品库仍可浏览。
- 不提供公开注册。
- 不提供账号系统。
- 不提供管理后台。
- 不做 5 路并发生成。

## 生成任务如何执行

生成任务通过队列执行。

当前线上行为：

- `jobQueue concurrency=1`
- 同一时间只执行一个生成任务。
- 后续任务排队等待。
- 生成完成后可以播放、下载并在作品库查看。

## 本地运行

安装依赖：

```bash
npm install
```

启动完整本地开发环境：

```bash
npm run dev:full
```

本地地址：

- Web：http://localhost:5174
- API：http://localhost:8787

Windows / Codex Desktop 可使用双终端方式：

```bash
# 终端 1
npm run dev:server

# 终端 2
npm run dev
```

## Docker 运行

```bash
docker compose up -d
```

启动后访问：

```text
http://localhost:8787
```

## 常用验证命令

```bash
npm run typecheck
npm run typecheck:server
npm run build
npm run release:check
git diff --check
```

`release:check` 会执行 BYOK 安全边界、Public Lite、manifest audit、secret scan 等发布前检查。

## 项目结构

```text
src/                  前端应用
src/features/studio/  Studio 创作流程
src/features/library/ 作品库、播放和下载
server/               API、队列、存储、BYOK helper
scripts/              smoke test、release check、部署辅助脚本
docs/                 launch、deploy、release、archive 文档
storage/              运行态 track / guard 数据，不用于保存 secret
```

## 免责声明

本项目是非官方开源项目，与 MiniMax 官方无关联。

使用者需要自行准备并管理自己的 MiniMax API Key。请不要把 API Key 提交到 Git、截图、日志、聊天记录或公开页面中。

当前版本适合自用、demo、小范围试用和反馈收集，不是面向大规模用户的正式公开发布。
