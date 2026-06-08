import { Actor, isServerUserRole } from '../../shared/permissions';
import { DbClient } from '../db/client';
import { AuthenticationError } from './session';
import { permissionsForRole } from './rbac';

export const loadActorFromSession = async (db: DbClient, sessionId: string): Promise<Actor> => {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          memberships: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    throw new AuthenticationError();
  }

  const membership = session.user.memberships[0];
  if (!membership || !isServerUserRole(membership.role)) {
    throw new AuthenticationError('No workspace membership found.');
  }

  return {
    userId: session.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
    permissions: permissionsForRole(membership.role),
  };
};

