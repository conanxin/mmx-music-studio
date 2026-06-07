// storage.ts — Local storage adapter for WeChat Mini Program
// Uses wx.getStorageSync / wx.setStorageSync
// IMPORTANT: Never store real API keys here (security risk in WeChat context)

export const getItem = (key: string): string | null => {
  try {
    const value = wx.getStorageSync(key)
    return value ?? null
  } catch {
    return null
  }
}

export const setItem = (key: string, value: string): void => {
  try {
    wx.setStorageSync(key, value)
  } catch { /* ignore */ }
}

export const removeItem = (key: string): void => {
  try {
    wx.removeStorageSync(key)
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
} as const

// ⚠️ Security: Do NOT store these in WeChat storage:
// - minimax_api_key
// - bearer tokens
// - any real credentials
// Storage is readable via debugging tools and can be extracted