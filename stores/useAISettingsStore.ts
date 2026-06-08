import { create } from 'zustand';

export type AIProviderType = 'openai-compatible';

export interface AIProviderSettings {
  enabled: boolean;
  providerType: AIProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

interface AISettingsState {
  settings: AIProviderSettings;
  updateSettings: (updates: Partial<AIProviderSettings>) => void;
  resetSettings: () => void;
  isConfigured: () => boolean;
}

export const DEFAULT_AI_SETTINGS: AIProviderSettings = {
  enabled: false,
  providerType: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.3,
};

const STORAGE_KEY = 'zbom.ai.provider_settings.v1';

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeSettings = (value: Partial<AIProviderSettings> = {}): AIProviderSettings => {
  const temperature = Number(value.temperature);

  return {
    ...DEFAULT_AI_SETTINGS,
    ...value,
    providerType: 'openai-compatible',
    baseUrl: (value.baseUrl || DEFAULT_AI_SETTINGS.baseUrl).trim().replace(/\/+$/, ''),
    apiKey: value.apiKey || '',
    model: (value.model || DEFAULT_AI_SETTINGS.model).trim(),
    temperature: Number.isFinite(temperature)
      ? Math.min(2, Math.max(0, temperature))
      : DEFAULT_AI_SETTINGS.temperature,
  };
};

const loadSettings = (): AIProviderSettings => {
  if (!hasStorage()) return { ...DEFAULT_AI_SETTINGS };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_AI_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
};

const persistSettings = (settings: AIProviderSettings) => {
  if (!hasStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...settings,
      apiKey: '',
    }));
  } catch {
    // Storage can be disabled in hardened browsers; keep in-memory settings usable.
  }
};

export const useAISettingsStore = create<AISettingsState>((set, get) => ({
  settings: loadSettings(),

  updateSettings: (updates) => {
    const next = normalizeSettings({ ...get().settings, ...updates });
    persistSettings(next);
    set({ settings: next });
  },

  resetSettings: () => {
    if (hasStorage()) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ settings: { ...DEFAULT_AI_SETTINGS } });
  },

  isConfigured: () => {
    const { settings } = get();
    return Boolean(
      settings.enabled &&
      settings.baseUrl.trim() &&
      settings.apiKey.trim() &&
      settings.model.trim()
    );
  },
}));
