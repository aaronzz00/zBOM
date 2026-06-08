import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isServerUserRole } from '../../shared/permissions';
import { loadActorFromSession } from '../auth/actor';
import { clearSessionCookie, createSession, readSessionId, setSessionCookie, AuthenticationError } from '../auth/session';
import { DbClient } from '../db/client';
import { checkLarkCliAuth, loadLarkMappings } from '../auth/lark';
import { permissionsForRole } from '../auth/rbac';

interface AuthRouteOptions {
  db: DbClient;
}

const devLoginSchema = z.object({
  role: z.enum(['ADMIN', 'ENG_LEAD', 'SOURCING', 'VIEWER']),
});

export const authRoutes: FastifyPluginAsync<AuthRouteOptions> = async (app, options) => {
  app.post('/dev-login', async (request, reply) => {
    const parsed = devLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'Invalid dev login payload.',
        statusCode: 400,
      });
    }
    const body = parsed.data;

    const membership = await options.db.membership.findFirst({
      where: { role: body.role },
      include: { user: true, workspace: true },
    });

    if (!membership || !isServerUserRole(membership.role)) {
      return reply.status(404).send({
        error: 'NotFound',
        message: `No dev user found for role ${body.role}.`,
        statusCode: 404,
      });
    }

    const session = await createSession(options.db, membership.userId);
    setSessionCookie(reply, session.id);

    return {
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
      },
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
      },
      actor: await loadActorFromSession(options.db, session.id),
    };
  });

  app.post('/logout', async (request, reply) => {
    const sessionId = request.cookies.zbom_session;
    if (sessionId) {
      await options.db.session.deleteMany({ where: { id: sessionId } });
    }
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/me', async (request, reply) => {
    let sessionId: string | undefined;
    try {
      sessionId = request.cookies.zbom_session;
    } catch {
      // ignore
    }

    if (sessionId) {
      try {
        const actor = await loadActorFromSession(options.db, sessionId);
        const user = await options.db.user.findUniqueOrThrow({
          where: { id: actor.userId },
        });
        const workspace = await options.db.workspace.findUniqueOrThrow({
          where: { id: actor.workspaceId },
        });

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          workspace: {
            id: workspace.id,
            name: workspace.name,
          },
          actor,
        };
      } catch (error) {
        clearSessionCookie(reply);
      }
    }

    // Try lark-cli auth
    const larkUser = await checkLarkCliAuth();
    if (larkUser) {
      const config = await loadLarkMappings();
      const mapping = config?.mappings?.[larkUser.openId];
      if (mapping) {
        const membership = await options.db.membership.findFirst({
          where: { userId: mapping.userId },
          include: { user: true, workspace: true },
        });

        if (membership && isServerUserRole(membership.role)) {
          const session = await createSession(options.db, membership.userId);
          setSessionCookie(reply, session.id);
          const actor = await loadActorFromSession(options.db, session.id);
          return {
            user: {
              id: membership.user.id,
              email: membership.user.email,
              name: membership.user.name,
            },
            workspace: {
              id: membership.workspace.id,
              name: membership.workspace.name,
            },
            actor,
          };
        }
      }
    }

    // Default Fallback: VIEWER
    const viewerMembership = await options.db.membership.findFirst({
      where: { role: 'VIEWER' },
      include: { user: true, workspace: true },
    });

    if (!viewerMembership) {
      throw new AuthenticationError('No default viewer role configuration found.');
    }

    return {
      user: {
        id: viewerMembership.user.id,
        email: viewerMembership.user.email,
        name: viewerMembership.user.name,
      },
      workspace: {
        id: viewerMembership.workspace.id,
        name: viewerMembership.workspace.name,
      },
      actor: {
        userId: viewerMembership.userId,
        workspaceId: viewerMembership.workspaceId,
        role: viewerMembership.role as any,
        permissions: permissionsForRole(viewerMembership.role as any),
      },
    };
  });
};
