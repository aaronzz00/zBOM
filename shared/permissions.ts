export type ServerUserRole = 'ADMIN' | 'ENG_LEAD' | 'SOURCING' | 'VIEWER';

export type ServerPermission =
  | 'VIEW_BOM'
  | 'EDIT_BOM_STRUCTURE'
  | 'EDIT_BOM_METADATA'
  | 'EDIT_COST'
  | 'EDIT_COMMERCIAL_FIELDS'
  | 'MANAGE_AVL'
  | 'MANAGE_TOOLING'
  | 'TRANSITION_PROJECT_PHASE'
  | 'MANAGE_AI_PROVIDER';

export interface Actor {
  userId: string;
  workspaceId: string;
  role: ServerUserRole;
  permissions: ServerPermission[];
}

export const ROLE_PERMISSIONS: Record<ServerUserRole, ServerPermission[]> = {
  ADMIN: [
    'VIEW_BOM',
    'EDIT_BOM_STRUCTURE',
    'EDIT_BOM_METADATA',
    'EDIT_COST',
    'EDIT_COMMERCIAL_FIELDS',
    'MANAGE_AVL',
    'MANAGE_TOOLING',
    'TRANSITION_PROJECT_PHASE',
    'MANAGE_AI_PROVIDER',
  ],
  ENG_LEAD: [
    'VIEW_BOM',
    'EDIT_BOM_STRUCTURE',
    'EDIT_BOM_METADATA',
    'MANAGE_TOOLING',
    'TRANSITION_PROJECT_PHASE',
  ],
  SOURCING: [
    'VIEW_BOM',
    'EDIT_COST',
    'EDIT_COMMERCIAL_FIELDS',
    'MANAGE_AVL',
  ],
  VIEWER: ['VIEW_BOM'],
};

export const isServerUserRole = (value: string): value is ServerUserRole => {
  return value === 'ADMIN' || value === 'ENG_LEAD' || value === 'SOURCING' || value === 'VIEWER';
};

