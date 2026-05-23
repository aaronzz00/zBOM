import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { useAuthStore } from '../stores/useAuthStore';

describe('App phase 1 navigation', () => {
  beforeEach(() => {
    useAuthStore.getState().switchRole('ADMIN');
  });

  it('routes to every phase 1 workflow from the sidebar', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Product Matrix/i }));
    expect(screen.getByText('Product Matrix Center')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /EBOM Architecture/i }));
    expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument();

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
});
