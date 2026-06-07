import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { SettingsPage } from '../pages/SettingsPage';
import { useAuthStore } from '../stores/useAuthStore';
import { useBOMStore } from '../stores/useBOMStore';
import { Permission, UserRole } from '../types';
import { mockProject, complexBOM, previousBOM } from '../data/mockBOM';
import { mockLibraryData } from '../data/mockLibrary';
import { mockSuppliers } from '../data/mockSuppliers';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(({ count }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }).map((_, index) => ({
        index,
        start: index * 40,
        size: 40,
        measureElement: () => {},
      })),
    getTotalSize: () => count * 40,
  })),
}));

const resetStores = () => {
  useAuthStore.getState().resetRolePermissions();
  useAuthStore.getState().switchRole('ADMIN');
  
  useBOMStore.setState({
    project: { ...JSON.parse(JSON.stringify(mockProject)), id: 'project-zphone-2026' },
    bomData: JSON.parse(JSON.stringify(complexBOM)),
    libraryParts: JSON.parse(JSON.stringify(mockLibraryData)),
    suppliers: JSON.parse(JSON.stringify(mockSuppliers)),
    snapshots: [{
      id: 'snap-001',
      name: 'Baseline (Rev A.01)',
      timestamp: new Date('2026-05-28T00:00:00.000Z').toISOString(),
      data: JSON.parse(JSON.stringify(previousBOM)),
    }],
  });
  
  // Clear any localStorage mappings
  localStorage.clear();
  useBOMStore.setState({
    projectFlowAssociations: {
      'project-zphone-2026': 'flow-standard',
      'project-zphone-lite-2026': 'flow-fast'
    }
  });
};

