import { Permission, UserRole } from '../../types';
import type { CoreActor } from '../../domain/coreTypes';
import { CoreRepositoryError } from '../../domain/coreTypes';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: Object.values(Permission),
  ENG_LEAD: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_BOM,
    Permission.VIEW_ECO,
    Permission.EDIT_BOM_STRUCTURE,
    Permission.EDIT_BOM_METADATA,
    Permission.CREATE_ECO,
    Permission.EDIT_EBOM_ARCHITECTURE,
    Permission.MANAGE_SKU_LIFECYCLE,
    Permission.MANAGE_TOOLING,
  ],
  SOURCING: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_BOM,
    Permission.VIEW_SUPPLY_CHAIN,
    Permission.VIEW_COST,
    Permission.VIEW_COMMERCIAL_FIELDS,
    Permission.VIEW_SUPPLIER_RISK,
    Permission.EDIT_COST,
    Permission.EDIT_COMMERCIAL_FIELDS,
    Permission.MANAGE_AVL,
  ],
  VIEWER: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_BOM,
    Permission.VIEW_ECO,
  ],
};

export const SYSTEM_ACTOR: CoreActor = {
  userId: 'system',
  name: 'System',
  role: 'ADMIN',
};

export function hasCorePermission(actor: CoreActor, permission: Permission) {
  return ROLE_PERMISSIONS[actor.role].includes(permission);
}

export function requireCorePermission(actor: CoreActor, permission: Permission, action: string) {
  if (!hasCorePermission(actor, permission)) {
    throw new CoreRepositoryError(
      'PERMISSION_DENIED',
      `${actor.role} cannot ${action}.`,
      { role: actor.role, permission, action },
    );
  }
}

export function assertCanUpdatePartFields(actor: CoreActor, updates: Record<string, unknown>) {
  const commercialFields = new Set([
    'cost',
    'stock',
    'minStock',
    'supplierId',
    'leadTimeWeeks',
    'moq',
    'spq',
    'pricingTiers',
    'location',
  ]);
  const engineeringFields = new Set([
    'partNumber',
    'description',
    'category',
    'state',
    'type',
    'manufacturer',
    'mpn',
    'weightG',
    'customAttributes',
    'attachments',
    'active',
  ]);

  const keys = Object.keys(updates);
  if (keys.some((key) => commercialFields.has(key))) {
    requireCorePermission(actor, Permission.EDIT_COMMERCIAL_FIELDS, 'update commercial part fields');
  }
  if (keys.some((key) => engineeringFields.has(key))) {
    requireCorePermission(actor, Permission.EDIT_BOM_METADATA, 'update engineering part fields');
  }
}
