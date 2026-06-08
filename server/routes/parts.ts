import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiPart } from '../../shared/apiTypes';
import { ServerPermission } from '../../shared/permissions';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';
import { recordAuditEvent } from '../services/audit';

interface PartRouteOptions {
  db: DbClient;
}

const optionalNullableText = z.string().trim().min(1).max(200).nullable().optional();
const optionalNullableLongText = z.string().trim().min(1).max(1000).nullable().optional();

const createPartSchema = z.object({
  partNumber: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
  description: optionalNullableLongText,
  type: z.string().trim().min(1).max(80).default('Part'),
  lifecycleState: z.string().trim().min(1).max(80).default('Draft'),
  manufacturer: optionalNullableText,
  mpn: optionalNullableText,
  cost: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().min(3).max(3).nullable().optional(),
  leadTimeWeeks: z.number().int().nonnegative().nullable().optional(),
  moq: z.number().int().nonnegative().nullable().optional(),
  spq: z.number().int().nonnegative().nullable().optional(),
}).strict();

const updatePartSchema = z.object({
  name: z.string().trim().min(1).max(240).optional(),
  description: optionalNullableLongText,
  type: z.string().trim().min(1).max(80).optional(),
  lifecycleState: z.string().trim().min(1).max(80).optional(),
  manufacturer: optionalNullableText,
  mpn: optionalNullableText,
  cost: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().min(3).max(3).nullable().optional(),
  leadTimeWeeks: z.number().int().nonnegative().nullable().optional(),
  moq: z.number().int().nonnegative().nullable().optional(),
  spq: z.number().int().nonnegative().nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one part field is required.',
});

const metadataFields = ['name', 'description', 'type', 'lifecycleState'] as const;
const costFields = ['cost', 'currency'] as const;
const commercialFields = ['manufacturer', 'mpn', 'leadTimeWeeks', 'moq', 'spq'] as const;

export const toApiPart = (part: {
  id: string;
  partNumber: string;
  name: string;
  description: string | null;
  type: string;
  lifecycleState: string;
  manufacturer: string | null;
  mpn: string | null;
  cost: number | null;
  currency: string | null;
  leadTimeWeeks: number | null;
  moq: number | null;
  spq: number | null;
}): ApiPart => ({
  id: part.id,
  partNumber: part.partNumber,
  name: part.name,
  description: part.description,
  type: part.type,
  lifecycleState: part.lifecycleState,
  manufacturer: part.manufacturer,
  mpn: part.mpn,
  cost: part.cost,
  currency: part.currency,
  leadTimeWeeks: part.leadTimeWeeks,
  moq: part.moq,
  spq: part.spq,
});

const hasAnyField = (body: object, fields: readonly string[]) => {
  return fields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
};

const assertFieldPermissions = (
  actor: Awaited<ReturnType<typeof requireActor>>,
  body: object,
  rules: Array<{ fields: readonly string[]; permission: ServerPermission }>
) => {
  for (const rule of rules) {
    if (hasAnyField(body, rule.fields)) {
      assertPermission(actor, rule.permission);
    }
  }
};

export const partRoutes: FastifyPluginAsync<PartRouteOptions> = async (app, options) => {
  app.get('/', async (request) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');

    const parts = await options.db.part.findMany({
      where: {
        workspaceId: actor.workspaceId,
        archivedAt: null,
      },
      orderBy: { partNumber: 'asc' },
    });

    return {
      parts: parts.map(toApiPart),
    };
  });

  app.post('/', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_METADATA');

    const result = createPartSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid part payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    assertFieldPermissions(actor, result.data, [
      { fields: costFields, permission: 'EDIT_COST' },
      { fields: commercialFields, permission: 'EDIT_COMMERCIAL_FIELDS' },
    ]);

    const part = await options.db.part.create({
      data: {
        id: `part-${randomUUID()}`,
        workspaceId: actor.workspaceId,
        partNumber: result.data.partNumber,
        name: result.data.name,
        description: result.data.description ?? null,
        type: result.data.type,
        lifecycleState: result.data.lifecycleState,
        manufacturer: result.data.manufacturer ?? null,
        mpn: result.data.mpn ?? null,
        cost: result.data.cost ?? null,
        currency: result.data.currency ?? null,
        leadTimeWeeks: result.data.leadTimeWeeks ?? null,
        moq: result.data.moq ?? null,
        spq: result.data.spq ?? null,
      },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'Part',
      entityId: part.id,
      action: 'create',
      after: part,
    });

    return reply.status(201).send({ part: toApiPart(part) });
  });

  app.patch('/:partId', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    const { partId } = request.params as { partId: string };

    const existing = await options.db.part.findFirst({
      where: {
        id: partId,
        workspaceId: actor.workspaceId,
        archivedAt: null,
      },
    });

    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Part not found.',
        statusCode: 404,
      });
    }

    const result = updatePartSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid part payload.',
        statusCode: 400,
        issues: result.error.issues,
      });
    }

    assertFieldPermissions(actor, result.data, [
      { fields: metadataFields, permission: 'EDIT_BOM_METADATA' },
      { fields: costFields, permission: 'EDIT_COST' },
      { fields: commercialFields, permission: 'EDIT_COMMERCIAL_FIELDS' },
    ]);

    const part = await options.db.part.update({
      where: { id: existing.id },
      data: result.data,
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'Part',
      entityId: part.id,
      action: 'update',
      before: existing,
      after: part,
    });

    return { part: toApiPart(part) };
  });

  app.delete('/:partId', async (request, reply) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'EDIT_BOM_METADATA');
    const { partId } = request.params as { partId: string };

    const existing = await options.db.part.findFirst({
      where: {
        id: partId,
        workspaceId: actor.workspaceId,
        archivedAt: null,
      },
    });

    if (!existing) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'Part not found.',
        statusCode: 404,
      });
    }

    const part = await options.db.part.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });

    await recordAuditEvent(options.db, actor, {
      entityType: 'Part',
      entityId: part.id,
      action: 'archive',
      before: existing,
      after: part,
    });

    return reply.status(204).send();
  });
};
