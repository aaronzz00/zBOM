import React from 'react';
import { useAuthStore } from '../stores/useAuthStore';

// Deprecated: Provider is no longer needed with Zustand, but kept for compatibility if needed.
// Ideally remove from index.tsx
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Facade hook to maintain API compatibility
export const useAuth = () => {
  const store = useAuthStore();
  return {
    currentUser: store.currentUser,
    switchRole: store.switchRole,
    hasPermission: store.hasPermission,
    rolePermissions: store.rolePermissions,
    updateRolePermissions: store.updateRolePermissions,
    resetRolePermissions: store.resetRolePermissions,
  };
};