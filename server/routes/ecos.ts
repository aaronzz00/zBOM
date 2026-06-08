import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiECO } from '../../shared/apiTypes';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';
import { recordAuditEvent } from '../services/audit';

interface ECORouteOptions {
  db: DbClient;
}

const ecoImpactSchema = z.object({
  partNumber: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
  changeType: z.enum(['RevUp', 'New', 'Obsolete', 'QtyChange']),
  from: z.string().trim().min(1).max(120).nullable().optional(),
  to: z.string().trim().min(1).max(120).nullable().optional(),
});

const createEcoSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(1000),
  initiator: z.string().trim().min(1).max(240),
  priority: z.enum(['Low', 'Medium', 'High', 'Emergency']),
  impacts: z.array(ecoImpactSchema).default([]),
});

const updateEcoSchema = z.object({
  status: z.enum(['Draft', 'Pending Approval', 'Approved', 'Rejected', 'Implemented']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Emergency']).optional(),
  approvedBy: z.string().trim().min(1).max(240).nullable().optional(),
  approvalDate: z.string().trim().datetime().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required to update.',
});

export const toApiECO = (eco: any): ApiECO => ({
  id: eco.id,
  ecoNumber: eco.ecoNumber,
  title: eco.title,
  description: eco.description,
  status: eco.status as any,
  initiator: eco.initiator,
  createdDate: eco.createdDate.toISOString(),
  approvedBy: eco.approvedBy,
  approvalDate: eco.approvalDate ? eco.approvalDate.toISOString() : null,
  priority: eco.priority as any,
  impacts: (eco.impacts || []).map((impact: any) => ({
    partNumber: impact.partNumber,
    name: impact.name,
    changeType: impact.changeType as any,
    from: impact.from,
    to: impact.to,
  })),
});

export const ecoRoutes: FastifyPluginAsync<ECORouteOptions> = async (app, options) => {
  app.get('/', async (request) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');

    const ecos = await options.db.eCO.findMany({
      where: { workspaceId: actor.workspaceId },
      include: { impacts: true },
      orderBy: { createdDate: 'desc' },
    });

    return {
      ecos: ecos.map(toApiECO),
    };
  });

  app.post('/', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');

    const parsed = createEcoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid ECO data.',
        details: parsed.error.format(),
        statusCode: 400,
      });
    }

    const nextIndex = (await options.db.eCO.count({
      where: { workspaceId: actor.workspaceId },
    })) + 1;
    const year = new Date().getFullYear();
    const ecoNumber = `ECO-${year}-${String(nextIndex).padStart(3, '0')}`;

    const ecoId = `eco-${randomUUID()}`;

    const newEco = await options.db.eCO.create({
      data: {
        id: ecoId,
        workspaceId: actor.workspaceId,
        ecoNumber,
        title: parsed.data.title,
        description: parsed.data.description,
        initiator: parsed.data.initiator,
        status: 'Draft',
        priority: parsed.data.priority,
        createdDate: new Date(),
        impacts: {
          create: parsed.data.impacts.map((impact, idx) => ({
            id: `impact-${ecoId}-${idx}-${randomUUID().slice(0, 8)}`,
            partNumber: impact.partNumber,
            name: impact.name,
            changeType: impact.changeType,
            from: impact.from || null,
            to: impact.to || null,
          })),
        },
      },
      include: { impacts: true },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'ECO',
      entityId: newEco.id,
      action: 'CREATE',
      before: null,
      after: toApiECO(newEco),
    });

    return { eco: toApiECO(newEco) };
  });

  app.patch('/:ecoId', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_STRUCTURE');

    const { ecoId } = request.params as { ecoId: string };

    const parsed = updateEcoSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid update payload.',
        details: parsed.error.format(),
        statusCode: 400,
      });
    }

    const existingEco = await options.db.eCO.findFirst({
      where: { id: ecoId, workspaceId: actor.workspaceId },
      include: { impacts: true },
    });

    if (!existingEco) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'ECO not found.',
        statusCode: 404,
      });
    }

    const updateData: any = {};
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
    }
    if (parsed.data.priority !== undefined) {
      updateData.priority = parsed.data.priority;
    }
    if (parsed.data.approvedBy !== undefined) {
      updateData.approvedBy = parsed.data.approvedBy;
    }
    if (parsed.data.approvalDate !== undefined) {
      updateData.approvalDate = parsed.data.approvalDate ? new Date(parsed.data.approvalDate) : null;
    }

    const updatedEco = await options.db.eCO.update({
      where: { id: ecoId },
      data: updateData,
      include: { impacts: true },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'ECO',
      entityId: ecoId,
      action: 'UPDATE',
      before: toApiECO(existingEco),
      after: toApiECO(updatedEco),
    });

    return { eco: toApiECO(updatedEco) };
  });
};
