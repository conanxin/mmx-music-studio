# 微信小程序问题排查

> Phase 3D 文档 · mmx-music-studio

---

## 1. 请求失败（request:fail）

**表现**：API 请求返回 `request:fail`，控制台报错。

**常见原因**：

| 原因 | 排查方法 | 解决方案 |
|------|----------|----------|
| 未关闭合法域名校验 | 微信开发者工具 → 详情 → 本地设置 | 勾选「不校验…HTTPS 证书」 |
| 使用 HTTP 裸 IP | 检查 config/api.ts 中 apiBase | 开发阶段关闭校验即可 |
| 手机网络无法访问服务器 | 用手机浏览器访问 `http://118.195.129.137:8787/api/health` | 检查服务器是否运行、安全组是否放行 8787 |
| 腾讯云安全组未开 8787 | 云控制台 → 安全组 → 入方向规则 | 添加 TCP 8787 端口允许 |
| 后端服务未运行 | `curl http://118.195.129.137:8787/api/health` | 重启 server: `npm run start` |
| 正式版未配置合法域名 | 微信公众平台 → 开发管理 → 开发设置 | 配置 request 合法域名（需 HTTPS） |

**快速验证**：
```bash
# 本地验证 server 是否可达
curl http://118.195.129.137:8787/api/health

# 验证 tracks 接口
curl http://118.195.129.137:8787/api/tracks
```

---

## 2. 音频播放失败

**表现**：点击试听后无声音，或报错。

**常见原因**：

| 原因 | 排查方法 | 解决方案 |
|------|----------|----------|
| audioUrl 是相对路径未拼接 apiBase | 检查 network 请求中 audioUrl | 代码已拼接 `window.location.origin + audioUrl`，确认 audioUrl 有 `/` 前缀 |
| HTTP 音频在真机受限 | 开发者工具 → 详情 → 本地设置 → 关闭校验 | 开发阶段关闭，正式版必须 HTTPS |
| Content-Type 不正确 | 响应头查看 `content-type: audio/mpeg` | 后端需正确返回 audio/mpeg |
| Range 请求不支持 | 微信 audio 组件需要支持 Range | 确认 server 支持 HTTP Range 请求 |
| track 文件不存在 | 检查 server storage/tracks/ 目录 | Mock 阶段不真实生成，无需检查 |
| 微信基础库版本过低 | 微信开发者工具 → 详情 → 基本库版本 | 升级基础库或使用兼容 API |

**Taro AudioAdapter 错误码**：

| 错误文案 | 含义 |
|----------|------|
| 网络连接失败 | 手机网络无法访问音频 URL |
| 音频加载超时 | 音频文件过大或网络慢 |
| 服务器内部错误 | 后端返回非 200 状态码 |

---

## 3. 下载失败

**表现**：点击下载后 toast 显示「保存失败」。

**常见原因**：

| 原因 | 排查方法 | 解决方案 |
|------|----------|----------|
| downloadFile 合法域名未配置 | 微信公众平台 → 开发设置 → downloadFile 合法域名 | 开发阶段关闭校验，正式版配置 |
| HTTP 域名限制 | 微信小程序不允许 download HTTP 文件 | 必须 HTTPS，或使用临时路径 fallback |
| 文件过大 | 检查文件体积 | Mock 阶段文件较小 |
| 存储空间不足 | 手机存储满 | 提示用户清理空间 |
| tempFilePath 过期 | 微信临时文件 24h 后清理 | 保存到永久路径需调用 wx.saveFile |

**Mock 阶段说明**：
- `/api/tracks/:id/download` 返回 HTTP 200
- 真机 downloadFile 仍受限（合法域名 + HTTPS）
- fallback 逻辑：saveFile 失败时提示「已下载到临时文件」

---

## 4. dist 导入失败

**表现**：导入项目后页面空白或报错。

**常见原因**：

| 原因 | 解决方案 |
|------|----------|
| 导入了 `apps/weapp/dist/` 而不是 `apps/weapp/` | 导入 `apps/weapp/` 目录 |
| Taro build 失败 | 运行 `npm run weapp:build`，检查报错 |
| project.config.json appid 配置问题 | 确认 appid 为 `touristappid` 或自己的 AppID |
| node_modules 缺失 | `npm install` 后再 build |
| 基础库版本不匹配 | 更新微信开发者工具 |

**正确导入**：
```
项目目录：/home/ubuntu/projects/mmx-music-studio/apps/weapp/
```

---

## 5. 页面空白

**表现**：编译成功但页面无内容。

**排查顺序**：

1. 检查「编译错误」面板是否有报错
2. 确认 `dist/app.json` 存在
3. 确认 `dist/pages/*/index.js` 全部生成
4. 检查微信开发者工具 Console 面板
5. 确认 Taro 版本兼容性

```bash
# 检查 dist 产物完整性
ls apps/weapp/dist/pages/
# 应有：home studio library settings docs

# 重新编译
cd apps/weapp && npm run weapp:build
```

---

## 6. iOS / Android 行为差异

| 功能 | iOS | Android |
|------|-----|---------|
| HTTP 请求 | 受限（同 Android）| 受限（开发阶段关闭校验）|
| 音频后台播放 | 有限制 | 较好支持 |
| 文件保存 | 需用户确认 | 自动保存到指定目录 |
| 微信版本 | 建议 8.0+ | 建议 8.0+ |
| 触达率 | - | 部分机型可能被系统省电策略限制 |

---

## 7. 后端 server 问题

**server 未运行**：
```bash
# 检查 server 进程
ps aux | grep "node" | grep server

# 重启 server
cd /home/ubuntu/projects/mmx-music-studio
npm run start
# 或
node server/index.js
```

**端口被占用**：
```bash
# 检查 8787 端口
lsof -i :8787

# kill 后重启
kill <PID>
npm run start
```

**安全组检查（腾讯云）**：
- 登录腾讯云控制台
- 找到对应 CVM 实例
- 安全组 → 入方向规则
- 添加：TCP 8787 端口，来源 0.0.0.0/0

---

## 8. 快速诊断流程

```
微信开发者工具 → 真机调试
  ↓
控制台 Network 面板
  ↓
检查 /api/* 请求
  ├─ 红色 → 域名校验问题 → 关闭「不校验」
  ├─ DNS failed → 网络不通 → 检查安全组
  └─ 200 → API 正常 → 检查返回数据
  ↓
Console 面板
  ↓
有 error → 查看错误文案 → 对照本文档
```

---

## 9. 获取帮助

若本文档无法解决你的问题：

1. 截图错误信息
2. 提供微信开发者工具 Console 输出
3. 提供 Network 面板请求详情
4. 检查 [WEAPP_REAL_DEVICE_CHECKLIST.md](./WEAPP_REAL_DEVICE_CHECKLIST.md)
5. 提交 Issue：https://github.com/conanxin/mmx-music-studio/issues
