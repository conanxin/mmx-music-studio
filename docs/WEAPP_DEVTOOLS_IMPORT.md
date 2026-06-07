# 微信开发者工具导入指南

> Phase 3D 文档 · mmx-music-studio
> 本阶段仍为 Server Mock，不真实生成，不消耗额度。

---

## 导入路径

**导入目录：`/home/ubuntu/projects/mmx-music-studio/apps/weapp/`**

> ⚠️ 注意：不是 `apps/weapp/dist/`！
> 源目录 `apps/weapp/project.config.json` 已配置 `"miniprogramRoot": "./dist/"`，
> 微信开发者工具会自动读取 `miniprogramRoot` 并找到编译产物。

---

## 导入步骤

### 1. 安装微信开发者工具

下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

稳定版即可，无需最新版。

### 2. 导入项目

1. 打开微信开发者工具
2. 点击左侧「导入项目」
3. **项目目录**填入：
   ```
   /home/ubuntu/projects/mmx-music-studio/apps/weapp
   ```
   （或本地 clone 后的对应路径）
4. **AppID**：
   - 无 AppID → 选择 **测试号**（会自动分配 `touristappid`）
   - 有自己的小程序 AppID → 填入自己的 AppID
5. **项目名称**：`mmx-music-studio`（自动填充）
6. 点击「确认」

### 3. 开发阶段设置（重要）

首次导入后，在「详情 → 本地设置」中确认：

- ✅ **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**
  - 当前 API Base：`http://118.195.129.137:8787`（HTTP IP，非正式域名）
  - 开发阶段必须勾选此选项，否则真机/模拟器请求会失败

### 4. 编译运行

- 点击「编译」或「真机调试」
- 模拟器/真机即可预览小程序

---

## 文件结构说明

```
apps/weapp/                          ← 导入此目录
├── project.config.json              ← miniprogramRoot: "./dist/"
├── dist/                            ← Taro 编译产物（自动生成）
│   ├── app.js / app.json / app.wxss
│   └── pages/
│       ├── home/
│       ├── studio/
│       ├── library/
│       ├── settings/
│       └── docs/
└── src/                             ← 源代码
```

---

## API Base 配置

当前 Server Mock API Base：

```
http://118.195.129.137:8787
```

在「设置」页面可查看和修改 API Base。

> 开发阶段：不校验合法域名 → HTTP IP 可用
> 正式发布：必须在微信公众平台配置 HTTPS 域名

---

## 编译命令

在 `apps/weapp/` 目录执行：

```bash
# 开发编译（watch 模式）
npm run weapp:dev

# 生产编译（生成 dist/）
npm run weapp:build

# 类型检查
npm run weapp:typecheck

# 打包 dist 为 zip（不含 node_modules）
bash scripts/package-weapp-dist.sh
```

---

## 正式发布要求

| 要求 | 说明 |
|------|------|
| HTTPS | 必须使用 HTTPS 域名 |
| request 合法域名 | 需在微信公众平台配置 `https://your-domain.com` |
| downloadFile 合法域名 | 同上，需配置音频域名 |
| 关闭 HTTP IP | 正式版不允许使用裸 IP HTTP |
| AppID | 必须使用真实小程序 AppID，不能用测试号 |

---

## 常见问题

### 导入后页面空白

1. 确认导入的是 `apps/weapp/` 而不是 `apps/weapp/dist/`
2. 运行 `npm run weapp:build` 生成 `dist/`
3. 检查「编译错误」面板

### 请求失败（request:fail）

- 确认「详情 → 本地设置」中勾选了「不校验…HTTPS 证书」
- 确认手机和电脑在同一网络
- 确认 server 正在运行：`curl http://118.195.129.137:8787/api/health`

### 音频播放失败

- 真机音频必须 HTTPS（开发阶段关闭校验即可）
- 确认 audioUrl 为完整 URL
- 微信基础库版本过低可能不支持某些 API

详见：[WEAPP_TROUBLESHOOTING.md](./WEAPP_TROUBLESHOOTING.md)
