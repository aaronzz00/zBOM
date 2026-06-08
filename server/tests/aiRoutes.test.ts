import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { decryptCredential } from '../services/aiCredentials';
import { createTestDatabase, TestDatabase } from './testDb';

const testConfig = {
  NODE_ENV: 'test' as const,
  SERVER_PORT: 3001,
  DATABASE_URL: 'file:test.db',
  SESSION_SECRET: 'test-session-secret',
  AI_CREDENTIAL_ENCRYPTION_KEY: 'test-ai-credential-key',
  CORS_ORIGIN: 'http://localhost:3000',
};

let testDb: TestDatabase | null = null;
let app: FastifyInstance | null = null;

const loginAs = async (role: 'ADMIN' | 'ENG_LEAD' | 'SOURCING' | 'VIEWER') => {
  const response = await app!.inject({
    method: 'POST',
    url: '/api/auth/dev-login',
    payload: { role },
  });
  const setCookie = response.headers['set-cookie'];
  const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0];

  expect(response.statusCode).toBe(200);
  expect(cookie).toContain('zbom_session=');
  return cookie!;
};

beforeEach(async () => {
  testDb = await createTestDatabase();
  app = await buildApp({ ...testConfig, DATABASE_URL: testDb.databaseUrl }, { db: testDb.db });
  vi.unstubAllGlobals();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  if (app) {
    await app.close();
    app = null;
  }
  if (testDb) {
    await testDb.cleanup();
    testDb = null;
  }
});

describe('AI provider API routes', () => {
  it('guards provider management by role', async () => {
    const viewerCookie = await loginAs('VIEWER');

    const response = await app!.inject({
      method: 'GET',
      url: '/api/ai/provider',
      headers: { cookie: viewerCookie },
    });

    expect(response.statusCode).toBe(403);
  });

  it('stores provider keys encrypted and returns only keyLast4', async () => {
    const adminCookie = await loginAs('ADMIN');

    const response = await app!.inject({
      method: 'PUT',
      url: '/api/ai/provider',
      headers: { cookie: adminCookie },
      payload: {
        enabled: true,
        providerType: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        model: 'gpt-test',
        temperature: 0.2,
        apiKey: 'sk-secret-1234',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().provider).toEqual(expect.objectContaining({
      enabled: true,
      providerType: 'openai-compatible',
      baseUrl: 'https://llm.example.com/v1',
      model: 'gpt-test',
      temperature: 0.2,
      keyLast4: '1234',
    }));
    expect(response.json().provider).not.toHaveProperty('apiKey');

    const stored = await testDb!.db.aiProviderConfig.findUnique({
      where: { workspaceId: 'workspace-test' },
    });
    expect(stored?.encryptedApiKey).toBeTruthy();
    expect(stored?.encryptedApiKey).not.toContain('sk-secret-1234');
    expect(decryptCredential(stored!.encryptedApiKey!, testConfig.AI_CREDENTIAL_ENCRYPTION_KEY)).toBe('sk-secret-1234');
  });

  it('proxies chat completions with decrypted credentials and logs requests', async () => {
    const adminCookie = await loginAs('ADMIN');
    await app!.inject({
      method: 'PUT',
      url: '/api/ai/provider',
      headers: { cookie: adminCookie },
      payload: {
        enabled: true,
        providerType: 'openai-compatible',
        baseUrl: 'https://llm.example.com/v1',
        model: 'gpt-test',
        temperature: 0.4,
        apiKey: 'sk-secret-5678',
      },
    });

    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Backend proxy response.' } }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const viewerCookie = await loginAs('VIEWER');
    const response = await app!.inject({
      method: 'POST',
      url: '/api/ai/chat',
      headers: { cookie: viewerCookie },
      payload: {
        purpose: 'bom-risk',
        messages: [
          { role: 'system', content: 'You are a BOM analyst.' },
          { role: 'user', content: 'Find risk in this BOM.' },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().choices[0].message.content).toBe('Backend proxy response.');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://llm.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-secret-5678',
        }),
      })
    );

    const providerBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(providerBody).toMatchObject({
      model: 'gpt-test',
      temperature: 0.4,
    });

    const log = await testDb!.db.aiRequestLog.findFirst({
      where: {
        workspaceId: 'workspace-test',
        actorUserId: 'user-viewer',
        purpose: 'bom-risk',
      },
    });
    expect(log).toEqual(expect.objectContaining({
      status: 'SUCCESS',
    }));
    expect(log?.redactedPromptPreview).toContain('Find risk');
  });
});
