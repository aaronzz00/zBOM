import { describe, it, expect } from 'vitest';
import { exportBOMToCSV, parseCSVToBOM } from '../utils/csvHelper';
import { BOMNode, ComponentType, LifecycleState } from '../types';

describe('CSV Helper', () => {
    const mockBOM: BOMNode = {
        id: 'root',
        partNumber: 'ASM-001',
        name: 'Main Assembly',
        description: 'Test Description',
        revision: 'A',
        state: LifecycleState.Draft,
        type: ComponentType.Assembly,
        quantity: 1,
        unit: 'EA',
        cost: 100,
        currency: 'USD',
        children: [
            {
                id: 'child1',
                partNumber: 'PRT-001',
                name: 'Child Part',
                revision: 'A',
                state: LifecycleState.Released,
                type: ComponentType.Part,
                quantity: 2,
                unit: 'EA',
                cost: 10,
                currency: 'USD',
                manufacturer: 'Acme Corp',
                mpn: 'AC-123'
            }
        ]
    };

    describe('exportBOMToCSV', () => {
        it('should generate correct CSV headers and rows', () => {
            const csv = exportBOMToCSV(mockBOM);
            const lines = csv.split('\n');

            // Check headers
            expect(lines[0]).toContain('Level,Part Number,Name');

            // Check root (Level 0)
            expect(lines[1]).toContain('0,ASM-001,Main Assembly');

            // Check child (Level 1)
            expect(lines[2]).toContain('1,PRT-001,Child Part');
        });

        it('should escape special characters', () => {
            const specialNode = {
                ...mockBOM,
                name: 'Name, with comma',
                description: 'Desc "with quotes"'
            };
            const csv = exportBOMToCSV(specialNode);
            expect(csv).toContain('"Name, with comma"');
            expect(csv).toContain('"Desc ""with quotes"""');
        });
    });

    describe('parseCSVToBOM', () => {
        it('should reconstruct BOM tree from CSV', () => {
            const csv = `Level,Part Number,Name,Description,Revision,State,Type,Quantity,Unit Cost,Manufacturer,MPN
0,ASM-001,Main Assembly,Test Desc,A,Draft,Assembly,1,100,,
1,PRT-001,Child Part,,A,Released,Part,2,10,,`;

            const result = parseCSVToBOM(csv);

            expect(result).not.toBeNull();
            expect(result?.partNumber).toBe('ASM-001');
            expect(result?.children).toHaveLength(1);
            expect(result?.children?.[0].partNumber).toBe('PRT-001');
            expect(result?.children?.[0].quantity).toBe(2);
        });

        it('should handle quoted values during import', () => {
            // Note: Current parser is simple, testing basic support if implemented or failure mode
            const csv = `Level,Part Number,Name
0,ASM-001,"Name, with comma"`;

            const result = parseCSVToBOM(csv);
            expect(result?.name).toBe('Name, with comma');
        });
    });
});
