import { create } from 'zustand';
import { User, UserRole, Permission } from '../types';

// Mock Users (Copied from AuthContext)
const MOCK_USERS: Record<UserRole, User> = {
    ADMIN: { id: 'u1', name: 'Alex Admin', email: 'alex@zbom.com', role: 'ADMIN', avatarInitials: 'AA' },
    ENG_LEAD: { id: 'u2', name: 'Sarah Engineer', email: 'sarah@zbom.com', role: 'ENG_LEAD', avatarInitials: 'SE' },
    SOURCING: { id: 'u3', name: 'Mike Procurement', email: 'mike@zbom.com', role: 'SOURCING', avatarInitials: 'MP' },
    VIEWER: { id: 'u4', name: 'Guest Viewer', email: 'guest@zbom.com', role: 'VIEWER', avatarInitials: 'GV' },
};

// Role-Permission Matrix (Copied from AuthContext)
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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

interface AuthState {
    currentUser: User;
    switchRole: (role: UserRole) => void;
    hasPermission: (permission: Permission) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    currentUser: MOCK_USERS.ADMIN,

    switchRole: (role: UserRole) => {
        set({ currentUser: MOCK_USERS[role] });
    },

    hasPermission: (permission: Permission) => {
        const { currentUser } = get();
        const perms = ROLE_PERMISSIONS[currentUser.role];
        return perms.includes(permission);
    }
}));
