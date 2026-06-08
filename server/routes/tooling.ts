import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ApiToolingResponse } from '../../shared/apiTypes';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';
import { recordAuditEvent } from '../services/audit';
import { toApiPart } from './parts';

interface ToolingRouteOptions {
  db: DbClient;
}

const toIsoDate = (value: Date | null) => value ? value.toISOString().slice(0, 10) : null;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

const updateMilestoneSchema = z.object({
  status: z.string().trim().min(1).max(80).optional(),
  plannedDate: dateSchema,
  actualDate: dateSchema,
  owner: z.string().trim().min(1).max(160).nullable().optional(),
  notes: z.string().trim().min(1).max(2000).nullable().optional(),
  blockerReason: z.string().trim().min(1).max(2000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one milestone field is required.',
});

const toDate = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00.000Z`);
};

export const toolingRoutes: FastifyPluginAsync<ToolingRouteOptions> = async (app, options) => {
  app.get('/', async (request): Promise<ApiToolingResponse> => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');

    const designMasters = await options.db.toolingDesignMaster.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: { code: 'asc' },
      include: {
        mappings: {
          include: { part: true },
        },
      },
    });

    const toolingRecords = await options.db.toolingRecord.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: { name: 'asc' },
      include: {
        milestones: {
          orderBy: { key: 'asc' },
        },
      },
    });

    return {
      designMasters: designMasters.map((designMaster) => ({
        id: designMaster.id,
        projectId: designMaster.projectId,
        code: designMaster.code,
        name: designMaster.name,
        concreteParts: designMaster.mappings.map((mapping) => toApiPart(mapping.part)),
      })),
      toolingRecords: toolingRecords.map((record) => ({
        id: record.id,
        projectId: record.projectId,
        designMasterId: record.designMasterId,
        name: record.name,
        supplier: record.supplier,
        owner: record.owner,
        cavityCount: record.cavityCount,
        milestones: record.milestones.map((milestone) => ({
          id: milestone.id,
          key: milestone.key,
          status: milestone.status,
          plannedDate: toIsoDate(milestone.plannedDate),
          actualDate: toIsoDate(milestone.actualDate),
          owner: milestone.owner,
          notes: milestone.notes,
          blockerReason: milestone.blockerReason,
        })),
      })),
    };
  });

  app.patch('/milestones/:milestoneId', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'MANAGE_TOOLING');
    const { milestoneId } = request.params as { milestoneId: string };

    const existing = await options.db.toolingMilestone.findFirst({
      where: {
        id: milestoneId,
        workspaceId: actor.workspaceId,
      },
    });

    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Tooling milestone not found.',
        statusCode: 404,
      });
    }

    const result = updateMilestoneSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid tooling milestone payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    const milestone = await options.db.toolingMilestone.update({
      where: { id: existing.id },
      data: {
        status: result.data.status,
        plannedDate: toDate(result.data.plannedDate),
        actualDate: toDate(result.data.actualDate),
        owner: result.data.owner,
        notes: result.data.notes,
        blockerReason: result.data.blockerReason,
      },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'ToolingMilestone',
      entityId: milestone.id,
      action: 'update',
      before: existing,
      after: milestone,
    });

    return {
      milestone: {
        id: milestone.id,
        key: milestone.key,
        status: milestone.status,
        plannedDate: toIsoDate(milestone.plannedDate),
        actualDate: toIsoDate(milestone.actualDate),
        owner: milestone.owner,
        notes: milestone.notes,
        blockerReason: milestone.blockerReason,
      },
    };
  });
};
