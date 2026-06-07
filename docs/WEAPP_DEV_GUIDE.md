# 微信小程序开发指南 / WeApp Dev Guide

> 文档版本：Phase 3A · 2026-06-07

---

## 前置要求

- Node.js 18+
- npm 9+
- 微信开发者工具（[下载地址](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)）
- 已安装 Taro CLI：`npm install -g @tarojs/cli`

---

## 快速开始

### 1. 安装依赖

```bash
cd apps/weapp
npm install
```

### 2. 开发模式（Taro dev）

```bash
# 方式 1：从项目根目录
npm run weapp:dev

# 方式 2：从 apps/weapp 目录
cd apps/weapp
npm run dev:weapp
```

这会：
- 启动 Taro dev server（监听端口）
- 编译 `apps/weapp/src` → `apps/weapp/dist`
- 微信开发者工具可打开 `apps/weapp/dist` 目录

### 3. 在微信开发者工具中打开

1. 打开微信开发者工具
2. 点击「导入项目」
3. 项目路径：`/path/to/mmx-music-studio/apps/weapp/dist`
4. AppID：可使用测试号（点击「导入」时选择无 AppID）
5. 点击「确定」

### 4. 查看效果

- 微信开发者工具左侧显示模拟器（手机界面）
- 点击顶部「编译」可刷新
- 点击「预览」可扫码在真机查看

---

## 目录结构

```
apps/weapp/
├── package.json          # 依赖（taro, react, typescript）
├── project.config.json   # 微信开发者工具配置
├── config/               # Taro 构建配置
│   ├── index.ts          # 通用配置（路径别名、css 模块等）
│   ├── dev.ts            # 开发配置（API base 等）
│   └── prod.ts          # 生产配置
└── src/
    ├── app.config.ts     # 小程序页面路由、全局配置
    ├── app.tsx           # 小程序入口
    ├── pages/            # 页面
    │   ├── home/
    │   ├── studio/
    │   ├── library/
    │   ├── settings/
    │   └── docs/
    ├── components/       # 通用组件
    ├── adapters/         # 微信 API 适配层
    ├── mock/             # Mock 数据
    └── styles/           # 样式 token
```

---

## 构建命令

| 命令 | 说明 |
|------|------|
| `npm run dev:weapp` | 开发模式（热重载） |
| `npm run build:weapp` | 生产构建 |
| `npm run typecheck` | TypeScript 类型检查 |

从根目录执行：
```bash
npm run weapp:dev      # 开发
npm run weapp:build    # 生产构建
npm run weapp:typecheck # 类型检查
```

---

## API Base 配置

### 开发阶段（HTTP IP 调试）

```typescript
// apps/weapp/config/dev.ts
export default {
  apiBase: 'http://localhost:8787',  // 开发机器本地 server
}
```

在微信开发者工具中：
- 点击「详情」→「本地调试」
- 勾选「不校验合法域名…」和「不校验 HTTPS 证书」

### 生产阶段（HTTPS）

```typescript
// apps/weapp/config/prod.ts
export default {
  apiBase: 'https://your-domain.com',  // 需在微信公众平台配置
}
```

### 动态配置（运行时）

```typescript
// apps/weapp/src/adapters/request.ts
let apiBase = 'https://your-domain.example'  // 默认占位符

export const setApiBase = (base: string) => {
  apiBase = base
  wx.setStorageSync('api_base', base)
}

export const getApiBase = (): string => {
  return wx.getStorageSync('api_base') || apiBase
}

export const requestJson = async <T>(
  path: string,
  options?: RequestOptions
): Promise<T> => {
  const base = getApiBase()
  // ... 请求逻辑
}
```

---

## Mock 模式说明

Phase 3A 为纯 Mock 实现：

```typescript
// apps/weapp/src/adapters/request.ts
export const requestJson = async <T>(
  path: string,
  options?: RequestOptions
): Promise<T> => {
  // Phase 3A: 不真实请求，直接返回 mock
  if (!getApiBase() || getApiBase() === 'https://your-domain.example') {
    return mockRequest<T>(path, options)
  }
  // Phase 3B+: 真实请求
  return realRequest<T>(path, options)
}
```

---

## 切换到真实 Server API（Phase 3B）

Phase 3B 接入自托管 server 时：

1. 确保 server 运行：`cd /path/to/mmx-music-studio && npm run start`
2. 更新 `apps/weapp/config/dev.ts`：
   ```typescript
   apiBase: 'http://localhost:8787'
   ```
3. 在微信开发者工具中勾选「不校验合法域名」
4. 测试 `/api/health` 是否正常返回

---

## 样式规范

与 Web 版保持一致，使用 SCSS token：

```scss
// 使用 CSS 变量（token）
background-color: var(--color-bg);      // #090A0C
color: var(--color-text-primary);        // #F4F1EA
accent-color: var(--color-accent);       // #B8FF6A

// 移动端优先
.page {
  padding: var(--space-4);
}

// 触控友好
.actionBtn {
  min-height: 44px;
  min-width: 44px;
}
```

---

## 微信开发者工具调试技巧

### 查看网络请求

1. 打开微信开发者工具
2. 点击「Network」面板
3. 操作小程序，查看请求

### 查看 Storage

1. 打开微信开发者工具
2. 点击「Storage」面板
3. 查看 `wx.getStorageSync` 数据

### 跳过域名检查（开发阶段）

1. 点击「详情」
2. 勾选「本地调试」
3. 勾选「不校验合法域名…」和「不校验 HTTPS 证书」

### 真机调试

1. 点击「预览」
2. 用手机微信扫码
3. 在手机端打开调试（微信内点击「...」→「调试」）

---

## 常见问题

### Q: Taro dev 卡住不动

```bash
# 重启
pkill -f "taro"
cd apps/weapp && npm run dev:weapp
```

### Q: 微信开发者工具显示空白

1. 检查 `apps/weapp/dist` 目录是否生成
2. 点击「编译」按钮强制刷新
3. 检查控制台是否有报错

### Q: 页面不更新

```bash
# 清理缓存，重新构建
cd apps/weapp
rm -rf dist
npm run dev:weapp
```

### Q: 无法导入 `packages/core`

Phase 3A 暂不引用 `packages/core`。Phase 3B 会通过以下方式之一解决：
1. workspace alias 配置
2. 将类型复制到 `apps/weapp/src/types.ts`

---

## 后续步骤

| 阶段 | 操作 |
|------|------|
| Phase 3B | 接入 server API（mock 模式） |
| Phase 3C | 实现音频播放和下载 |
| Phase 3D | 微信开发者工具真机调试 |
| Phase 3E | 配置 HTTPS + 合法域名 |
| Phase 3F | 真实生成受控测试 |

---

## 相关文档

- `docs/WEAPP_ARCHITECTURE.md` — 架构说明
- `docs/WEAPP_ROADMAP.md` — 开发路线图
- `docs/WEAPP_SECURITY.md` — 安全规范
- `docs/DEPLOYMENT.md` — Server 部署指南