describe('Dynamic Configuration System', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('Dynamic Permissions Matrix', () => {
    it('initializes with default role-permissions and allows dynamic check/uncheck', () => {
      const { hasPermission, switchRole, updateRolePermissions } = useAuthStore.getState();
      
      // Default: Sourcing has VIEW_COST
      switchRole('SOURCING');
      expect(hasPermission(Permission.VIEW_COST)).toBe(true);

      // Sourcing has VIEW_COST removed dynamically
      updateRolePermissions('SOURCING', [Permission.VIEW_DASHBOARD, Permission.VIEW_BOM]);
      expect(hasPermission(Permission.VIEW_COST)).toBe(false);
      expect(hasPermission(Permission.VIEW_BOM)).toBe(true);
    });

    it('enforces the ADMIN safety lock preventing modification to Admin permissions', () => {
      const { hasPermission, updateRolePermissions } = useAuthStore.getState();
      
      // Admin has EDIT_COST
      expect(hasPermission(Permission.EDIT_COST)).toBe(true);

      // Attempt to strip Admin permissions to empty
      updateRolePermissions('ADMIN', []);
      
      // Admin must STILL have EDIT_COST and all other permissions
      expect(hasPermission(Permission.EDIT_COST)).toBe(true);
      expect(hasPermission(Permission.VIEW_ECO)).toBe(true);
    });

    it('renders the SettingsPage matrix and handles checkbox changes with Admin disabled', async () => {
      render(<SettingsPage />);
      
      expect(screen.getByText('Role Access Matrix')).toBeInTheDocument();
      
      // Check that Admin checkboxes are disabled
      const checkboxes = screen.getAllByRole('checkbox');
      
      // Admin checkboxes are disabled (Safety Lock)
      // The first column is Admin, so first checkbox corresponds to Admin
      expect(checkboxes[0]).toBeDisabled();
      expect(checkboxes[0]).toBeChecked();

      // Non-admin checkboxes should be enabled
      // Find a checkbox that represents Sourcing or Viewer
      // Let's locate the row for VIEW_COST and toggle Sourcing's check
      const viewCostRow = screen.getByText('VIEW COST').closest('tr');
      expect(viewCostRow).toBeInTheDocument();
      
      const sourcingCheckbox = within(viewCostRow!).getAllByRole('checkbox')[2]; // Column index 2 is Sourcing (0: Admin, 1: Engineer, 2: Sourcing, 3: Viewer)
      expect(sourcingCheckbox).toBeEnabled();
      expect(sourcingCheckbox).toBeChecked(); // Sourcing can view cost by default

      // Click it to uncheck
      act(() => {
        fireEvent.click(sourcingCheckbox);
      });
      expect(sourcingCheckbox).not.toBeChecked();

      // Store should reflect this change immediately
      useAuthStore.getState().switchRole('SOURCING');
      expect(useAuthStore.getState().hasPermission(Permission.VIEW_COST)).toBe(false);
    });
  });

  describe('Project Phase Transition Flows', () => {
    it('gates transition modal and requires checklist approvals to advance', async () => {
      // Ensure we are ENG_LEAD who can transition project phases by default
      useAuthStore.getState().switchRole('ENG_LEAD');

      render(<App />);

      // Verify header renders the clickable phase button
      const phaseBtn = screen.getByTitle('Click to transition project phase');
      expect(phaseBtn).toBeInTheDocument();
      expect(phaseBtn).toHaveTextContent('DVT');

      // Click phase button to open modal
      fireEvent.click(phaseBtn);
      expect(screen.getByRole('dialog', { name: /Advance Project Phase/i })).toBeInTheDocument();

      // Default next phase for Standard Flow is PVT
      const targetSelect = screen.getByLabelText('Target Phase');
      expect(targetSelect).toHaveValue('PVT');

      // Verify transition checklist requirements are listed
      // DVT -> PVT Checklist: ['Functional Testing Completed', 'Compliance Certificates Obtained', 'Tooling T1 Trials Completed']
      expect(screen.getByText('Functional Testing Completed')).toBeInTheDocument();
      expect(screen.getByText('Compliance Certificates Obtained')).toBeInTheDocument();
      expect(screen.getByText('Tooling T1 Trials Completed')).toBeInTheDocument();

      // Confirm button should be disabled initially
      const confirmBtn = screen.getByRole('button', { name: /Confirm Transition/i });
      expect(confirmBtn).toBeDisabled();

      // Check all requirements
      const checkBoxes = screen.getAllByRole('checkbox');
      checkBoxes.forEach((cb) => {
        fireEvent.click(cb);
      });

      // Confirm button should be enabled now
      expect(confirmBtn).toBeEnabled();

      // Confirm transition
      fireEvent.click(confirmBtn);

      // Modal should close and header should update project phase to PVT
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(screen.getByText('PVT')).toBeInTheDocument();
      expect(useBOMStore.getState().project.phase).toBe('PVT');
    });

    it('allows configuring new checklist requirements on Settings page', async () => {
      render(<SettingsPage />);

      // Switch to project phase flows tab
      fireEvent.click(screen.getByRole('button', { name: /Project Phase Flows & Checklists/i }));
      expect(screen.getByText('Project Associations')).toBeInTheDocument();
      expect(screen.getByText('Configure Flow Checklist')).toBeInTheDocument();

      // Select flow-standard to customize (already selected by default)
      // Let's add a new checklist item for EVT transition
      const tabEVT = screen.getByRole('button', { name: 'EVT' });
      fireEvent.click(tabEVT);

      // Type new item name
      const input = screen.getByPlaceholderText('Add new checklist requirement...');
      fireEvent.change(input, { target: { value: 'Thermal Simulation Approved' } });

      // Click add
      fireEvent.click(screen.getByRole('button', { name: /Add/i }));

      // Verify it appears in the list
      expect(screen.getByText('Thermal Simulation Approved')).toBeInTheDocument();

      // Verify the item is stored in the BOM store state
      const standardFlow = useBOMStore.getState().projectFlows.find(f => f.id === 'flow-standard');
      expect(standardFlow?.transitions.EVT.checklist).toContain('Thermal Simulation Approved');
    });
  });
});
