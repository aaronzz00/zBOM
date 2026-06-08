import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
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
  return cookie!;
};

beforeEach(async () => {
  testDb = await createTestDatabase();
  app = await buildApp({ ...testConfig, DATABASE_URL: testDb.databaseUrl }, { db: testDb.db });
});

afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }
  if (testDb) {
    await testDb.cleanup();
    testDb = null;
  }
});

describe('workspace settings API routes', () => {
  it('allows unauthenticated settings reads (guest fallback)', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/workspace/settings',
    });
    expect(response.statusCode).toBe(200);
  });

  it('reads default settings when db configurations are empty', async () => {
    const cookie = await loginAs('VIEWER');
    const response = await app!.inject({
      method: 'GET',
      url: '/api/workspace/settings',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.settings).toBeDefined();
    expect(body.settings.warehouseLocations).toContain('WH-A');
    expect(body.settings.flows).toHaveLength(2);
  });

  it('allows ADMIN to update workspace settings and then retrieves updated values', async () => {
    const adminCookie = await loginAs('ADMIN');
    const getResponse = await app!.inject({
      method: 'GET',
      url: '/api/workspace/settings',
      headers: { cookie: adminCookie },
    });
    const currentSettings = getResponse.json().settings;

    const updatedSettings = {
      ...currentSettings,
      warehouseLocations: ['WH-A', 'WH-B', 'WH-NEW-LOC'],
    };

    const putResponse = await app!.inject({
      method: 'PUT',
      url: '/api/workspace/settings',
      headers: { cookie: adminCookie },
      payload: updatedSettings,
    });
    expect(putResponse.statusCode).toBe(200);
    expect(putResponse.json().settings.warehouseLocations).toContain('WH-NEW-LOC');

    // Verify it is persisted
    const viewerCookie = await loginAs('VIEWER');
    const getPersistedResponse = await app!.inject({
      method: 'GET',
      url: '/api/workspace/settings',
      headers: { cookie: viewerCookie },
    });
    expect(getPersistedResponse.statusCode).toBe(200);
    expect(getPersistedResponse.json().settings.warehouseLocations).toContain('WH-NEW-LOC');
  });

  it('rejects VIEWER attempts to write settings', async () => {
    const viewerCookie = await loginAs('VIEWER');
    const putResponse = await app!.inject({
      method: 'PUT',
      url: '/api/workspace/settings',
      headers: { cookie: viewerCookie },
      payload: { flows: [] }, // simple payload, fails authorization first
    });
    expect(putResponse.statusCode).toBe(403);
  });
});
