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

describe('BOM Import API routes', () => {
  const validCsv = [
    'Level,Part Number,Name,Description,Revision,State,Type,Quantity,Unit Cost,Manufacturer,MPN',
    '0,800-TEST,Test Top Assembly,Top desc,A,Prototype,Assembly,1,0,Internal,',
    '1,100-55512-A,SoC Snapdragon,SoC desc,A,Released,Part,1,35,Qualcomm,SM8650',
    '1,999-NEW-PART,New Part Name,New part desc,A,Draft,Part,4,2.5,Supplier Co,NPI-999'
  ].join('\n');

  const mismatchedCsv = [
    'Level,Part Number,Name,Description,Revision,State,Type,Quantity,Unit Cost,Manufacturer,MPN',
    '0,800-TEST,Test Top Assembly,Top desc,A,Prototype,Assembly,1,0,Internal,',
    '1,100-55512-A,Mismatched SoC Snapdragon Name,SoC desc,A,Released,Part,1,35,Qualcomm,SM8650'
  ].join('\n');

  const cyclicOrJumpCsv = [
    'Level,Part Number,Name,Description,Revision,State,Type,Quantity,Unit Cost,Manufacturer,MPN',
    '0,800-TEST,Test Top Assembly,Top desc,A,Prototype,Assembly,1,0,Internal,',
    '2,100-55512-A,SoC Snapdragon,SoC desc,A,Released,Part,1,35,Qualcomm,SM8650'
  ].join('\n');

  it('rejects preview request if unauthenticated', async () => {
    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects/project-test/bom/import-preview',
      payload: { csvText: validCsv },
    });
    expect(response.statusCode).toBe(200);
  });

  it('allows VIEWER to preview a valid BOM CSV import', async () => {
    const cookie = await loginAs('VIEWER');
    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects/project-test/bom/import-preview',
      headers: { cookie },
      payload: { csvText: validCsv },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.rowCount).toBe(3);
    expect(body.errors).toHaveLength(0);
    expect(body.tree.partNumber).toBe('800-TEST');
    expect(body.tree.children).toHaveLength(2);

    // One child is existing with matching name
    const socNode = body.tree.children.find((c: any) => c.partNumber === '100-55512-A');
    expect(socNode.status).toBe('EXISTING');

    // Second child is completely new
    const newNode = body.tree.children.find((c: any) => c.partNumber === '999-NEW-PART');
    expect(newNode.status).toBe('NEW');
  });

  it('flags name mismatches as CONFLICT in preview', async () => {
    const cookie = await loginAs('VIEWER');
    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects/project-test/bom/import-preview',
      headers: { cookie },
      payload: { csvText: mismatchedCsv },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.tree.children[0].status).toBe('CONFLICT');
    expect(body.tree.children[0].libraryName).toBe('SoC Snapdragon');
  });

  it('returns errors on indentation jumps in preview', async () => {
    const cookie = await loginAs('VIEWER');
    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects/project-test/bom/import-preview',
      headers: { cookie },
      payload: { csvText: cyclicOrJumpCsv },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.errors.length).toBeGreaterThan(0);
    expect(body.errors[0]).toContain('Indentation level jumps');
  });

  it('allows ENG_LEAD to commit import and updates part library', async () => {
    const cookie = await loginAs('ENG_LEAD');

    // Verify '999-NEW-PART' does not exist in library yet
    const initialPart = await testDb!.db.part.findFirst({
      where: { partNumber: '999-NEW-PART', workspaceId: 'workspace-test' }
    });
    expect(initialPart).toBeNull();

    // Commit import
    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects/project-test/bom/import-commit',
      headers: { cookie },
      payload: { csvText: validCsv },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);

    // Verify '999-NEW-PART' has been created in library
    const createdPart = await testDb!.db.part.findFirst({
      where: { partNumber: '999-NEW-PART', workspaceId: 'workspace-test' }
    });
    expect(createdPart).not.toBeNull();
    expect(createdPart!.name).toBe('New Part Name');
    expect(createdPart!.cost).toBe(2.5);

    // Verify BOMNodes have been replaced for project-test
    const dbNodes = await testDb!.db.bOMNode.findMany({
      where: { projectId: 'project-test', workspaceId: 'workspace-test' }
    });
    // Our import has 3 items
    expect(dbNodes).toHaveLength(3);

    // Verify audit log exists
    const auditLogs = await testDb!.db.auditEvent.findMany({
      where: { entityType: 'bom', entityId: 'project-test', action: 'import-bom' }
    });
    expect(auditLogs).toHaveLength(1);
    expect(JSON.parse(auditLogs[0].afterJson!).rowCount).toBe(3);
  });

  it('rejects commit attempts by SOURCING role', async () => {
    const cookie = await loginAs('SOURCING');
    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects/project-test/bom/import-commit',
      headers: { cookie },
      payload: { csvText: validCsv },
    });
    expect(response.statusCode).toBe(403);
  });

  it('rejects commit if CSV has structural errors', async () => {
    const cookie = await loginAs('ENG_LEAD');
    const response = await app!.inject({
      method: 'POST',
      url: '/api/projects/project-test/bom/import-commit',
      headers: { cookie },
      payload: { csvText: cyclicOrJumpCsv },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('ValidationError');
    expect(response.json().message).toContain('Cannot commit CSV with structural errors');
  });
});
