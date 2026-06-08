import { randomUUID } from 'node:crypto';
import { Actor } from '../../shared/permissions';
import { DbClient } from '../db/client';

interface AuditEventInput {
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

const serializeAuditValue = (value: unknown): string | null => {
  if (value === undefined) return null;
  return JSON.stringify(value);
};

export const recordAuditEvent = async (
  db: any,
  actor: Actor,
  input: AuditEventInput
) => {
  return db.auditEvent.create({
    data: {
      id: `audit-${randomUUID()}`,
      workspaceId: actor.workspaceId,
      actorUserId: actor.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      beforeJson: serializeAuditValue(input.before),
      afterJson: serializeAuditValue(input.after),
    },
  });
};
