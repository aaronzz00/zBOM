import React from 'react';
import { useBOMStore } from '../stores/useBOMStore';

// Deprecated: Provider facade for Zustand Store
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Facade hook
export const useAppStore = () => {
  // We bind all state and actions. 
  // In a real optimized app, we would use selectors, but for migration compatibility we return everything.
  return useBOMStore();
};