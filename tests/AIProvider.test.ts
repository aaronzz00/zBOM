import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeBOMNode, chatWithBOM } from '../services/aiProvider';
import { useAISettingsStore } from '../stores/useAISettingsStore';
import { BOMNode, ComponentType, LifecycleState } from '../types';

const sampleNode: BOMNode = {
  id: 'node-1',
  partNumber: 'ZB-001',
  name: 'Main Logic Board',
  revision: 'A',
  state: LifecycleState.Draft,
  type: ComponentType.Assembly,
  quantity: 1,
  unit: 'ea',
  cost: 120,
  currency: 'USD',
  children: [],
};

describe('OpenAI-compatible AI provider service', () => {
  beforeEach(() => {
    localStorage.clear();
    useAISettingsStore.getState().resetSettings();
    vi.unstubAllGlobals();
  });

  it('does not call fetch when AI is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await analyzeBOMNode(sampleNode, 'risks');

    expect(result).toContain('AI Assistant is disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the configured OpenAI-compatible chat completions endpoint', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Risk analysis complete.' } }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    useAISettingsStore.getState().updateSettings({
      enabled: true,
      baseUrl: 'https://llm.example.com/v1',
      apiKey: 'sk-test-123',
      model: 'gpt-test-model',
      temperature: 0.2,
    });

    const result = await chatWithBOM([{ role: 'user', text: 'What should I inspect?' }], sampleNode, 'Find supply risk.');

    expect(result).toBe('Risk analysis complete.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-test-123',
        }),
      })
    );

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      model: 'gpt-test-model',
      temperature: 0.2,
    });
    expect(requestBody.messages[0]).toMatchObject({ role: 'system' });
    expect(requestBody.messages.at(-1)).toMatchObject({ role: 'user' });
  });
});

