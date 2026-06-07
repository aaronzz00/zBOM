import { create } from 'zustand';
import { User, UserRole, Permission } from '../types';

// Mock Users (Copied from AuthContext)
const MOCK_USERS: Record<UserRole, User> = {
    ADMIN: { id: 'u1', name: 'Alex Admin', email: 'alex@zbom.com', role: 'ADMIN', avatarInitials: 'AA' },
    ENG_LEAD: { id: 'u2', name: 'Sarah Engineer', email: 'sarah@zbom.com', role: 'ENG_LEAD', avatarInitials: 'SE' },
    SOURCING: { id: 'u3', name: 'Mike Procurement', email: 'mike@zbom.com', role: 'SOURCING', avatarInitials: 'MP' },
    VIEWER: { id: 'u4', name: 'Guest Viewer', email: 'guest@zbom.com', role: 'VIEWER', avatarInitials: 'GV' },
};

// Default Role-Permission Matrix
const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    ADMIN: Object.values(Permission), // All permissions
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
        Permission.TRANSITION_PROJECT_PHASE,
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
        Permission.VIEW_ECO
    ]
};

const STORAGE_KEY = 'zbom.auth.role_permissions';

const loadSavedPermissions = (): Record<UserRole, Permission[]> => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved) as Record<UserRole, Permission[]>;
            // Ensure ADMIN always has all permissions (Safety Lock)
            parsed.ADMIN = Object.values(Permission);
            return parsed;
        }
    } catch (e) {
        console.error('Failed to load role permissions', e);
    }
    return { ...DEFAULT_ROLE_PERMISSIONS };
};

interface AuthState {
    currentUser: User;
    rolePermissions: Record<UserRole, Permission[]>;
    switchRole: (role: UserRole) => void;
    hasPermission: (permission: Permission) => boolean;
    updateRolePermissions: (role: UserRole, permissions: Permission[]) => void;
    resetRolePermissions: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    currentUser: MOCK_USERS.ADMIN,
    rolePermissions: loadSavedPermissions(),

    switchRole: (role: UserRole) => {
        set({ currentUser: MOCK_USERS[role] });
    },

    hasPermission: (permission: Permission) => {
        const { currentUser, rolePermissions } = get();
        const perms = rolePermissions[currentUser.role] || [];
        return perms.includes(permission);
    },

    updateRolePermissions: (role: UserRole, permissions: Permission[]) => {
        if (role === 'ADMIN') {
            // Safety Lock: Do not allow modifying ADMIN role permissions
            return;
        }
        const updated = {
            ...get().rolePermissions,
            [role]: permissions,
        };
        // Always ensure ADMIN is fully locked
        updated.ADMIN = Object.values(Permission);

        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        set({ rolePermissions: updated });
    },

    resetRolePermissions: () => {
        localStorage.removeItem(STORAGE_KEY);
        set({ rolePermissions: { ...DEFAULT_ROLE_PERMISSIONS } });
    }
}));
