import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useBOMStore } from '../stores/useBOMStore';
import { useAuthStore } from '../stores/useAuthStore';
import { PartLibrary } from '../pages/PartLibrary';
import { BOMEditor } from '../pages/BOMEditor';
import { ComponentType, LifecycleState } from '../types';
import { mockProject, complexBOM, previousBOM } from '../data/mockBOM';
import { mockLibraryData } from '../data/mockLibrary';
import { mockSuppliers } from '../data/mockSuppliers';
import { coreRepository } from '../repositories/core/coreRepository';

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
  localStorage.clear();
  coreRepository.resetToSeed();
  useAuthStore.getState().switchRole('ADMIN');
  useBOMStore.setState({
    project: {
      id: 'PRJ-2024-001',
      name: 'zPhone Pro Max',
      code: 'ZPM-14',
      sku: 'Multi-SKU Config',
      phase: 'DVT',
      lastModified: '2024-05-20T14:30:00Z',
      totalCost: 142.50,
      totalWeight: 245.5
    },
    projects: [
      {
        id: 'PRJ-2024-001',
        name: 'zPhone Pro Max',
        code: 'ZPM-14',
        sku: 'Multi-SKU Config',
        phase: 'DVT',
        lastModified: '2024-05-20T14:30:00Z',
        totalCost: 142.50,
        totalWeight: 245.5
      }
    ],
    bomData: JSON.parse(JSON.stringify(complexBOM)),
    libraryParts: JSON.parse(JSON.stringify(mockLibraryData)),
    suppliers: JSON.parse(JSON.stringify(mockSuppliers)),
    enabledComponentTypes: [ComponentType.Assembly, ComponentType.Part, ComponentType.Material, ComponentType.Software],
    enabledLifecycleStates: [LifecycleState.Draft, LifecycleState.InReview, LifecycleState.Released, LifecycleState.Obsolete, LifecycleState.Prototype],
    warehouseLocations: ['WH-A', 'WH-B', 'WH-C'],
    complianceStandards: ['RoHS', 'REACH', 'UN38.3'],
    attributeDefs: [
      { id: 'attr-1', name: 'Material', key: 'material', type: 'text' },
      { id: 'attr-2', name: 'Finish', key: 'finish', type: 'text' },
      { id: 'attr-3', name: 'Torque Spec', key: 'torque', type: 'text' },
      { id: 'attr-4', name: 'Compliance', key: 'compliance', type: 'select', options: ['RoHS', 'REACH', 'UN38.3'] }
    ]
  });
};

