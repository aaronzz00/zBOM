import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EBOMArchitectureWorkspace } from '../pages/EBOMArchitectureWorkspace';
import { MBOMDeltaConsole } from '../pages/MBOMDeltaConsole';
import { ToolingHub } from '../pages/ToolingHub';
import { createInMemoryEBOMArchitectureRepository } from '../repositories/ebomArchitectureRepository';
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';
import { useMBOMDeltaStore } from '../stores/useMBOMDeltaStore';
import { useProductConfigStore } from '../stores/useProductConfigStore';
import { useToolingStore } from '../stores/useToolingStore';
import type { EBOMBase, EBOMItem } from '../domain/ebomArchitectureTypes';

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

describe('Phase 1 workflow pages', () => {
  beforeEach(() => {
    useProductConfigStore.getState().reset();
    useMBOMDeltaStore.getState().reset();
    useToolingStore.getState().reset();
    useEBOMArchitectureStore.getState().reset();
    useEBOMArchitectureStore.getState().setRepository(createInMemoryEBOMArchitectureRepository());
  });

  it('renders EBOM architecture inheritance chain and resolved item states', async () => {
    render(<EBOMArchitectureWorkspace />);

    expect(screen.getByText(/Loading EBOM architecture/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());
    expect(screen.getByText(/Draft Status/i)).toBeInTheDocument();

    const baseSelect = screen.getByRole('combobox', { name: 'EBOM Base' }) as HTMLSelectElement;
    const preview = screen.getByTestId('legacy-bom-preview');

    expect(screen.getAllByText('ebom-platform-zp26').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ebom-series-zp-a').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ebom-structure-zp-a-std').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ZP26-3200').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Battery Pack, 4500mAh').length).toBeGreaterThan(0);
    expect(screen.getByText('locked')).toBeInTheDocument();
    expect(screen.getByText('Legacy BOM Preview')).toBeInTheDocument();
    expect(screen.getByText(/Read-only projection/i)).toBeInTheDocument();
    expect(within(preview).getByText(/Virtual Tree View/i)).toBeInTheDocument();
    expect(within(preview).getAllByText('ZP26-3200').length).toBeGreaterThan(0);
    expect(within(preview).queryByText('Columns')).not.toBeInTheDocument();
    expect(within(preview).queryByTitle('Where Used')).not.toBeInTheDocument();

    fireEvent.change(baseSelect, { target: { value: 'ebom-structure-zp-a-pro' } });

    expect(baseSelect.value).toBe('ebom-structure-zp-a-pro');
    expect(screen.getAllByText('Display Module, ProMotion OLED').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('legacy-bom-preview')).getAllByText('Camera Module, Triple Lens Pro').length).toBeGreaterThan(0);
  });

  it('shows a recoverable EBOM load error', async () => {
    const repository = createInMemoryEBOMArchitectureRepository();
    repository.loadSnapshot = async () => {
      throw new Error('load failed');
    };
    useEBOMArchitectureStore.getState().setRepository(repository);

    render(<EBOMArchitectureWorkspace />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('load failed'));
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('shows a resolver error without crashing the page', async () => {
    const cyclicBases: EBOMBase[] = [
      {
        id: 'base-a',
        projectId: 'project',
        scope: 'platform',
        parentBaseId: 'base-c',
        rootItemId: 'item-a',
        revision: 'A',
        status: 'draft',
      },
      {
        id: 'base-b',
        projectId: 'project',
        scope: 'series',
        parentBaseId: 'base-a',
        rootItemId: 'item-b',
        revision: 'A',
        status: 'draft',
      },
      {
        id: 'base-c',
        projectId: 'project',
        scope: 'structure',
        parentBaseId: 'base-b',
        rootItemId: 'item-c',
        revision: 'A',
        status: 'draft',
      },
    ];
    const items: EBOMItem[] = [
      {
        id: 'item-a',
        baseId: 'base-a',
        partNumber: 'A-ROOT',
        name: 'A Root',
        quantity: 1,
        unit: 'EA',
        revision: 'A',
        inheritanceState: 'local',
      },
    ];
    useEBOMArchitectureStore.getState().setRepository(
      createInMemoryEBOMArchitectureRepository({ bases: cyclicBases, items }),
    );

    render(<EBOMArchitectureWorkspace />);

    await waitFor(() => expect(screen.getByText(/Unable to resolve EBOM items/i)).toBeInTheDocument());
  });

  it('keeps resolved rows visible when legacy preview cannot be built', async () => {
    const bases: EBOMBase[] = [
      {
        id: 'ebom-structure-zp-a-std',
        projectId: 'project',
        scope: 'structure',
        rootItemId: 'root',
        revision: 'A',
        status: 'draft',
      },
    ];
    const items: EBOMItem[] = [
      {
        id: 'root',
        baseId: 'ebom-structure-zp-a-std',
        parentItemId: 'child-b',
        partNumber: 'ROOT',
        name: 'Root',
        quantity: 1,
        unit: 'EA',
        revision: 'A',
        inheritanceState: 'local',
      },
      {
        id: 'child-a',
        baseId: 'ebom-structure-zp-a-std',
        parentItemId: 'root',
        partNumber: 'CHILD-A',
        name: 'Child A',
        quantity: 1,
        unit: 'EA',
        revision: 'A',
        inheritanceState: 'local',
      },
      {
        id: 'child-b',
        baseId: 'ebom-structure-zp-a-std',
        parentItemId: 'child-a',
        partNumber: 'CHILD-B',
        name: 'Child B',
        quantity: 1,
        unit: 'EA',
        revision: 'A',
        inheritanceState: 'local',
      },
    ];
    useEBOMArchitectureStore.getState().setRepository(
      createInMemoryEBOMArchitectureRepository({ bases, items }),
    );

    render(<EBOMArchitectureWorkspace />);

    await waitFor(() => expect(screen.getByText('ROOT')).toBeInTheDocument());
    expect(screen.getByText(/Unable to build legacy BOM preview/i)).toBeInTheDocument();
  });

  it('edits inherited EBOM fields, updates the change package, and publishes', async () => {
    render(<EBOMArchitectureWorkspace />);
    await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Edit ZP26-4100/i }));
    fireEvent.change(screen.getByLabelText('Part Number'), { target: { value: 'ZP26-4100-EDIT' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Edited Display Module' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'SET' } });
    fireEvent.change(screen.getByLabelText('Revision'), { target: { value: 'B' } });
    fireEvent.change(screen.getByLabelText('Design Master Part'), {
      target: { value: 'dmp-edited-display' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Apply Override/i }));

    await waitFor(() => expect(screen.getAllByText('6 pending').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/override-field/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('ZP26-4100-EDIT').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Edited Display Module').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 SET').length).toBeGreaterThan(0);
    expect(screen.getAllByText('B').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Publish Change Package/i }));

    await waitFor(() => expect(screen.getAllByText('Clean').length).toBeGreaterThan(0));
    expect(screen.getAllByText('review').length).toBeGreaterThan(0);
  });

  it('adds a local child item from the EBOM edit workflow', async () => {
    render(<EBOMArchitectureWorkspace />);
    await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Add Local Item/i }));
    fireEvent.change(screen.getByLabelText('Local Part Number'), {
      target: { value: 'ZP-A-STD-9900' },
    });
    fireEvent.change(screen.getByLabelText('Local Name'), {
      target: { value: 'Local Test Fixture' },
    });
    fireEvent.change(screen.getByLabelText('Local Quantity'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Local Unit'), { target: { value: 'EA' } });
    fireEvent.change(screen.getByLabelText('Local Revision'), { target: { value: 'A' } });
    fireEvent.change(screen.getByLabelText('Local Design Master Part'), {
      target: { value: 'dmp-local-test-fixture' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Local Item/i }));

    await waitFor(() => expect(screen.getAllByText('1 pending').length).toBeGreaterThan(0));
    expect(screen.getAllByText('ZP-A-STD-9900').length).toBeGreaterThan(0);
    expect(screen.getByText(/add-local-item/i)).toBeInTheDocument();
  });

  it('locks, unlocks, and reverts an EBOM item draft from the edit panel', async () => {
    render(<EBOMArchitectureWorkspace />);
    await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Edit ZP26-4100/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Lock Quantity$/i }));
    await waitFor(() => expect(screen.getByText(/lock-field/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Unlock Quantity$/i }));
    await waitFor(() => expect(screen.getByText(/unlock-field/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Override/i }));
    fireEvent.click(screen.getByRole('button', { name: /Revert Item Draft/i }));

    await waitFor(() => expect(screen.getByText(/revert-item/i)).toBeInTheDocument());
    expect(screen.queryByText('3 EA')).not.toBeInTheDocument();
  });

  it('keeps pending EBOM operations visible when publish fails', async () => {
    const repository = createInMemoryEBOMArchitectureRepository();
    repository.publishChangePackage = async () => {
      throw new Error('publish failed');
    };
    useEBOMArchitectureStore.getState().setRepository(repository);

    render(<EBOMArchitectureWorkspace />);
    await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Edit ZP26-4100/i }));
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply Override/i }));
    fireEvent.click(screen.getByRole('button', { name: /Publish Change Package/i }));

    await waitFor(() => expect(screen.getByText(/publish failed/i)).toBeInTheDocument());
    expect(screen.getAllByText('1 pending').length).toBeGreaterThan(0);
  });

  it('renders SKU-first MBOM deltas grouped by delta type and reconciles stale selections', async () => {
    useProductConfigStore.setState((state) => ({
      projects: [
        ...state.projects,
        {
          id: 'project-alt',
          code: 'ALT',
          name: 'Alternate Product',
          phase: 'EVT',
          primarySeriesId: 'series-alt',
          status: 'active',
        },
      ],
      series: [
        ...state.series,
        {
          id: 'series-alt',
          projectId: 'project-alt',
          code: 'ALT-A',
          name: 'Alternate Series',
          isPrimary: true,
        },
      ],
      structures: [
        ...state.structures,
        {
          id: 'structure-alt-std',
          projectId: 'project-alt',
          seriesId: 'series-alt',
          code: 'STD',
          name: 'Alternate Standard Structure',
        },
      ],
      skus: [
        ...state.skus,
        {
          id: 'sku-alt-std',
          projectId: 'project-alt',
          seriesId: 'series-alt',
          structureId: 'structure-alt-std',
          code: 'ALT-A-STD',
          status: 'active',
          optionIds: [],
          generatedByRule: true,
        },
      ],
    }));

    render(<MBOMDeltaConsole />);

    const skuSelect = screen.getByRole('combobox', { name: 'SKU' }) as HTMLSelectElement;

    expect(screen.getByText('MBOM Delta Console')).toBeInTheDocument();
    expect(screen.getAllByText('ZP-A-STD-BLK-US-RTL').length).toBeGreaterThan(0);
    expect(screen.getByText('US Retail Black Standard Manufacturing Delta')).toBeInTheDocument();
    expect(screen.getByText('packaging label regional')).toBeInTheDocument();
    expect(screen.getByText('manufacturing only material')).toBeInTheDocument();
    expect(screen.getByText('quantity change')).toBeInTheDocument();
    expect(screen.getByText('Full MBOM Preview')).toBeInTheDocument();

    fireEvent.change(skuSelect, { target: { value: 'sku-zp-a-pro-blk-us-rtl' } });

    expect(skuSelect.value).toBe('sku-zp-a-pro-blk-us-rtl');
    expect(screen.getByText('No delta packs are assigned to this SKU.')).toBeInTheDocument();

    act(() => {
      useProductConfigStore.getState().setActiveProject('project-alt');
    });

    await waitFor(() => expect(skuSelect.value).toBe('sku-alt-std'));
    expect(screen.getAllByText('ALT-A-STD').length).toBeGreaterThan(0);
    expect(screen.getByText('Alternate Standard Structure')).toBeInTheDocument();
  });

  it('renders tooling by design master part with milestones and kickoff-to-T1 lead time', () => {
    render(<ToolingHub />);

    const designMasterPartSelect = screen.getByRole('combobox', { name: 'Design Master Part' }) as HTMLSelectElement;

    expect(screen.getByText('Tooling Hub')).toBeInTheDocument();
    expect(screen.getAllByText('DMP-ZPA-ENC-COVER').length).toBeGreaterThan(0);
    expect(screen.getByText('ZP-A-STD-COVER-BLK')).toBeInTheDocument();
    expect(screen.getByText('Enclosure Cover Injection Mold')).toBeInTheDocument();
    expect(screen.getByText('Kickoff to T1: 21 days')).toBeInTheDocument();
    expect(screen.getAllByText('done').length).toBeGreaterThan(0);

    fireEvent.change(designMasterPartSelect, { target: { value: 'dmp-zp-a-pro-camera-deco' } });

    expect(designMasterPartSelect.value).toBe('dmp-zp-a-pro-camera-deco');
    expect(screen.getByText('Pro Camera Decoration Ring Die')).toBeInTheDocument();
    expect(screen.getByText('ZP-A-PRO-CAMERA-DECO-BLK')).toBeInTheDocument();
    expect(screen.queryByText('Enclosure Cover Injection Mold')).not.toBeInTheDocument();
  });
});
