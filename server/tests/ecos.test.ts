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

describe('ECO API routes', () => {
  it('allows unauthenticated ECO requests (guest fallback)', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/ecos',
    });
    expect(response.statusCode).toBe(200);
  });

  it('lists ECOs correctly for a viewer', async () => {
    const cookie = await loginAs('VIEWER');
    const response = await app!.inject({
      method: 'GET',
      url: '/api/ecos',
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ecos).toBeDefined();
    expect(Array.isArray(body.ecos)).toBe(true);
  });

  it('allows ENG_LEAD to create an ECO and then update its status', async () => {
    const engCookie = await loginAs('ENG_LEAD');
    const newEcoPayload = {
      title: 'Upgrade battery casing',
      description: 'Strengthen frame brackets to pass drop test specifications.',
      initiator: 'Sarah Engineer',
      priority: 'High',
      impacts: [
        {
          partNumber: '100-BAT-CASE',
          name: 'Battery Casing Bracket',
          changeType: 'New',
        },
      ],
    };

    const postResponse = await app!.inject({
      method: 'POST',
      url: '/api/ecos',
      headers: { cookie: engCookie },
      payload: newEcoPayload,
    });
    expect(postResponse.statusCode).toBe(200);

    const createdEco = postResponse.json().eco;
    expect(createdEco.id).toBeDefined();
    expect(createdEco.ecoNumber).toContain('ECO-');
    expect(createdEco.status).toBe('Draft');
    expect(createdEco.impacts).toHaveLength(1);
    expect(createdEco.impacts[0].partNumber).toBe('100-BAT-CASE');

    // Now update/approve the ECO
    const patchResponse = await app!.inject({
      method: 'PATCH',
      url: `/api/ecos/${createdEco.id}`,
      headers: { cookie: engCookie },
      payload: {
        status: 'Approved',
        approvedBy: 'Sarah Engineer',
        approvalDate: new Date().toISOString(),
      },
    });
    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json().eco.status).toBe('Approved');
    expect(patchResponse.json().eco.approvedBy).toBe('Sarah Engineer');

    // List ECOs and verify it appears
    const getResponse = await app!.inject({
      method: 'GET',
      url: '/api/ecos',
      headers: { cookie: engCookie },
    });
    const ecos = getResponse.json().ecos;
    expect(ecos.some((e: any) => e.id === createdEco.id && e.status === 'Approved')).toBe(true);
  });

  it('rejects SOURCING attempts to create an ECO', async () => {
    const sourcingCookie = await loginAs('SOURCING');
    const response = await app!.inject({
      method: 'POST',
      url: '/api/ecos',
      headers: { cookie: sourcingCookie },
      payload: {
        title: 'Unauthorized ECO',
        description: 'Should fail',
        initiator: 'Mike Sourcing',
        priority: 'Low',
        impacts: [],
      },
    });
    expect(response.statusCode).toBe(403);
  });
});
