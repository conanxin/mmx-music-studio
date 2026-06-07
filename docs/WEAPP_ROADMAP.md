# 微信小程序开发路线图 / WeApp Roadmap

> 文档版本：Phase 3A · 2026-06-07

---

## 阶段总览

| 阶段 | 目标 | 依赖 | 状态 |
|------|------|------|------|
| Phase 3A | Taro 小程序 UI + Mock 原型 | Web 基线 | 🔄 当前 |
| Phase 3B | 接入自托管 server API (safe mock) | Phase 3A + server 运行 | 📋 |
| Phase 3C | 音频播放、下载、作品库 | Phase 3B | 📋 |
| Phase 3D | 微信开发者工具真机预览 | Phase 3C | 📋 |
| Phase 3E | HTTPS 域名 + 合法域名配置 | Phase 3D | 📋 |
| Phase 3F | 真实生成受控测试 | Phase 3E | 📋 |

---

## Phase 3A — Taro 小程序 UI + Mock 原型 ✅

**目标**：创建最小可用小程序 UI，不调用任何真实 API。

### 完成项

- [x] `apps/weapp` 目录结构
- [x] 页面：home / studio / library / settings / docs
- [x] 组件：AppShell / ModeTabs / WaveformPlayer / TrackCard / StatusBadge
- [x] 微信 adapter 占位：request / storage / audio / upload / download
- [x] Mock 数据：tracks.ts
- [x] 样式 tokens 与 Web 一致
- [x] 不调用真实生成
- [x] 不消耗额度

### 未完成项（Phase 3B 接入）

- [ ] 接入 `packages/core` 类型和校验
- [ ] 接入自托管 server API
- [ ] 真实音频播放
- [ ] 真实文件下载

---

## Phase 3B — 接入自托管 server API (safe mock)

**目标**：小程序通过 HTTPS 请求调用自托管 server，获取 safe mock 数据。

### 前置条件

1. 自托管 server 运行于 `http://localhost:8787`（开发）或 `https://your-domain.com`（生产）
2. 微信公众平台已配置 request 合法域名（生产环境）
3. `packages/core` 类型已验证可在 Taro 中引用

### 实现项

- [ ] `packages/adapters/weapp/request.ts` 配置 API base
- [ ] 接入 `/api/health` 获取后端状态
- [ ] 接入 `/api/tracks` 获取作品列表（safe mock 数据）
- [ ] 复用 `packages/core` 中的 `MusicMode` 类型
- [ ] 复用 `packages/core` 中的 `validateMusicInput` 校验
- [ ] workspace alias 配置或类型复制

### 安全要求

- API base 不得硬编码真实生产 IP
- Phase 3B 仅使用 server safe mock 模式（`MOCK_GENERATION_ENABLED=true`）
- 不触发 `REAL_GENERATION_ENABLED=true`

---

## Phase 3C — 音频播放、下载、作品库

**目标**：实现微信原生音频播放和文件下载功能。

### 实现项

- [ ] `audio.ts` 实现：`wx.createInnerAudioContext`
  - play / pause / stop / destroy
  - 进度更新事件
  - 播放完成回调
- [ ] `download.ts` 实现：`wx.downloadFile`
  - 下载音频到本地临时文件
  - 保存到相册（可选）
- [ ] `storage.ts` 实现：`wx.getStorageSync` / `wx.setStorageSync`
  - 保存用户偏好设置
  - **不保存真实 API Key**
- [ ] 作品库页面接入 `/api/tracks` 流式数据
- [ ] 播放进度与时间显示

### 限制

- 微信小程序单次音频文件不超过 20MB
- 下载保存需要用户授权

---

## Phase 3D — 微信开发者工具真机预览

**目标**：在微信开发者工具中打开并调试小程序。

### 实现项

- [ ] Taro build：`npm run weapp:build`
- [ ] 微信开发者工具导入 `apps/weapp/dist`
- [ ] 真机调试（手机微信扫码）
- [ ] 检查页面布局是否正常
- [ ] 检查音频播放是否正常
- [ ] 检查文件下载是否正常

### 已知问题

- 微信开发者工具需要配置项目路径为 `apps/weapp/dist`
- 需要在微信公众平台添加开发者权限
- iOS 真机可能与开发者工具表现不同

---

## Phase 3E — HTTPS 域名 + 合法域名配置

**目标**：完成微信小程序正式发布前的所有配置。

### 实现项

- [ ] 购买/配置 HTTPS 域名（推荐 Caddy 自动 HTTPS）
- [ ] 域名已备案（微信要求）
- [ ] 在微信公众平台配置 request 合法域名
  - `https://your-domain.com`（API base）
- [ ] 更新 `apps/weapp/config/prod.ts` 中的 API base
- [ ] 小程序版本提审前检查：
  - 所有 request 使用 HTTPS
  - 不存在 hardcoded IP
  - 不存在真实 API Key

### 安全要求

- **不要**在小程序代码中写入任何真实 API Key
- 真实生成必须通过后端代理
- 公网 HTTPS 服务需有用户鉴权或额度限制

---

## Phase 3F — 真实生成受控测试

**目标**：在受控环境下测试真实音乐生成。

### 实现项

- [ ] server 切换到 `MINIMAX_BACKEND=cli` + `REAL_GENERATION_ENABLED=true`
- [ ] 小程序调用 `/api/generate`（经后端代理）
- [ ] 进度轮询 `/api/tracks/:id`
- [ ] 生成完成后自动播放
- [ ] 用户鉴权（可选）
- [ ] 额度限制（可选）

### 警告

- Phase 3F 真实生成会消耗 MiniMax Token Plan 额度
- 建议只在受控测试环境启用
- 公共部署需要额外安全措施

---

## 关键里程碑

```
Phase 3A ✅  → Phase 3B 📋 → Phase 3C 📋 → Phase 3D 📋 → Phase 3E 📋 → Phase 3F 📋
小程序 UI     → 接入 server  → 音频+下载  → 真机调试   → HTTPS+备案  → 真实生成
Mock 原型     → safe mock    → 微信原生    → 微信工具    → 正式发布    → 受控测试
```

---

## 资源

- [Taro 官方文档](https://taro-docs.jd.com/)
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/)
- [微信公众平台](https://mp.weixin.qq.com/)