describe('Configuration Dashboard & Scoping Integration Tests', () => {
  beforeEach(() => {
    resetStores();
  });

  it('seeds a new project in core storage with default BOM and root assembly', () => {
    // 1. Dispatch createProject action
    useBOMStore.getState().createProject({
      code: 'ZP27',
      name: 'zPhone 2027 Pro',
      sku: 'ZP27-US-Pro',
      flowId: 'flow-standard'
    });

    // 2. Retrieve projects list
    const state = useBOMStore.getState();
    const newProject = state.projects.find(p => p.code === 'ZP27');
    expect(newProject).toBeDefined();
    expect(newProject?.name).toBe('zPhone 2027 Pro');

    // 3. Check repository state to ensure it seeded root BOM and BOMNode
    const workspace = coreRepository.loadWorkspace();
    const projectInDb = workspace.projects.find(p => p.code === 'ZP27');
    expect(projectInDb).toBeDefined();

    const bomInDb = workspace.boms.find(b => b.projectId === projectInDb?.id);
    expect(bomInDb).toBeDefined();
    expect(bomInDb?.rootNodeId).toBeDefined();

    const rootNodeInDb = workspace.bomNodes.find(n => n.id === bomInDb?.rootNodeId);
    expect(rootNodeInDb).toBeDefined();
    expect(rootNodeInDb?.partNumber).toBe('800-ZP27-001');
    expect(rootNodeInDb?.name).toBe('Top Level Assembly, zPhone 2027 Pro');
    expect(rootNodeInDb?.type).toBe(ComponentType.Assembly);
  });

  it('scopes custom attributes correctly by project and component type', () => {
    // 1. Add scoped attribute: projectIdScope = 'PRJ-2024-001', componentTypeScope = [ComponentType.Software]
    const scopedDef = {
      id: 'scoped-attr',
      name: 'GitHub Repo URL',
      key: 'github_repo',
      type: 'text' as const,
      projectIdScope: 'PRJ-2024-001',
      componentTypeScope: [ComponentType.Software]
    };
    useBOMStore.getState().addAttributeDef(scopedDef);

    // 2. Render BOMEditor with custom tree structure
    const activeSoftwareNode = {
      id: 'software-node',
      partNumber: 'SW-10001',
      name: 'Bootloader',
      type: ComponentType.Software,
      quantity: 1,
      unit: 'EA',
      cost: 0,
      currency: 'USD',
      state: LifecycleState.Released,
      customAttributes: {
        'github_repo': 'https://github.com/zbom/bootloader'
      }
    };

    const activePartNode = {
      id: 'part-node',
      partNumber: 'R-0402-10K-1',
      name: 'Resistor',
      type: ComponentType.Part,
      quantity: 1,
      unit: 'EA',
      cost: 0.002,
      currency: 'USD',
      state: LifecycleState.Released,
      customAttributes: {
        'github_repo': 'https://github.com/zbom/resistor'
      }
    };

    const customTree = {
      ...complexBOM,
      children: [activeSoftwareNode, activePartNode]
    };
    useBOMStore.setState({ bomData: customTree });

    // 3. Mount BOMEditor
    const { rerender } = render(<BOMEditor />);

    // Select Software node
    fireEvent.click(screen.getByText('SW-10001'));
    // In BOMEditor side panel details, "GitHub Repo URL" label and input should be visible (2 occurrences: table header column and edit label)
    expect(screen.getAllByText('GitHub Repo URL').length).toBe(2);
    expect(screen.getByPlaceholderText(/Enter GitHub Repo URL.../i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter GitHub Repo URL.../i)).toHaveValue('https://github.com/zbom/bootloader');

    // Now select Part node
    fireEvent.click(screen.getByText('R-0402-10K-1'));
    // In BOMEditor side panel details, "GitHub Repo URL" should NOT be visible since it is type-scoped to Software (only 1 occurrence in table header column)
    expect(screen.getAllByText('GitHub Repo URL').length).toBe(1);

    // Now test project scoping: change project to a different project
    useBOMStore.setState({
      project: {
        id: 'PRJ-OTHER',
        name: 'Other Project',
        code: 'ZP-OTHER',
        sku: 'OTHER-SKU',
        phase: 'EVT',
        lastModified: '2026-06-06T12:00:00Z',
        totalCost: 10
      }
    });

    rerender(<BOMEditor />);
    // Select Software node again
    fireEvent.click(screen.getByText('SW-10001'));
    // "GitHub Repo URL" should NOT be visible anywhere (0 occurrences since project scope doesn't match)
    expect(screen.queryAllByText('GitHub Repo URL').length).toBe(0);
  });

  it('updates Part Library selectors when active warehouse zones or component types/states are toggled', () => {
    // 1. Mount PartLibrary
    const { rerender } = render(<PartLibrary />);

    // WH-A, WH-B, WH-C should be visible in the sidebar filter zones
    expect(screen.getByLabelText('WH-A Zone')).toBeInTheDocument();
    expect(screen.getByLabelText('WH-B Zone')).toBeInTheDocument();
    expect(screen.getByLabelText('WH-C Zone')).toBeInTheDocument();

    // 2. Change dynamic warehouse locations in the store (remove WH-C, add WH-D)
    useBOMStore.setState({
      warehouseLocations: ['WH-A', 'WH-B', 'WH-D']
    });

    // Rerender PartLibrary
    rerender(<PartLibrary />);

    // WH-C should NOT be visible, and WH-D should be visible!
    expect(screen.queryByLabelText('WH-C Zone')).not.toBeInTheDocument();
    expect(screen.getByLabelText('WH-D Zone')).toBeInTheDocument();

    // 3. Test component category and lifecycle state sidebar filter toggles
    // De-activate Software type
    useBOMStore.setState({
      enabledComponentTypes: [ComponentType.Assembly, ComponentType.Part, ComponentType.Material]
    });
    rerender(<PartLibrary />);
    // Category 'Software' should no longer be visible in the list of filters!
    expect(screen.queryByRole('button', { name: /Software/i })).not.toBeInTheDocument();

    // De-activate InReview lifecycle state
    useBOMStore.setState({
      enabledLifecycleStates: [LifecycleState.Draft, LifecycleState.Released, LifecycleState.Obsolete]
    });
    rerender(<PartLibrary />);
    // State 'In Review' should no longer be visible in the lifecycle filters list!
    expect(screen.queryByRole('button', { name: /In Review/i })).not.toBeInTheDocument();
  });
});
