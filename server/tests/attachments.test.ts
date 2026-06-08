import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
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

const buildMultipartBody = (filename: string, contentType: string, content: string, boundary = '----WebKitFormBoundarytest') => {
  const payload = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    '',
    content,
    `--${boundary}--`,
    ''
  ].join('\r\n');

  return {
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`
    },
    payload
  };
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

describe('Attachments API routes', () => {
  it('rejects upload request if unauthenticated', async () => {
    const multipart = buildMultipartBody('spec.pdf', 'application/pdf', 'dummy PDF content');
    const response = await app!.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: multipart.headers,
      payload: multipart.payload,
    });
    expect(response.statusCode).toBe(403);
  });

  it('allows ENG_LEAD to upload an attachment and categorizes it correctly', async () => {
    const cookie = await loginAs('ENG_LEAD');
    const multipart = buildMultipartBody('datasheet.pdf', 'application/pdf', 'dummy PDF content');
    
    const response = await app!.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie, ...multipart.headers },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.attachment).toBeDefined();
    expect(body.attachment.id).toBeDefined();
    expect(body.attachment.name).toBe('datasheet.pdf');
    expect(body.attachment.type).toBe('datasheet');
    expect(body.attachment.url).toContain('/uploads/');

    // Verify physical file was written to disk
    const fileName = path.basename(body.attachment.url);
    const filePath = path.resolve('uploads', fileName);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('dummy PDF content');

    // Clean up test file manually to avoid cluttering local repo
    fs.unlinkSync(filePath);
  });

  it('supports linking and unlinking attachment to BOMNode', async () => {
    const cookie = await loginAs('ENG_LEAD');
    
    // 1. Upload attachment
    const multipart = buildMultipartBody('drawing.dxf', 'application/octet-stream', 'dummy DXF content');
    const uploadRes = await app!.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie, ...multipart.headers },
      payload: multipart.payload,
    });
    const attachment = uploadRes.json().attachment;

    // 2. Link to bom-root
    const linkRes = await app!.inject({
      method: 'POST',
      url: `/api/attachments/bom/bom-root/link`,
      headers: { cookie },
      payload: { attachmentId: attachment.id },
    });
    expect(linkRes.statusCode).toBe(200);
    expect(linkRes.json().success).toBe(true);

    // Verify DB relation mapping
    const dbAttachmentLinked = await testDb!.db.attachment.findUnique({
      where: { id: attachment.id }
    });
    expect(dbAttachmentLinked!.bomNodeId).toBe('bom-root');

    // 3. Unlink from bom-root
    const unlinkRes = await app!.inject({
      method: 'POST',
      url: `/api/attachments/bom/bom-root/unlink`,
      headers: { cookie },
      payload: { attachmentId: attachment.id },
    });
    expect(unlinkRes.statusCode).toBe(200);
    expect(unlinkRes.json().success).toBe(true);

    // Verify DB record exists but bomNodeId is null (kept in storage)
    const dbAttachmentUnlinked = await testDb!.db.attachment.findUnique({
      where: { id: attachment.id }
    });
    expect(dbAttachmentUnlinked).not.toBeNull();
    expect(dbAttachmentUnlinked!.bomNodeId).toBeNull();

    // Verify physical file is still present on disk (kept in storage)
    const fileName = path.basename(attachment.url);
    const filePath = path.resolve('uploads', fileName);
    expect(fs.existsSync(filePath)).toBe(true);

    // Clean up
    fs.unlinkSync(filePath);
  });

  it('supports deleting attachment completely', async () => {
    const cookie = await loginAs('ENG_LEAD');
    
    // 1. Upload attachment
    const multipart = buildMultipartBody('cad.step', 'application/octet-stream', 'dummy STEP content');
    const uploadRes = await app!.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie, ...multipart.headers },
      payload: multipart.payload,
    });
    const attachment = uploadRes.json().attachment;
    const fileName = path.basename(attachment.url);
    const filePath = path.resolve('uploads', fileName);

    // 2. Delete attachment completely
    const deleteRes = await app!.inject({
      method: 'DELETE',
      url: `/api/attachments/${attachment.id}`,
      headers: { cookie },
    });
    expect(deleteRes.statusCode).toBe(204);

    // Verify database record is gone
    const dbRecord = await testDb!.db.attachment.findUnique({
      where: { id: attachment.id }
    });
    expect(dbRecord).toBeNull();

    // Verify physical file is deleted
    expect(fs.existsSync(filePath)).toBe(false);
  });
});
