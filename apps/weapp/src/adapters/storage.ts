// storage.ts — Local storage adapter for WeChat Mini Program
// Uses Taro.getStorage / Taro.setStorage / Taro.removeStorage
// IMPORTANT: Never store real API keys here (security risk in WeChat context)

// @ts-ignore Taro types have internal esModuleInterop issues — ignored via skipLibCheck
import Taro from '@tarojs/taro';

export const getItem = (key: string): string | null => {
  try {
    // Taro.getStorage is async, we use getStorageSync for synchronous access
    const res = Taro.getStorageSync(key)
    return res ?? null
  } catch {
    return null
  }
}

export const setItem = (key: string, value: string): void => {
  try {
    Taro.setStorageSync(key, value)
  } catch { /* ignore */ }
}

export const removeItem = (key: string): void => {
  try {
    Taro.removeStorageSync(key)
  } catch { /* ignore */ }
}

// Safe storage keys (non-sensitive)
export const STORAGE_KEYS = {
  API_BASE: 'api_base',
  BACKEND_MODE: 'backend_mode',
  LAST_MODE: 'last_mode',
  THEME: 'theme',
  SESSION_ID: 'session_id',
  // ⚠️ Do NOT add: API_KEY, SECRET_KEY, TOKEN here
} as const;

// ⚠️ Security: Do NOT store these in WeChat storage:
// - minimax_api_key
// - bearer tokens
// - any real credentials
// Storage is readable via debugging tools and can be extracted