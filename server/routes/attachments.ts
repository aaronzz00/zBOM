import { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';
import { recordAuditEvent } from '../services/audit';

interface AttachmentsRouteOptions {
  db: DbClient;
}

const uploadsDir = path.resolve('uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const attachmentsRoutes: FastifyPluginAsync<AttachmentsRouteOptions> = async (app, options) => {
  // 1. Upload Attachment
  app.post('/', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'No file uploaded.',
        statusCode: 400,
      });
    }

    const fileId = randomUUID();
    const fileName = `${fileId}-${data.filename}`;
    const filePath = path.join(uploadsDir, fileName);

    try {
      await pipeline(data.file, fs.createWriteStream(filePath));
    } catch (err) {
      return reply.status(500).send({
        error: 'StorageError',
        message: 'Failed to write file to disk.',
        statusCode: 500,
      });
    }

    const stats = fs.statSync(filePath);
    const sizeString = `${(stats.size / 1024).toFixed(1)} KB`;
    
    // Determine attachment category/type from extension
    const ext = path.extname(data.filename).toLowerCase();
    let type = 'other';
    if (['.pdf', '.txt', '.doc', '.docx'].includes(ext)) type = 'datasheet';
    else if (['.step', '.stp', '.iges', '.igs'].includes(ext)) type = 'cad';
    else if (['.dwg', '.dxf', '.pdf'].includes(ext)) type = 'drawing';

    // Save database record
    const attachment = await options.db.attachment.create({
      data: {
        id: fileId,
        workspaceId: actor.workspaceId,
        name: data.filename,
        type,
        url: `/uploads/${fileName}`,
        size: sizeString,
      },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'part',
      entityId: fileId,
      action: 'create',
      after: attachment,
    });

    return reply.status(201).send({ attachment });
  });

  // 2. Delete Attachment
  app.delete('/:id', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { id } = request.params as { id: string };

    const attachment = await options.db.attachment.findFirst({
      where: {
        id,
        workspaceId: actor.workspaceId,
      },
    });

    if (!attachment) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Attachment not found.',
        statusCode: 404,
      });
    }

    // Delete database record
    await options.db.attachment.delete({
      where: { id: attachment.id },
    });

    // Delete physical file if local path
    if (attachment.url.startsWith('/uploads/')) {
      const fileName = path.basename(attachment.url);
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          app.log.error(`Failed to delete physical file: ${filePath}`);
        }
      }
    }

    await recordAuditEvent(options.db, actor, {
      entityType: 'part',
      entityId: id,
      action: 'delete',
      before: attachment,
    });

    return reply.status(204).send();
  });

  // 3. Link Attachment to Part
  app.post('/parts/:partId/link', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { partId } = request.params as { partId: string };
    const { attachmentId } = request.body as { attachmentId: string };

    const part = await options.db.part.findFirst({
      where: { id: partId, workspaceId: actor.workspaceId },
    });
    const attachment = await options.db.attachment.findFirst({
      where: { id: attachmentId, workspaceId: actor.workspaceId },
    });

    if (!part || !attachment) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Part or Attachment not found.',
        statusCode: 404,
      });
    }

    const updated = await options.db.attachment.update({
      where: { id: attachmentId },
      data: { partId },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'part',
      entityId: partId,
      action: 'update',
      before: attachment,
      after: updated,
    });

    return { success: true, attachment: updated };
  });

  // 4. Unlink Attachment from Part
  app.post('/parts/:partId/unlink', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { partId } = request.params as { partId: string };
    const { attachmentId } = request.body as { attachmentId: string };

    const attachment = await options.db.attachment.findFirst({
      where: { id: attachmentId, partId, workspaceId: actor.workspaceId },
    });

    if (!attachment) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Attachment link not found.',
        statusCode: 404,
      });
    }

    const updated = await options.db.attachment.update({
      where: { id: attachmentId },
      data: { partId: null },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'part',
      entityId: partId,
      action: 'update',
      before: attachment,
      after: updated,
    });

    return { success: true, attachment: updated };
  });

  // 5. Link Attachment to BOMNode
  app.post('/bom/:nodeId/link', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { nodeId } = request.params as { nodeId: string };
    const { attachmentId } = request.body as { attachmentId: string };

    const node = await options.db.bOMNode.findFirst({
      where: { id: nodeId, workspaceId: actor.workspaceId },
    });
    const attachment = await options.db.attachment.findFirst({
      where: { id: attachmentId, workspaceId: actor.workspaceId },
    });

    if (!node || !attachment) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'BOM Node or Attachment not found.',
        statusCode: 404,
      });
    }

    const updated = await options.db.attachment.update({
      where: { id: attachmentId },
      data: { bomNodeId: nodeId },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'BOMNode',
      entityId: nodeId,
      action: 'update',
      before: attachment,
      after: updated,
    });

    return { success: true, attachment: updated };
  });

  // 6. Unlink Attachment from BOMNode
  app.post('/bom/:nodeId/unlink', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');
    const { nodeId } = request.params as { nodeId: string };
    const { attachmentId } = request.body as { attachmentId: string };

    const attachment = await options.db.attachment.findFirst({
      where: { id: attachmentId, bomNodeId: nodeId, workspaceId: actor.workspaceId },
    });

    if (!attachment) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Attachment link not found.',
        statusCode: 404,
      });
    }

    const updated = await options.db.attachment.update({
      where: { id: attachmentId },
      data: { bomNodeId: null },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'BOMNode',
      entityId: nodeId,
      action: 'update',
      before: attachment,
      after: updated,
    });

    return { success: true, attachment: updated };
  });
};
