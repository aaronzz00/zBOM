import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { EBOMArchitectureWorkspace } from '../pages/EBOMArchitectureWorkspace';
import { MBOMDeltaConsole } from '../pages/MBOMDeltaConsole';
import { ToolingHub } from '../pages/ToolingHub';
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

describe('Phase 1 workflow pages', () => {
  beforeEach(() => {
    useProductConfigStore.getState().reset();
    useMBOMDeltaStore.getState().reset();
    useToolingStore.getState().reset();
  });

  it('renders EBOM architecture inheritance chain and resolved item states', () => {
    render(<EBOMArchitectureWorkspace />);

    const baseSelect = screen.getByRole('combobox', { name: 'EBOM Base' }) as HTMLSelectElement;
    const preview = screen.getByTestId('legacy-bom-preview');

    expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument();
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
