// request.ts — HTTP request adapter for WeChat Mini Program
// Phase 3A: mock only, no real API calls
// Phase 3B+: will call self-hosted server API

import type { RequestOptions } from '../types'

// Default placeholder — Phase 3B should be replaced with real server URL
let apiBase: string = 'https://your-domain.example'

export const getApiBase = (): string => {
  // Try to read from storage first (Phase 3B+)
  try {
    const stored = wx.getStorageSync('api_base')
    if (stored && typeof stored === 'string' && stored.length > 0) {
      apiBase = stored
    }
  } catch { /* storage not available in dev */ }
  return apiBase
}

export const setApiBase = (base: string): void => {
  apiBase = base
  try {
    wx.setStorageSync('api_base', base)
  } catch { /* ignore */ }
}

// Phase 3A: Always returns mock (no real network)
export const requestJson = async <T>(
  _path: string,
  _options?: RequestOptions
): Promise<T> => {
  // Phase 3A: Mock only — do not call real server
  // Phase 3B+: implement real wx.request calls here
  throw new Error('[request] Phase 3A: No real API calls. Use mock data.')
}

// Check if real API is configured and available
export const isApiConfigured = (): boolean => {
  const base = getApiBase()
  return base !== 'https://your-domain.example' && base.length > 0
}

// Phase 3A: This is always false (mock mode)
export const isMockMode = (): boolean => {
  return true
}