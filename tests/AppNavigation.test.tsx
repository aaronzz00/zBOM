import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../App';
import { createInMemoryEBOMArchitectureRepository } from '../repositories/ebomArchitectureRepository';
import { useAuthStore } from '../stores/useAuthStore';
import { useEBOMArchitectureStore } from '../stores/useEBOMArchitectureStore';
import { useMBOMDeltaStore } from '../stores/useMBOMDeltaStore';
import { useProductConfigStore } from '../stores/useProductConfigStore';
import { useToolingStore } from '../stores/useToolingStore';

describe('App phase 1 navigation', () => {
  beforeEach(() => {
    useAuthStore.getState().switchRole('ADMIN');
    useProductConfigStore.getState().reset();
    useMBOMDeltaStore.getState().reset();
    useToolingStore.getState().reset();
    useEBOMArchitectureStore.getState().reset();
    useEBOMArchitectureStore.getState().setRepository(createInMemoryEBOMArchitectureRepository());
  });

  it('routes to every phase 1 workflow from the sidebar', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Product Matrix/i }));
    expect(await screen.findByText('Product Matrix Center', {}, { timeout: 5000 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /EBOM Architecture/i }));
    expect(await screen.findByText('EBOM Architecture Workspace', {}, { timeout: 5000 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /MBOM Delta/i }));
    expect(await screen.findByText('MBOM Delta Console', {}, { timeout: 5000 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tooling Hub/i }));
    expect(await screen.findByText('Tooling Hub', { selector: 'div' }, { timeout: 5000 })).toBeInTheDocument();
  });

  it('marks non-core modules as development preview while keeping core modules primary', async () => {
    render(<App />);

    expect(screen.getByText('Production Core')).toBeInTheDocument();
    expect(screen.getByText('Development Preview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dashboard/i }));
    expect(await screen.findByText(/Development Preview - not part of the production core test scope/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /BOM Editor/i }));
    await screen.findByText('BOM Editor');
    await waitFor(() => {
      expect(screen.queryByText(/Development Preview - not part of the production core test scope/i)).not.toBeInTheDocument();
    });
  });

  it('keeps phase 1 BOM-facing modules visible to viewer role', () => {
    useAuthStore.getState().switchRole('VIEWER');

    render(<App />);

    expect(screen.getByRole('button', { name: /Product Matrix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EBOM Architecture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MBOM Delta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tooling Hub/i })).toBeInTheDocument();
  });

  it('keeps phase 1 navigation labels visible with a selected workflow SKU context', () => {
    useProductConfigStore.getState().selectWorkflowSKU('sku-zp-a-pro-blk-us-rtl');

    render(<App />);

    expect(screen.getByRole('button', { name: /Product Matrix/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /EBOM Architecture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MBOM Delta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tooling Hub/i })).toBeInTheDocument();
  });

  it('navigates from Tooling Hub concrete parts into filtered Part Library context', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Tooling Hub/i }));
    await screen.findByText('Tooling Records', {}, { timeout: 5000 });

    fireEvent.click(screen.getAllByRole('button', { name: /Open in Part Library/i })[0]);

    expect(await screen.findByText('Library Filters', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByDisplayValue('ZP-A-STD-COVER-BLK')).toBeInTheDocument();
  });

  it('keeps the operational shell constrained for narrow viewport layouts', async () => {
    render(<App />);

    const navigation = screen.getByRole('navigation');
    expect(navigation.parentElement).toHaveClass('w-20', 'lg:w-64');

    const dashboardButtonLabel = screen.getByRole('button', { name: /Dashboard/i }).querySelector('span');
    expect(dashboardButtonLabel).toHaveClass('hidden', 'lg:inline');

    expect(screen.getByRole('banner')).toHaveClass('px-3', 'sm:px-4', 'lg:px-6');

    fireEvent.click(screen.getByRole('button', { name: /Supply Chain/i }));

    const avlHeader = (await screen.findByText('Approved Vendor List (AVL)')).parentElement;
    expect(avlHeader).toHaveClass('flex-col', 'lg:flex-row');

    const supplierTable = screen.getByRole('table');
    expect(supplierTable).toHaveClass('min-w-[900px]');
    expect(supplierTable.parentElement).toHaveClass('overflow-x-auto');
  });
});
