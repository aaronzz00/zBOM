import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../App';
import { BOMCompare } from '../pages/BOMCompare';
import { BOMEditor } from '../pages/BOMEditor';
import { EBOMArchitectureWorkspace } from '../pages/EBOMArchitectureWorkspace';
import { ECOManager } from '../pages/ECOManager';
import { PartLibrary } from '../pages/PartLibrary';
import { ProductMatrixCenter } from '../pages/ProductMatrixCenter';
import { SupplyChain } from '../pages/SupplyChain';
import { complexBOM, mockProject, previousBOM } from '../data/mockBOM';
import { mockLibraryData } from '../data/mockLibrary';
import { mockSuppliers } from '../data/mockSuppliers';
import { createInMemoryEBOMArchitectureRepository } from '../repositories/ebomArchitectureRepository';
import { useAuthStore } from '../stores/useAuthStore';
import { useBOMStore } from '../stores/useBOMStore';
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';
import { useMBOMDeltaStore } from '../stores/useMBOMDeltaStore';
import { useProductConfigStore } from '../stores/useProductConfigStore';
import { useToolingStore } from '../stores/useToolingStore';

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
  useAuthStore.getState().switchRole('ADMIN');
  useBOMStore.setState({
    project: JSON.parse(JSON.stringify(mockProject)),
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
  useProductConfigStore.getState().reset();
  useMBOMDeltaStore.getState().reset();
  useToolingStore.getState().reset();
  useEBOMArchitectureStore.getState().reset();
  useEBOMArchitectureStore.getState().setRepository(createInMemoryEBOMArchitectureRepository());
};

describe('role use-case frontend standards', () => {
  beforeEach(() => {
    resetStores();
  });

  it('binds the header identity to the selected user and hides QA chrome by default', () => {
    useAuthStore.getState().switchRole('SOURCING');

    render(<App />);

    expect(screen.getAllByText('Mike Procurement').length).toBeGreaterThan(0);
    expect(screen.queryByText('Alex Chen')).not.toBeInTheDocument();
    expect(screen.queryByText('开启 UI 标注模式')).not.toBeInTheDocument();
  });

  it('prevents Viewer from seeing commercial costs in Part Library', () => {
    useAuthStore.getState().switchRole('VIEWER');

    render(<PartLibrary />);

    expect(screen.getByText('Part Number')).toBeInTheDocument();
    expect(screen.queryByText('$35.000')).not.toBeInTheDocument();
    expect(screen.queryByText('$18.000')).not.toBeInTheDocument();
    expect(screen.getAllByText('Restricted').length).toBeGreaterThan(0);
  });

  it('lets Sourcing maintain commercial fields in Part Library', () => {
    useAuthStore.getState().switchRole('SOURCING');

    render(<PartLibrary />);

    fireEvent.change(screen.getByPlaceholderText('Search by Part Number, MPN, Description...'), {
      target: { value: 'resistor' },
    });
    fireEvent.click(screen.getByText('R-0402-10K-1'));

    expect(screen.getByText('Edit Part')).toBeInTheDocument();
    expect(screen.queryByText(/do not have permission/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Unit Cost ($)')).toBeEnabled();
    expect(screen.getByLabelText('Lead Time (Wks)')).toBeEnabled();
    expect(screen.getByLabelText('Supplier')).toBeEnabled();
    expect(screen.getByLabelText('MOQ')).toBeEnabled();
    expect(screen.getByLabelText('SPQ')).toBeEnabled();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
  });

  it('filters Supply Chain rows and shows a no-match state', () => {
    useAuthStore.getState().switchRole('SOURCING');

    render(<SupplyChain />);

    fireEvent.change(screen.getByPlaceholderText('Search...'), {
      target: { value: 'zzzz-no-supplier' },
    });

    expect(screen.queryByText('Qualcomm')).not.toBeInTheDocument();
    expect(screen.getByText(/No suppliers found/i)).toBeInTheDocument();
  });

  it('disables Product Matrix lifecycle actions for Viewer', () => {
    useAuthStore.getState().switchRole('VIEWER');

    render(<ProductMatrixCenter />);

    const skuRow = screen.getByTestId('sku-row-sku-zp-a-pro-blk-us-rtl');
    expect(within(skuRow).getByTestId('activate-sku-zp-a-pro-blk-us-rtl')).toBeDisabled();
    expect(within(skuRow).getByRole('button', { name: /Freeze/i })).toBeDisabled();
    expect(within(skuRow).getByRole('button', { name: /Suppress/i })).toBeDisabled();
    expect(within(skuRow).getByTestId('select-workflow-sku-zp-a-pro-blk-us-rtl')).toBeDisabled();
  });

  it('disables EBOM Architecture mutation controls for Viewer', async () => {
    useAuthStore.getState().switchRole('VIEWER');

    render(<EBOMArchitectureWorkspace />);

    await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Edit ZP-A-STD-0000/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add Local Item/i })).toBeDisabled();
  });

  it('lets Admin create a local BOM item from the Add flow', () => {
    render(<BOMEditor />);

    fireEvent.click(screen.getByRole('button', { name: /Add Item/i }));
    fireEvent.change(screen.getByLabelText('Part Number'), {
      target: { value: '900-TEST-001' },
    });
    fireEvent.change(screen.getByLabelText('Item Name'), {
      target: { value: 'QA Test Bracket' },
    });
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Item/i }));

    expect(screen.getAllByText('900-TEST-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText('QA Test Bracket').length).toBeGreaterThan(0);
  });

  it('lets Admin create a deterministic ECO draft from the plus button', () => {
    render(<ECOManager />);

    fireEvent.click(screen.getByRole('button', { name: /Create change order/i }));

    expect(screen.getAllByText('ECO-2024-DRAFT-003').length).toBeGreaterThan(0);
    expect(screen.getByText('Draft change order created from current BOM context.')).toBeInTheDocument();
  });

  it('turns Supply Chain reports and audit buttons into deterministic previews', () => {
    useAuthStore.getState().switchRole('SOURCING');

    render(<SupplyChain />);

    expect(screen.getByText(/Simulated insight/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Risk Report/i }));
    expect(screen.getByRole('dialog', { name: /Risk Report Preview/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Close preview/i }));

    fireEvent.click(screen.getByRole('button', { name: /Supplier Audit/i }));
    expect(screen.getByRole('dialog', { name: /Supplier Audit Plan/i })).toBeInTheDocument();
  });

  it('turns Compare export into a visible report summary and masks cost for Viewer', () => {
    const { unmount } = render(<BOMCompare />);

    fireEvent.click(screen.getByRole('button', { name: /Export Report/i }));
    expect(screen.getByRole('dialog', { name: /Export Report Ready/i })).toBeInTheDocument();

    unmount();
    resetStores();
    useAuthStore.getState().switchRole('VIEWER');
    render(<BOMCompare />);

    expect(screen.queryByText(/\$\d/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Restricted').length).toBeGreaterThan(0);
  });

  it('lets Admin create a Part Library draft from the Create Part flow', () => {
    render(<PartLibrary />);

    fireEvent.click(screen.getByRole('button', { name: /Create Part/i }));
    fireEvent.change(screen.getByLabelText('Part Number'), {
      target: { value: 'LIB-TEST-001' },
    });
    fireEvent.change(screen.getByLabelText('MPN'), {
      target: { value: 'MPN-TEST-001' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Library test fixture' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Library Part/i }));

    expect(screen.getByText('LIB-TEST-001')).toBeInTheDocument();
    expect(screen.getByText('Library test fixture')).toBeInTheDocument();
  });

  it('routes Settings and ERP Connect to actionable setup pages', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(screen.getByText('System Settings')).toBeInTheDocument();
    expect(screen.getByText(/Role access and application preferences/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ERP Connect/i }));
    expect(screen.getByText('ERP Connector Setup')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mock integration checklist' })).toBeInTheDocument();
  });
});
