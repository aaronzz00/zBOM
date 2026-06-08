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
  expect(cookie).toContain('zbom_session=');
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

describe('core mutation API routes', () => {
  it('allows sourcing to update commercial part fields and records audit', async () => {
    const cookie = await loginAs('SOURCING');

    const response = await app!.inject({
      method: 'PATCH',
      url: '/api/parts/part-soc',
      headers: { cookie },
      payload: {
        cost: 42.5,
        manufacturer: 'Qualcomm Preferred',
        leadTimeWeeks: 14,
        moq: 500,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().part).toEqual(expect.objectContaining({
      id: 'part-soc',
      cost: 42.5,
      manufacturer: 'Qualcomm Preferred',
      leadTimeWeeks: 14,
      moq: 500,
    }));

    const audit = await testDb!.db.auditEvent.findFirst({
      where: {
        entityType: 'Part',
        entityId: 'part-soc',
        action: 'update',
      },
    });
    expect(audit).toEqual(expect.objectContaining({
      workspaceId: 'workspace-test',
      actorUserId: 'user-sourcing',
    }));
  });

  it('blocks sourcing from editing engineering metadata and engineers from editing cost', async () => {
    const sourcingCookie = await loginAs('SOURCING');
    const sourcingResponse = await app!.inject({
      method: 'PATCH',
      url: '/api/parts/part-soc',
      headers: { cookie: sourcingCookie },
      payload: { name: 'Unauthorized rename' },
    });

    expect(sourcingResponse.statusCode).toBe(403);

    const engineerCookie = await loginAs('ENG_LEAD');
    const engineerResponse = await app!.inject({
      method: 'PATCH',
      url: '/api/parts/part-soc',
      headers: { cookie: engineerCookie },
      payload: { cost: 99 },
    });

    expect(engineerResponse.statusCode).toBe(403);
  });

  it('allows admins to create a part and archives through a soft delete', async () => {
    const cookie = await loginAs('ADMIN');

    const createResponse = await app!.inject({
      method: 'POST',
      url: '/api/parts',
      headers: { cookie },
      payload: {
        partNumber: 'ZP-NEW-001',
        name: 'New Production Part',
        type: 'Part',
        lifecycleState: 'Draft',
        cost: 12,
        currency: 'USD',
        manufacturer: 'Demo Supplier',
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const createdPartId = createResponse.json().part.id;

    const deleteResponse = await app!.inject({
      method: 'DELETE',
      url: `/api/parts/${createdPartId}`,
      headers: { cookie },
    });

    expect(deleteResponse.statusCode).toBe(204);
    const archivedPart = await testDb!.db.part.findUnique({ where: { id: createdPartId } });
    expect(archivedPart?.archivedAt).toBeInstanceOf(Date);
  });

  it('allows engineers to create BOM nodes but prevents cycles and parent deletion', async () => {
    const cookie = await loginAs('ENG_LEAD');

    const createResponse = await app!.inject({
      method: 'POST',
      url: '/api/projects/project-test/bom',
      headers: { cookie },
      payload: {
        parentId: 'bom-root',
        partId: 'part-cover',
        quantity: 2,
        customAttributes: { finish: 'black' },
      },
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().node).toEqual(expect.objectContaining({
      partId: 'part-cover',
      partNumber: 'ZP-A-STD-COVER-BLK',
      quantity: 2,
      customAttributes: { finish: 'black' },
    }));

    const cycleResponse = await app!.inject({
      method: 'PATCH',
      url: '/api/projects/project-test/bom/bom-root',
      headers: { cookie },
      payload: { parentId: 'bom-child-soc' },
    });
    expect(cycleResponse.statusCode).toBe(409);

    const deleteResponse = await app!.inject({
      method: 'DELETE',
      url: '/api/projects/project-test/bom/bom-root',
      headers: { cookie },
    });
    expect(deleteResponse.statusCode).toBe(409);

    const audit = await testDb!.db.auditEvent.findFirst({
      where: {
        entityType: 'BOMNode',
        action: 'create',
      },
    });
    expect(audit?.actorUserId).toBe('user-engineer');
  });

  it('allows sourcing to update BOM cost only', async () => {
    const cookie = await loginAs('SOURCING');

    const response = await app!.inject({
      method: 'PATCH',
      url: '/api/projects/project-test/bom/bom-child-soc',
      headers: { cookie },
      payload: {
        cost: 33.25,
        currency: 'USD',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().node).toEqual(expect.objectContaining({
      id: 'bom-child-soc',
      cost: 33.25,
      currency: 'USD',
    }));
  });

  it('guards tooling milestone updates by role and records audit', async () => {
    const viewerCookie = await loginAs('VIEWER');
    const viewerResponse = await app!.inject({
      method: 'PATCH',
      url: '/api/tooling/milestones/tooling-cover-t1',
      headers: { cookie: viewerCookie },
      payload: { status: 'DONE' },
    });
    expect(viewerResponse.statusCode).toBe(403);

    const engineerCookie = await loginAs('ENG_LEAD');
    const engineerResponse = await app!.inject({
      method: 'PATCH',
      url: '/api/tooling/milestones/tooling-cover-t1',
      headers: { cookie: engineerCookie },
      payload: {
        status: 'DONE',
        actualDate: '2026-03-08',
        owner: 'Tooling PM',
      },
    });

    expect(engineerResponse.statusCode).toBe(200);
    expect(engineerResponse.json().milestone).toEqual(expect.objectContaining({
      id: 'tooling-cover-t1',
      status: 'DONE',
      actualDate: '2026-03-08',
      owner: 'Tooling PM',
    }));

    const audit = await testDb!.db.auditEvent.findFirst({
      where: {
        entityType: 'ToolingMilestone',
        entityId: 'tooling-cover-t1',
        action: 'update',
      },
    });
    expect(audit?.actorUserId).toBe('user-engineer');
  });
});
