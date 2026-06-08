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

describe('Audit Logs API', () => {
  it('allows unauthenticated audit trail queries (guest fallback)', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/audit',
    });
    expect(response.statusCode).toBe(200);
  });

  it('allows authenticated users to query and filter audit logs with pagination', async () => {
    const cookie = await loginAs('ENG_LEAD');

    // Generate a few audit logs by creating a project and updating parts
    await app!.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: {
        code: 'AUDIT1',
        name: 'Audit Project 1',
        sku: 'SKU-A1',
      },
    });

    await app!.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: {
        code: 'AUDIT2',
        name: 'Audit Project 2',
        sku: 'SKU-A2',
      },
    });

    // Query all logs
    const allLogsResp = await app!.inject({
      method: 'GET',
      url: '/api/audit',
      headers: { cookie },
    });
    expect(allLogsResp.statusCode).toBe(200);
    const body = allLogsResp.json();
    expect(body.events).toBeDefined();
    expect(body.total).toBeGreaterThanOrEqual(2);

    // Verify properties of the log event
    const projectEvent = body.events.find((e: any) => e.entityType === 'project' && e.action === 'create');
    expect(projectEvent).toBeDefined();
    expect(projectEvent.actorName).toBe('Engineer User');

    // Query with filter
    const filteredResp = await app!.inject({
      method: 'GET',
      url: '/api/audit?entityType=project',
      headers: { cookie },
    });
    expect(filteredResp.statusCode).toBe(200);
    expect(filteredResp.json().events.every((e: any) => e.entityType === 'project')).toBe(true);

    // Query with pagination limit
    const paginatedResp = await app!.inject({
      method: 'GET',
      url: '/api/audit?limit=1',
      headers: { cookie },
    });
    expect(paginatedResp.statusCode).toBe(200);
    expect(paginatedResp.json().events).toHaveLength(1);
    expect(paginatedResp.json().total).toBe(body.total);
  });
});
