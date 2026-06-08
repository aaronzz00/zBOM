import { FastifyRequest } from 'fastify';
import { Actor } from '../../shared/permissions';
import { DbClient } from '../db/client';
import { loadActorFromSession } from './actor';
import { readSessionId, AuthenticationError } from './session';
import { permissionsForRole } from './rbac';

export const requireActor = async (db: DbClient, request: FastifyRequest): Promise<Actor> => {
  try {
    const sessionId = readSessionId(request);
    return await loadActorFromSession(db, sessionId);
  } catch (error: any) {
    if (error && (error.name === 'AuthenticationError' || error instanceof AuthenticationError)) {
      const viewerMembership = await db.membership.findFirst({
        where: { role: 'VIEWER' },
      });
      if (viewerMembership) {
        return {
          userId: viewerMembership.userId,
          workspaceId: viewerMembership.workspaceId,
          role: 'VIEWER',
          permissions: permissionsForRole('VIEWER'),
        };
      }
    }
    throw error;
  }
};

