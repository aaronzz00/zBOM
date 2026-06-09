import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { ApiToolingRecord, ApiToolingRecordMutationResponse, ApiToolingResponse } from '../../shared/apiTypes';
import {
  createToolingNumber,
  DEFAULT_TOOLING_MILESTONES,
  TOOLING_CATEGORIES,
  TOOLING_STATUSES,
  type ToolingCategory,
} from '../../domain/toolingTypes';
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
const toolingCategorySchema = z.enum(TOOLING_CATEGORIES);
const toolingStatusSchema = z.enum(TOOLING_STATUSES);

const createToolingSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
  designMasterPartId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(240),
  type: toolingCategorySchema,
  leadTimeDays: z.number().int().positive().optional(),
  supplier: z.string().trim().min(1).max(160).nullable().optional(),
  cavityCount: z.string().trim().min(1).max(80).nullable().optional(),
  owner: z.string().trim().min(1).max(160).nullable().optional(),
}).strict();

const updateToolingSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  type: toolingCategorySchema.optional(),
  status: toolingStatusSchema.optional(),
  leadTimeDays: z.number().int().positive().nullable().optional(),
  supplier: z.string().trim().min(1).max(160).nullable().optional(),
  cavityCount: z.string().trim().min(1).max(80).nullable().optional(),
  owner: z.string().trim().min(1).max(160).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one tooling field is required.',
});

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

const toApiToolingRecord = (record: {
  id: string;
  projectId: string;
  designMasterId: string;
  toolingNumber: string;
  name: string;
  type: string;
  status: string;
  supplier: string | null;
  owner: string | null;
  cavityCount: string | null;
  leadTimeDays: number | null;
  milestones: Array<{
    id: string;
    key: string;
    status: string;
    plannedDate: Date | null;
    actualDate: Date | null;
    owner: string | null;
    notes: string | null;
    blockerReason: string | null;
  }>;
}): ApiToolingRecord => ({
  id: record.id,
  projectId: record.projectId,
  designMasterId: record.designMasterId,
  toolingNumber: record.toolingNumber,
  name: record.name,
  type: record.type,
  status: record.status,
  supplier: record.supplier,
  owner: record.owner,
  cavityCount: record.cavityCount,
  leadTimeDays: record.leadTimeDays,
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
});

const allocateToolingNumber = async (
  db: DbClient,
  workspaceId: string,
  type: ToolingCategory,
  exceptToolingId?: string,
) => {
  const prefix = createToolingNumber(type, 0).replace(/-000$/, '');
  const records = await db.toolingRecord.findMany({
    where: {
      workspaceId,
      type,
      id: exceptToolingId ? { not: exceptToolingId } : undefined,
    },
    select: { toolingNumber: true },
  });
  const maxSequence = records.reduce((max, record) => {
    if (!record.toolingNumber.startsWith(`${prefix}-`)) return max;
    const sequence = Number(record.toolingNumber.slice(prefix.length + 1));
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return createToolingNumber(type, maxSequence + 1);
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
      orderBy: { toolingNumber: 'asc' },
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
      toolingRecords: toolingRecords.map(toApiToolingRecord),
    };
  });

  app.post('/', async (request, reply): Promise<ApiToolingRecordMutationResponse | void> => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'MANAGE_TOOLING');

    const result = createToolingSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid tooling payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    const designMaster = await options.db.toolingDesignMaster.findFirst({
      where: {
        id: result.data.designMasterPartId,
        workspaceId: actor.workspaceId,
      },
    });

    if (!designMaster) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Design master part not found.',
        statusCode: 404,
      });
    }

    const toolingNumber = await allocateToolingNumber(options.db, actor.workspaceId, result.data.type);
    const toolingRecord = await options.db.toolingRecord.create({
      data: {
        id: `tooling-${randomUUID()}`,
        workspaceId: actor.workspaceId,
        projectId: result.data.projectId ?? designMaster.projectId,
        designMasterId: designMaster.id,
        toolingNumber,
        name: result.data.name,
        type: result.data.type,
        status: 'pending',
        supplier: result.data.supplier,
        cavityCount: result.data.cavityCount,
        owner: result.data.owner,
        leadTimeDays: result.data.leadTimeDays,
        milestones: {
          create: DEFAULT_TOOLING_MILESTONES.map((milestone) => ({
            id: `tooling-ms-${randomUUID()}`,
            workspaceId: actor.workspaceId,
            key: milestone.key,
            status: milestone.status,
          })),
        },
      },
      include: {
        milestones: { orderBy: { key: 'asc' } },
      },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'ToolingRecord',
      entityId: toolingRecord.id,
      action: 'create',
      before: null,
      after: toolingRecord,
    });

    return { toolingRecord: toApiToolingRecord(toolingRecord) };
  });

  app.patch('/:toolingId', async (request, reply): Promise<ApiToolingRecordMutationResponse | void> => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'MANAGE_TOOLING');
    const { toolingId } = request.params as { toolingId: string };

    const existing = await options.db.toolingRecord.findFirst({
      where: {
        id: toolingId,
        workspaceId: actor.workspaceId,
      },
      include: {
        milestones: { orderBy: { key: 'asc' } },
      },
    });

    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Tooling record not found.',
        statusCode: 404,
      });
    }

    const result = updateToolingSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid tooling update payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    const nextType = result.data.type ?? existing.type as ToolingCategory;
    const toolingNumber = !existing.toolingNumber || nextType !== existing.type
      ? await allocateToolingNumber(options.db, actor.workspaceId, nextType, existing.id)
      : existing.toolingNumber;

    const toolingRecord = await options.db.toolingRecord.update({
      where: { id: existing.id },
      data: {
        ...result.data,
        toolingNumber,
      },
      include: {
        milestones: { orderBy: { key: 'asc' } },
      },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'ToolingRecord',
      entityId: toolingRecord.id,
      action: 'update',
      before: existing,
      after: toolingRecord,
    });

    return { toolingRecord: toApiToolingRecord(toolingRecord) };
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
