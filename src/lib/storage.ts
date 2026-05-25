/**
 * Chrome Storage wrapper
 * 
 * Provides type-safe access to Chrome's storage API
 * Handles both sync and local storage
 */

import { STORAGE_KEYS } from './constants';

export interface Settings {
  geminiApiKey: string;
  autoLoadTranscript: boolean;
  sidebarPosition: 'right' | 'left';
  theme: 'light' | 'dark' | 'auto';
  defaultNoteType: 'concise' | 'detailed' | 'interview';
}

const DEFAULT_SETTINGS: Settings = {
  geminiApiKey: '',
  autoLoadTranscript: true,
  sidebarPosition: 'right',
  theme: 'auto',
  defaultNoteType: 'concise',
};

/**
 * Get settings from storage
 */
export async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
  } catch (error) {
    console.error('Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to storage
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  try {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: updated });
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

/**
 * Get Gemini API key
 */
export async function getGeminiApiKey(): Promise<string> {
  const settings = await getSettings();
  return settings.geminiApiKey;
}

/**
 * Save Gemini API key
 */
export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  await saveSettings({ geminiApiKey: apiKey });
}

/**
 * Get value from local storage
 */
export async function getLocal<T>(key: string): Promise<T | null> {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  } catch (error) {
    console.error(`Failed to get ${key} from local storage:`, error);
    return null;
  }
}

/**
 * Save value to local storage
 */
export async function saveLocal<T>(key: string, value: T): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error(`Failed to save ${key} to local storage:`, error);
    throw error;
  }
}

/**
 * Remove value from local storage
 */
export async function removeLocal(key: string): Promise<void> {
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error(`Failed to remove ${key} from local storage:`, error);
    throw error;
  }
}

/**
 * Clear all local storage
 */
export async function clearLocal(): Promise<void> {
  try {
    await chrome.storage.local.clear();
  } catch (error) {
    console.error('Failed to clear local storage:', error);
    throw error;
  }
}
