import React, { createContext, useContext, useState, useMemo } from 'react';
import { User, UserRole, Permission } from '../types';

// Mock Users
const MOCK_USERS: Record<UserRole, User> = {
  ADMIN: { id: 'u1', name: 'Alex Admin', email: 'alex@zbom.com', role: 'ADMIN', avatarInitials: 'AA' },
  ENG_LEAD: { id: 'u2', name: 'Sarah Engineer', email: 'sarah@zbom.com', role: 'ENG_LEAD', avatarInitials: 'SE' },
  SOURCING: { id: 'u3', name: 'Mike Procurement', email: 'mike@zbom.com', role: 'SOURCING', avatarInitials: 'MP' },
  VIEWER: { id: 'u4', name: 'Guest Viewer', email: 'guest@zbom.com', role: 'VIEWER', avatarInitials: 'GV' },
};

// Role-Permission Matrix
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: Object.values(Permission), // All permissions
  ENG_LEAD: [
    Permission.VIEW_DASHBOARD, 
    Permission.VIEW_BOM, 
    Permission.EDIT_BOM_STRUCTURE, 
    Permission.EDIT_BOM_METADATA,
    // Engineer CANNOT view cost or manage AVL commercially
  ],
  SOURCING: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_BOM,
    Permission.VIEW_SUPPLY_CHAIN,
    Permission.VIEW_COST,
    Permission.VIEW_SUPPLIER_RISK,
    Permission.EDIT_COST,
    Permission.MANAGE_AVL,
    // Sourcing CANNOT edit structure (add/remove parts)
  ],
  VIEWER: [
    Permission.VIEW_DASHBOARD,
    Permission.VIEW_BOM
    // Read only, no cost visibility
  ]
};

interface AuthContextType {
  currentUser: User;
  switchRole: (role: UserRole) => void;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to ADMIN for initial state
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USERS.ADMIN);

  const switchRole = (role: UserRole) => {
    setCurrentUser(MOCK_USERS[role]);
  };

  const hasPermission = (permission: Permission): boolean => {
    const perms = ROLE_PERMISSIONS[currentUser.role];
    return perms.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ currentUser, switchRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};