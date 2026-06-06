import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BOMEditor } from '../pages/BOMEditor';
import { PartLibrary } from '../pages/PartLibrary';
import { ToolingHub } from '../pages/ToolingHub';
import { complexBOM, mockProject, previousBOM } from '../data/mockBOM';
import { mockSuppliers } from '../data/mockSuppliers';
import { coreRepository, toLegacyLibraryParts } from '../repositories/core/coreRepository';
import { useAuthStore } from '../stores/useAuthStore';
import { useBOMStore } from '../stores/useBOMStore';
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

const resetCoreStores = () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  coreRepository.resetToSeed();
  useAuthStore.getState().switchRole('ADMIN');
  useBOMStore.setState({
    project: JSON.parse(JSON.stringify(mockProject)),
    bomData: JSON.parse(JSON.stringify(complexBOM)),
    libraryParts: toLegacyLibraryParts(coreRepository.loadWorkspace()),
    suppliers: JSON.parse(JSON.stringify(mockSuppliers)),
    snapshots: [{
      id: 'snap-001',
      name: 'Baseline (Rev A.01)',
      timestamp: new Date('2026-05-28T00:00:00.000Z').toISOString(),
      data: JSON.parse(JSON.stringify(previousBOM)),
    }],
  });
  useToolingStore.getState().reset();
};

