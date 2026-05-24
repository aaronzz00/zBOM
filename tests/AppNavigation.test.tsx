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
    expect(screen.getByText('Product Matrix Center')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /EBOM Architecture/i }));
    await waitFor(() => expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /MBOM Delta/i }));
    expect(screen.getByText('MBOM Delta Console')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Tooling Hub/i }));
    expect(screen.getByText('Tooling Hub', { selector: 'div' })).toBeInTheDocument();
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
});
