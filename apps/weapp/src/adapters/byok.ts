/**
 * apps/weapp/src/adapters/byok.ts
 * Phase 5C: WeChat Mini Program BYOK Strategy
 *
 * Memory-only API key storage for session-scoped BYOK.
 * - Does NOT use wx.setStorage / Taro.setStorage
 * - Does NOT write to localStorage
 * - Does NOT log key values
 * - Key is lost on page refresh / mini program restart
 */

import type { WeappByokState } from '../../src/types'

// ─── Module-level memory store ───────────────────────────────────────────────
// NOT persisted. Survives only within the current mini program session.
// Use a Map to support future multi-user scenarios (currently single-user).
const _keyStore = new Map<string, string>()

// ─── Masking ────────────────────────────────────────────────────────────────

/**
 * Mask API key: show first 4 and last 4 chars, hide middle.
 * Example: sk_abc123def456789 → sk_abc1...6789
 */
export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return 'sk_***'
  const prefix = key.slice(0, 4)
  const suffix = key.slice(-4)
  return `${prefix}...${suffix}`
}

// ─── Session key management ───────────────────────────────────────────────────

/**
 * Save API key to session memory.
 * @param key - The raw MiniMax Token Plan API key
 */
export function setSessionApiKey(key: string): void {
  // Store under a fixed clientId for now (single-user session)
  _keyStore.set('default', key)
}

/**
 * Retrieve the session API key, or null if not set.
 */
export function getSessionApiKey(): string | null {
  return _keyStore.get('default') ?? null
}

/**
 * Check whether a session API key is currently set.
 */
export function hasSessionApiKey(): boolean {
  return _keyStore.has('default')
}

/**
 * Remove the session API key from memory.
 * Key is immediately gone — no async cleanup needed.
 */
export function clearSessionApiKey(): void {
  _keyStore.delete('default')
}

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * Get a snapshot of the current BYOK state for UI binding.
 * Does NOT expose the raw key.
 */
export function getByokState(): WeappByokState {
  const raw = getSessionApiKey()
  if (!raw) {
    return { hasKey: false }
  }
  return {
    hasKey: true,
    maskedKey: maskApiKey(raw),
  }
}