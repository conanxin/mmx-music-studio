# UI 截图总览

> 本目录包含 mmx-music-studio UI 原型的设计评审截图。
> 所有截图均为静态 Mock UI 页面，不包含真实 API 调用，不包含任何真实密钥。

## 截图文件

| 文件名 | 说明 | 尺寸 |
|--------|------|------|
| `home-desktop.png` | 首页桌面端（1440×1000） | 67KB |
| `home-mobile.png` | 首页手机端（390×844） | 55KB |
| `studio-desktop.png` | 创作台桌面端（1440×1000） | 68KB |
| `studio-mobile.png` | 创作台手机端（390×844） | 44KB |
| `library-mobile.png` | 作品库手机端（390×844） | 36KB |
| `settings-mobile.png` | 设置页手机端（390×844） | 48KB |
| `docs-mobile.png` | 开源说明页手机端（390×844） | 81KB |
| `contact-sheet.png` | 截图拼贴总览图（自动生成） | 自动 |

## 评审页

- `review.html` — 可直接在浏览器中打开的设计评审页，分区展示所有截图

## 设计评审包

- `../mmx-music-studio-ui-review.zip` — 包含以上所有截图 + 设计文档的压缩包

## 说明

本阶段（Phase 1.x）仅为 UI 原型展示：

- 不调用真实 MiniMax API
- 不读取、不输出、不保存任何真实 API key、token、secret
- 不访问 `~/.mmx/config.json`
- 不访问 `~/.hermes/.env`
- 所有 Key 相关内容使用占位符 `<MINIMAX_API_KEY>`
