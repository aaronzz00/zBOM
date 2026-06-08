import { Actor, ROLE_PERMISSIONS, ServerPermission, ServerUserRole } from '../../shared/permissions';

export class AuthorizationError extends Error {
  statusCode = 403;

  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export const permissionsForRole = (role: ServerUserRole): ServerPermission[] => {
  return ROLE_PERMISSIONS[role];
};

export const actorHasPermission = (actor: Actor, permission: ServerPermission): boolean => {
  return actor.permissions.includes(permission);
};

export const assertPermission = (actor: Actor, permission: ServerPermission) => {
  if (!actorHasPermission(actor, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
};

