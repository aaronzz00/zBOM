import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { createTestDatabase, TestDatabase } from './testDb';
import { checkLarkCliAuth, loadLarkMappings } from '../auth/lark';

// Mock the lark utility file
vi.mock('../auth/lark', () => {
  return {
    checkLarkCliAuth: vi.fn(),
    loadLarkMappings: vi.fn(),
  };
});

const testConfig = {
  NODE_ENV: 'test' as const,
  SERVER_PORT: 3002,
  DATABASE_URL: 'file:test.db',
  SESSION_SECRET: 'test-session-secret-lark',
  AI_CREDENTIAL_ENCRYPTION_KEY: 'test-ai-credential-key-lark',
  CORS_ORIGIN: 'http://localhost:3000',
};

let testDb: TestDatabase | null = null;
let app: FastifyInstance | null = null;

beforeEach(async () => {
  vi.clearAllMocks();
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

describe('Lark CLI Authentication Integrations', () => {
  it('falls back to VIEWER when lark-cli is logged out / has no mapped user', async () => {
    vi.mocked(checkLarkCliAuth).mockResolvedValue(null);

    const response = await app!.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.actor).toMatchObject({
      role: 'VIEWER',
      permissions: ['VIEW_BOM'],
    });
  });

  it('allows read requests without any session cookie (guest fallback)', async () => {
    vi.mocked(checkLarkCliAuth).mockResolvedValue(null);

    const response = await app!.inject({
      method: 'GET',
      url: '/api/projects',
    });

    // Read requests should succeed because they fall back to VIEWER
    expect(response.statusCode).toBe(200);
  });

  it('rejects write requests with 403 Forbidden when unauthenticated (guest fallback)', async () => {
    vi.mocked(checkLarkCliAuth).mockResolvedValue(null);

    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects',
      payload: {
        code: 'NEWPROJ',
        name: 'New Project',
        sku: 'SKU-001',
      },
    });

    // Write request should be rejected with 403 because VIEWER doesn't have EDIT_BOM_STRUCTURE/write permission
    expect(response.statusCode).toBe(403);
  });

  it('silently logs in and returns mapped ADMIN role when lark-cli is authenticated and mapped', async () => {
    vi.mocked(checkLarkCliAuth).mockResolvedValue({
      openId: 'ou_lark_test_admin_id',
      userName: 'Lark Test User',
      tenantKey: 'tenant_test_123',
    });

    vi.mocked(loadLarkMappings).mockResolvedValue({
      mappings: {
        ou_lark_test_admin_id: {
          userId: 'user-admin', // from testDb seeds
          role: 'ADMIN',
          email: 'admin@zbom.local',
          name: 'Lark Test User',
        },
      },
    });

    const response = await app!.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.actor).toMatchObject({
      role: 'ADMIN',
      userId: 'user-admin',
    });

    // Verify session cookie is set
    const setCookie = response.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';')[0];
    expect(cookie).toContain('zbom_session=');

    // Subsequent write request with this cookie should succeed
    const writeResponse = await app!.inject({
      method: 'POST',
      url: '/api/projects',
      headers: {
        cookie,
      },
      payload: {
        code: 'LARKPROJ',
        name: 'Lark Auth Project',
        sku: 'SKU-LARK-01',
      },
    });

    expect(writeResponse.statusCode).toBe(200);
  });
});
