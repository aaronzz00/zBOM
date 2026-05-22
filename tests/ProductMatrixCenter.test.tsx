import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProductMatrixCenter } from '../pages/ProductMatrixCenter';
import { useProductConfigStore } from '../stores/useProductConfigStore';

describe('ProductMatrixCenter', () => {
  beforeEach(() => {
    useProductConfigStore.getState().reset();
  });

  it('renders active project product configuration and allows candidate SKU activation', () => {
    render(<ProductMatrixCenter />);

    expect(screen.getByText('zPhone 2026 Platform')).toBeInTheDocument();
    expect(screen.getByText('ZP26')).toBeInTheDocument();
    expect(screen.getByText('zPhone A Series')).toBeInTheDocument();
    expect(screen.getByText('Standard Structure')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getAllByText('BLK').length).toBeGreaterThan(0);
    expect(screen.getByText('ZP-A-PRO-BLK-US-RTL')).toBeInTheDocument();

    const skuRow = screen.getByTestId('sku-row-sku-zp-a-pro-blk-us-rtl');
    expect(skuRow).toHaveTextContent('candidate');

    fireEvent.click(screen.getByTestId('activate-sku-zp-a-pro-blk-us-rtl'));

    expect(skuRow).toHaveTextContent('active');
  });
});
