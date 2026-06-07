/**
 * apps/weapp/src/config/api.ts
 * 微信小程序 API 配置适配层
 *
 * 微信开发者工具调试 HTTP IP 时：
 * → 开发者工具 →详情 → 本地调试 → 勾选"不校验合法域名、web-view、TLS 版本以及 HTTPS 证书"
 *
 * 正式小程序必须使用 HTTPS 域名，并在微信公众平台配置 request 合法域名。
 * 推荐后续通过自托管后端代理调用 MiniMax，不在小程序端直接暴露 key。
 */

import { getItem, setItem, removeItem } from '../adapters/storage';

//⚠️ 开发默认：HTTP IP + 微信开发者工具关闭合法域名校验
// 开发者工具调试阶段使用此地址
export const DEFAULT_API_BASE = 'http://118.195.129.137:8787';

//⚠️ 生产占位符：用户提供域名后替换此值
// 正式小程序必须使用 HTTPS 域名，并在微信公众平台配置合法域名
export const PRODUCTION_API_BASE_PLACEHOLDER = 'https://music.yourdomain.com';
export const API_BASE_KEY = 'mmx_api_base';

/** 从本地存储读取用户配置的 API Base */
export function getApiBaseFromConfig(): string {
  return getItem(API_BASE_KEY) ?? '';
}

/** 保存用户配置的 API Base */
export function setApiBaseToConfig(apiBase: string): void {
  setItem(API_BASE_KEY, apiBase);
}

/** 清除用户配置的 API Base */
export function clearApiBaseFromConfig(): void {
  removeItem(API_BASE_KEY);
}

/** 判断是否已配置自定义 API Base（不等于默认值） */
export function isApiConfigured(): boolean {
  const saved = getApiBaseFromConfig();
  return saved.length > 0 && saved !== DEFAULT_API_BASE;
}

/** 获取当前生效的 API Base（优先使用用户配置的，否则用默认） */
export function getEffectiveApiBase(): string {
  return getApiBaseFromConfig() || DEFAULT_API_BASE;
}