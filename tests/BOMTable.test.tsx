import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BOMTable } from '../components/BOMTable';
import { BOMNode, ComponentType, LifecycleState } from '../types';
import { useBOMStore } from '../stores/useBOMStore';

// Mock specific logic data
const mockData: BOMNode = {
    id: 'root',
    partNumber: 'MAIN',
    name: 'Main Assy',
    revision: 'A',
    state: LifecycleState.Draft,
    type: ComponentType.Assembly,
    quantity: 1,
    unit: 'EA',
    cost: 100,
    currency: 'USD',
    children: Array.from({ length: 50 }).map((_, i) => ({
        id: `child-${i}`,
        partNumber: `P-${i}`,
        name: `Part ${i}`,
        revision: 'A',
        state: LifecycleState.Released,
        type: ComponentType.Part,
        quantity: 1,
        unit: 'EA',
        cost: 10,
        currency: 'USD'
    }))
};

// Mock Virtualizer to bypass JSDOM layout issues
vi.mock('@tanstack/react-virtual', () => ({
    useVirtualizer: vi.fn(({ count }) => ({
        getVirtualItems: () => {
            // Return all items for test simplicity (or a subset)
            return Array.from({ length: Math.min(count, 20) }).map((_, i) => ({
                index: i,
                start: i * 40,
                size: 40,
                measureElement: () => { },
            }));
        },
        getTotalSize: () => count * 40,
    })),
}));

describe('BOMTable', () => {
    it('should render rows', async () => {
        // No need for layout mocks anymore

        render(
            <div style={{ height: '500px', width: '800px' }}>
                <BOMTable
                    data={mockData}
                    onSelect={() => { }}
                    selectedId={null}
                    isMBOMView={false}
                />
            </div>
        );

        // Check header
        expect(screen.getByText('Part Number')).toBeInTheDocument();

        // Check first row (should be rendered)
        expect(screen.getByText('MAIN')).toBeInTheDocument();

        // Check some children (virtualization overscan might catch P-0)
        expect(screen.getByText('P-0')).toBeInTheDocument();

        // Ensure not ALL 50 are rendered if virtualized? 
        // JSDOM doesn't do layout, so clientHeight is 0. 
        // TanStack Virtual might render 0 items if container size is 0.
        // We might need to mock HTMLElement.prototype.getBoundingClientRect or offsetHeight.
    });

    it('opens column controls with an explicit button state', () => {
        render(
            <div style={{ height: '500px', width: '800px' }}>
                <BOMTable
                    data={mockData}
                    onSelect={() => { }}
                    selectedId={null}
                    isMBOMView={false}
                />
            </div>
        );

        const columnsButton = screen.getByRole('button', { name: /Columns/i });
        expect(columnsButton).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(columnsButton);

        expect(columnsButton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByLabelText('cost')).toBeInTheDocument();

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(columnsButton).toHaveAttribute('aria-expanded', 'false');
    });
});
