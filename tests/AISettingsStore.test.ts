import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_AI_SETTINGS, useAISettingsStore } from '../stores/useAISettingsStore';

const STORAGE_KEY = 'zbom.ai.provider_settings.v1';

describe('AI settings store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAISettingsStore.getState().resetSettings();
  });

  it('starts with OpenAI-compatible defaults and AI disabled', () => {
    const { settings } = useAISettingsStore.getState();

    expect(settings).toEqual(DEFAULT_AI_SETTINGS);
    expect(settings.providerType).toBe('openai-compatible');
    expect(settings.baseUrl).toBe('https://api.openai.com/v1');
    expect(settings.enabled).toBe(false);
    expect(useAISettingsStore.getState().isConfigured()).toBe(false);
  });

  it('normalizes settings without persisting the provider key', () => {
    useAISettingsStore.getState().updateSettings({
      enabled: true,
      baseUrl: 'https://llm.example.com/v1/',
      apiKey: 'sk-test-123',
      model: 'gpt-test-model',
      temperature: 2.4,
    });

    const saved = useAISettingsStore.getState().settings;
    expect(saved.baseUrl).toBe('https://llm.example.com/v1');
    expect(saved.temperature).toBe(2);
    expect(useAISettingsStore.getState().isConfigured()).toBe(true);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')).toMatchObject({
      enabled: true,
      providerType: 'openai-compatible',
      baseUrl: 'https://llm.example.com/v1',
      apiKey: '',
      model: 'gpt-test-model',
      temperature: 2,
    });
  });
});
