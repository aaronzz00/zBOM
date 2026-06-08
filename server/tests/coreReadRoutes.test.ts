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

describe('core read API routes', () => {
  it('allows unauthenticated project reads (guest fallback)', async () => {
    const response = await app!.inject({
      method: 'GET',
      url: '/api/projects',
    });

    expect(response.statusCode).toBe(200);
  });

  it('lists only projects in the actor workspace', async () => {
    const cookie = await loginAs('VIEWER');

    const response = await app!.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().projects).toEqual([
      expect.objectContaining({
        id: 'project-test',
        code: 'ZPM-T',
        phase: 'DVT',
      }),
    ]);
    expect(response.json().projects).not.toContainEqual(expect.objectContaining({ id: 'project-other' }));
  });

  it('lists parts scoped to the actor workspace', async () => {
    const cookie = await loginAs('SOURCING');

    const response = await app!.inject({
      method: 'GET',
      url: '/api/parts',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().parts).toEqual([
      expect.objectContaining({ partNumber: '100-55512-A', manufacturer: 'Qualcomm' }),
      expect.objectContaining({ partNumber: 'ZP-A-STD-COVER-BLK' }),
    ]);
    expect(response.json().parts).not.toContainEqual(expect.objectContaining({ partNumber: 'OTHER-PART' }));
  });

  it('returns a nested BOM tree for the requested project', async () => {
    const cookie = await loginAs('ENG_LEAD');

    const response = await app!.inject({
      method: 'GET',
      url: '/api/projects/project-test/bom',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      projectId: 'project-test',
      roots: [
        {
          id: 'bom-root',
          partNumber: '800-TEST',
          customAttributes: { platform: 'test' },
          children: [
            {
              id: 'bom-child-soc',
              partId: 'part-soc',
              partNumber: '100-55512-A',
            },
          ],
        },
      ],
    });
  });

  it('returns 404 for a project outside the actor workspace', async () => {
    const cookie = await loginAs('VIEWER');

    const response = await app!.inject({
      method: 'GET',
      url: '/api/projects/project-other/bom',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns tooling records with concrete part mappings and milestones', async () => {
    const cookie = await loginAs('ADMIN');

    const response = await app!.inject({
      method: 'GET',
      url: '/api/tooling',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      designMasters: [
        {
          id: 'dmp-cover',
          code: 'DMP-COVER',
          concreteParts: [
            {
              id: 'part-cover',
              partNumber: 'ZP-A-STD-COVER-BLK',
            },
          ],
        },
      ],
      toolingRecords: [
        {
          id: 'tooling-cover',
          designMasterId: 'dmp-cover',
          milestones: expect.arrayContaining([
            expect.objectContaining({ key: 'kickoff', status: 'DONE', plannedDate: '2026-02-01' }),
            expect.objectContaining({ key: 't1', status: 'IN_PROGRESS' }),
          ]),
        },
      ],
    });
  });
});

