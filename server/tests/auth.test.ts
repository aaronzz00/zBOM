import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { AuthorizationError, assertPermission } from '../auth/rbac';
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

describe('auth routes', () => {
  it('falls back to VIEWER for /me without a session', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().actor.role).toBe('VIEWER');
  });

  it('creates a dev session and returns the actor for the requested role', async () => {
    const login = await app!.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { role: 'VIEWER' },
    });
    const setCookie = login.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0];

    expect(login.statusCode).toBe(200);
    expect(cookie).toContain('zbom_session=');
    expect(login.json().actor).toMatchObject({
      role: 'VIEWER',
      workspaceId: 'workspace-test',
      permissions: ['VIEW_BOM'],
    });

    const me = await app!.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie,
      },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().actor).toMatchObject({
      role: 'VIEWER',
      permissions: ['VIEW_BOM'],
    });
  });

  it('rejects invalid dev-login payloads', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { role: 'NOPE' },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe('rbac helpers', () => {
  it('throws when an actor lacks the requested permission', () => {
    expect(() => assertPermission({
      userId: 'user-viewer',
      workspaceId: 'workspace-test',
      role: 'VIEWER',
      permissions: ['VIEW_BOM'],
    }, 'EDIT_BOM_STRUCTURE')).toThrow(AuthorizationError);
  });
});

