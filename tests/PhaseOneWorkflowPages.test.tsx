import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EBOMArchitectureWorkspace } from '../pages/EBOMArchitectureWorkspace';
import { MBOMDeltaConsole } from '../pages/MBOMDeltaConsole';
import { ToolingHub } from '../pages/ToolingHub';
import { useMBOMDeltaStore } from '../stores/useMBOMDeltaStore';
import { useProductConfigStore } from '../stores/useProductConfigStore';
import { useToolingStore } from '../stores/useToolingStore';

describe('Phase 1 workflow pages', () => {
  beforeEach(() => {
    useProductConfigStore.getState().reset();
    useMBOMDeltaStore.getState().reset();
    useToolingStore.getState().reset();
  });

  it('renders EBOM architecture inheritance chain and resolved item states', () => {
    render(<EBOMArchitectureWorkspace />);

    expect(screen.getByText('EBOM Architecture Workspace')).toBeInTheDocument();
    expect(screen.getAllByText('ebom-platform-zp26').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ebom-series-zp-a').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ebom-structure-zp-a-std').length).toBeGreaterThan(0);
    expect(screen.getByText('ZP26-3200')).toBeInTheDocument();
    expect(screen.getByText('Battery Pack, 4500mAh')).toBeInTheDocument();
    expect(screen.getByText('locked')).toBeInTheDocument();
  });

  it('renders SKU-first MBOM deltas grouped by delta type', () => {
    render(<MBOMDeltaConsole />);

    expect(screen.getByText('MBOM Delta Console')).toBeInTheDocument();
    expect(screen.getAllByText('ZP-A-STD-BLK-US-RTL').length).toBeGreaterThan(0);
    expect(screen.getByText('US Retail Black Standard Manufacturing Delta')).toBeInTheDocument();
    expect(screen.getByText('packaging label regional')).toBeInTheDocument();
    expect(screen.getByText('manufacturing only material')).toBeInTheDocument();
    expect(screen.getByText('quantity change')).toBeInTheDocument();
    expect(screen.getByText('Full MBOM Preview')).toBeInTheDocument();
  });

  it('renders tooling by design master part with milestones and kickoff-to-T1 lead time', () => {
    render(<ToolingHub />);

    expect(screen.getByText('Tooling Hub')).toBeInTheDocument();
    expect(screen.getAllByText('DMP-ZPA-ENC-COVER').length).toBeGreaterThan(0);
    expect(screen.getByText('ZP-A-STD-COVER-BLK')).toBeInTheDocument();
    expect(screen.getByText('Enclosure Cover Injection Mold')).toBeInTheDocument();
    expect(screen.getByText('Kickoff to T1: 21 days')).toBeInTheDocument();
    expect(screen.getAllByText('done').length).toBeGreaterThan(0);
  });
});
