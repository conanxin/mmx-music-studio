/**
 * Global settings context — holds keyMode, region, apiKey in React state.
 *
 * Security:
 * - Key is stored ONLY in React state (memory). No localStorage/sessionStorage.
 * - Refreshing the page clears the key.
 * - No console.log of the key value.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

export type KeyMode = 'session' | 'server';
export type Region = 'cn' | 'global';

export interface AppSettings {
  keyMode: KeyMode;
  region: Region;
  apiKey: string;
  backendMode: 'api';
}

const DEFAULT_SETTINGS: AppSettings = {
  keyMode: 'session',
  region: 'cn',
  apiKey: '',
  backendMode: 'api',
};

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within <SettingsProvider>');
  }
  return ctx;
}

/**
 * Mask an API key for display. Never shows the full key.
 */
export function maskKey(key: string): string {
  if (!key || key.trim().length === 0) return '未设置';
  if (key.length < 10) return '已输入';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function hasSessionKey(settings: AppSettings): boolean {
  return settings.keyMode === 'session' && settings.apiKey.trim().length > 0;
}
