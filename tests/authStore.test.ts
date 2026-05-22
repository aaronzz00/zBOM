import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../stores/useAuthStore';
import { Permission } from '../types';

describe('useAuthStore', () => {
    beforeEach(() => {
        // Reset store to initial state (ADMIN)
        useAuthStore.setState({
            currentUser: { id: 'u1', name: 'Alex Admin', email: 'alex@zbom.com', role: 'ADMIN', avatarInitials: 'AA' }
        });
    });

    it('should initialize with ADMIN user', () => {
        const { currentUser } = useAuthStore.getState();
        expect(currentUser.role).toBe('ADMIN');
    });

    it('should switch roles correctly', () => {
        const { switchRole } = useAuthStore.getState();
        switchRole('ENG_LEAD');
        const { currentUser } = useAuthStore.getState();
        expect(currentUser.role).toBe('ENG_LEAD');
    });

    it('should check permissions correctly', () => {
        const { hasPermission, switchRole } = useAuthStore.getState();

        // Admin has everything
        expect(hasPermission(Permission.EDIT_COST)).toBe(true);

        // Engineer cannot edit cost
        switchRole('ENG_LEAD');
        expect(useAuthStore.getState().hasPermission(Permission.EDIT_COST)).toBe(false);
        expect(useAuthStore.getState().hasPermission(Permission.EDIT_BOM_STRUCTURE)).toBe(true);
    });
});
