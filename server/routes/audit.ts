import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { assertPermission } from '../auth/rbac';
import { requireActor } from '../auth/requestActor';
import { DbClient } from '../db/client';

interface AuditRouteOptions {
  db: DbClient;
}

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().positive().default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  actorUserId: z.string().optional(),
});

export const auditRoutes: FastifyPluginAsync<AuditRouteOptions> = async (app, options) => {
  app.get('/', async (request) => {
    const actor = await requireActor(options.db, request);
    assertPermission(actor, 'VIEW_BOM');

    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw parsed.error;
    }

    const { limit, offset, entityType, entityId, action, actorUserId } = parsed.data;

    const where: any = {
      workspaceId: actor.workspaceId,
    };

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (actorUserId) where.actorUserId = actorUserId;

    const [events, total] = await Promise.all([
      options.db.auditEvent.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          actorUser: {
            select: {
              name: true,
            },
          },
        },
      }),
      options.db.auditEvent.count({ where }),
    ]);

    return {
      events: events.map((event) => ({
        id: event.id,
        actorUserId: event.actorUserId,
        actorName: event.actorUser?.name || 'Unknown',
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        beforeJson: event.beforeJson,
        afterJson: event.afterJson,
        createdAt: event.createdAt.toISOString(),
      })),
      total,
    };
  });
};