describe('production core flows', () => {
  beforeEach(() => {
    resetCoreStores();
  });

  it('adds an existing library part to the BOM from the Add Item flow', () => {
    render(<BOMEditor />);

    fireEvent.click(screen.getByRole('button', { name: /Add Item/i }));
    fireEvent.click(screen.getByRole('button', { name: /Existing library part/i }));
    fireEvent.change(screen.getByLabelText('Library Part'), {
      target: { value: 'part-110-22311-b' },
    });
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Item/i }));

    expect(screen.getAllByText('110-22311-B').length).toBeGreaterThan(0);
    expect(screen.getByText(/Saved 110-22311-B to the BOM/i)).toBeInTheDocument();
  });

  it('previews and commits a BOM CSV import through the production flow', async () => {
    const { container } = render(<BOMEditor />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const csv = [
      'Level,Part Number,Name,Description,Revision,State,Type,Quantity,Unit Cost,Manufacturer,MPN',
      '0,IMPORTED-ROOT,Imported Root Assembly,,A,Draft,Assembly,1,0,,',
      '1,IMPORTED-CHILD,Imported Child Part,,A,Draft,Part,2,3.5,Demo Supplier,IMP-1',
    ].join('\n');

    fireEvent.change(fileInput, {
      target: { files: [new File([csv], 'core-import.csv', { type: 'text/csv' })] },
    });

    expect(await screen.findByText('CSV Import Preview')).toBeInTheDocument();
    expect(screen.getByText('IMPORTED-ROOT')).toBeInTheDocument();
    expect(screen.getByText(/Validation passed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Commit Import/i }));

    expect(screen.getByText(/Imported core-import.csv with 2 rows/i)).toBeInTheDocument();
    expect(useBOMStore.getState().bomData.partNumber).toBe('IMPORTED-ROOT');
    expect(useBOMStore.getState().bomData.children?.[0]?.partNumber).toBe('IMPORTED-CHILD');
  });

  it('blocks duplicate library part usage under the same BOM parent', () => {
    render(<BOMEditor />);

    fireEvent.click(screen.getByRole('button', { name: /Add Item/i }));
    fireEvent.click(screen.getByRole('button', { name: /Existing library part/i }));
    fireEvent.change(screen.getByLabelText('Parent Assembly'), {
      target: { value: 'n2-3' },
    });
    fireEvent.change(screen.getByLabelText('Library Part'), {
      target: { value: 'part-100-55512-a' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Item/i }));

    expect(screen.getByText(/100-55512-A is already used under the selected parent/i)).toBeInTheDocument();
  });

  it('validates duplicate part numbers when creating library parts', () => {
    render(<PartLibrary />);

    fireEvent.click(screen.getByRole('button', { name: /Create Part/i }));
    fireEvent.change(screen.getByLabelText('Part Number'), {
      target: { value: '100-55512-A' },
    });
    fireEvent.change(screen.getByLabelText('MPN'), {
      target: { value: 'DUP' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Duplicate attempt' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Library Part/i }));

    expect(screen.getByText(/Part number 100-55512-A already exists/i)).toBeInTheDocument();
  });

  it('shows tooling linkage from a concrete Part Library record', () => {
    render(<PartLibrary />);

    fireEvent.change(screen.getByPlaceholderText('Search by Part Number, MPN, Description...'), {
      target: { value: 'ZP-A-STD-COVER-BLK' },
    });
    fireEvent.click(screen.getByText('ZP-A-STD-COVER-BLK'));
    fireEvent.click(screen.getByRole('button', { name: /Tooling/i }));

    expect(screen.getByText(/Enclosure Cover Injection Mold/i)).toBeInTheDocument();
  });

  it('edits tooling design-master links from Part Library', () => {
    render(<PartLibrary />);

    fireEvent.change(screen.getByPlaceholderText('Search by Part Number, MPN, Description...'), {
      target: { value: '100-55512-A' },
    });
    fireEvent.click(screen.getByText('100-55512-A'));
    fireEvent.click(screen.getByRole('button', { name: /Tooling/i }));

    expect(screen.getByText('Tooling Link Editor')).toBeInTheDocument();
    expect(screen.getByText(/No tooling links for this part/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Design master to link'), {
      target: { value: 'dmp-zp-a-enclosure-cover' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));

    expect(screen.getByText(/Enclosure Cover Injection Mold/i)).toBeInTheDocument();
    expect(screen.getByText('DMP-ZPA-ENC-COVER')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));

    expect(screen.queryByText(/Enclosure Cover Injection Mold/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No tooling links for this part/i)).toBeInTheDocument();
  });

  it('searches Part Library by supplier, sorts results, and shows AVL status', () => {
    render(<PartLibrary />);

    fireEvent.change(screen.getByPlaceholderText('Search by Part Number, MPN, Description...'), {
      target: { value: 'Qualcomm' },
    });
    fireEvent.change(screen.getByLabelText('Sort parts'), {
      target: { value: 'supplier' },
    });
    fireEvent.click(screen.getByText('100-55512-A'));

    expect(screen.getByText(/AVL \/ Supplier Status/i)).toBeInTheDocument();
    expect(screen.getAllByText('Qualcomm').length).toBeGreaterThan(0);
    expect(screen.getByText('Preferred')).toBeInTheDocument();
  });

  it('updates tooling milestone status from Tooling Hub', () => {
    render(<ToolingHub />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);

    fireEvent.change(screen.getByLabelText('Enclosure Cover Injection Mold toolmaker'), {
      target: { value: 'Updated Precision Mold Co.' },
    });
    fireEvent.change(screen.getByLabelText('Enclosure Cover Injection Mold cavity count'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Enclosure Cover Injection Mold owner'), {
      target: { value: 'Nina Tooling' },
    });

    expect(screen.getByDisplayValue('Updated Precision Mold Co.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /milestones/i }));

    fireEvent.change(screen.getAllByLabelText('DFM status')[0], {
      target: { value: 'blocked' },
    });
    fireEvent.change(screen.getAllByLabelText('DFM planned date')[0], {
      target: { value: '2026-02-10' },
    });
    fireEvent.change(screen.getAllByLabelText('DFM owner')[0], {
      target: { value: 'Nina Tooling' },
    });
    fireEvent.change(screen.getAllByLabelText('DFM blocker reason')[0], {
      target: { value: 'Waiting for DFM package' },
    });

    expect(screen.getAllByText('blocked').length).toBeGreaterThan(0);
    expect(screen.getByText(/Updated DFM blocker reason/i)).toBeInTheDocument();
  });
});
