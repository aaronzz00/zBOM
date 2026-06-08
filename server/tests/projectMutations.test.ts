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

describe('Project Mutations and Transition API', () => {
  it('allows ENG_LEAD to create a project and auto-initializes the top level assembly BOMNode', async () => {
    const cookie = await loginAs('ENG_LEAD');

    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: {
        code: 'PROJNEW',
        name: 'New Hardware Product',
        sku: 'SKU-NEW-123',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.project).toEqual(expect.objectContaining({
      code: 'PROJNEW',
      name: 'New Hardware Product',
      sku: 'SKU-NEW-123',
      phase: 'EVT',
    }));

    const projectId = body.project.id;

    // Verify root BOMNode was auto-created in database
    const rootNode = await testDb!.db.bOMNode.findFirst({
      where: {
        projectId,
        parentId: null,
      },
    });
    expect(rootNode).not.toBeNull();
    expect(rootNode!.partNumber).toBe('800-PROJNEW-001');
    expect(rootNode!.name).toBe('Top Level Assembly, New Hardware Product');
  });

  it('allows ENG_LEAD to update a project SKU and name', async () => {
    const cookie = await loginAs('ENG_LEAD');

    // Create first
    const createResp = await app!.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: {
        code: 'PROJUPD',
        name: 'Initial Name',
        sku: 'SKU-1',
      },
    });
    const projectId = createResp.json().project.id;

    // Update
    const updateResp = await app!.inject({
      method: 'PATCH',
      url: `/api/projects/${projectId}`,
      headers: { cookie },
      payload: {
        name: 'Updated Name',
        sku: 'SKU-UPDATED',
      },
    });

    expect(updateResp.statusCode).toBe(200);
    expect(updateResp.json().project).toEqual(expect.objectContaining({
      name: 'Updated Name',
      sku: 'SKU-UPDATED',
    }));
  });

  it('validates project phase transition checklist signatures', async () => {
    const cookie = await loginAs('ENG_LEAD');

    // Create project
    const createResp = await app!.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { cookie },
      payload: {
        code: 'TRANS',
        name: 'Transition Test',
        sku: 'SKU-TRANS',
      },
    });
    const projectId = createResp.json().project.id;

    // Try transitioning without any signatures (should fail checklist validation)
    const failResp = await app!.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/transition`,
      headers: { cookie },
      payload: {
        newPhase: 'DVT',
        signatures: [],
      },
    });
    expect(failResp.statusCode).toBe(400);
    expect(failResp.json().message).toContain('Missing required checklist items');

    // Transition with correct signatures
    const signatures = [
      { item: 'BOM Cost Review Completed', actor: 'Engineer User', role: 'ENG_LEAD', timestamp: new Date().toISOString() },
      { item: 'DFM Review Completed', actor: 'Engineer User', role: 'ENG_LEAD', timestamp: new Date().toISOString() },
      { item: 'Initial EVT Yield Report Attached', actor: 'Engineer User', role: 'ENG_LEAD', timestamp: new Date().toISOString() }
    ];

    const successResp = await app!.inject({
      method: 'POST',
      url: `/api/projects/${projectId}/transition`,
      headers: { cookie },
      payload: {
        newPhase: 'DVT',
        signatures,
      },
    });

    expect(successResp.statusCode).toBe(200);
    expect(successResp.json().project.phase).toBe('DVT');

    // Verify Audit Event logged in DB
    const auditEvent = await testDb!.db.auditEvent.findFirst({
      where: {
        entityType: 'project',
        entityId: projectId,
        action: 'transition-phase',
      },
    });
    expect(auditEvent).not.toBeNull();
    const afterObj = JSON.parse(auditEvent!.afterJson!);
    expect(afterObj.phase).toBe('DVT');
    expect(afterObj.signatures).toHaveLength(3);
  });
});
