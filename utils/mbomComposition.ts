import type { EBOMItem } from '../domain/ebomArchitectureTypes';
import type { ComposedMBOMRow, ComposedMBOMSource, MBOMDeltaItem } from '../domain/mbomTypes';

const defaultDeltaQuantity = 1;
const defaultDeltaUnit = 'EA';

const deltaSourceByType: Record<MBOMDeltaItem['type'], ComposedMBOMSource> = {
    add: 'delta-add',
    remove: 'delta-remove',
    replace: 'delta-replace',
    'quantity-change': 'quantity-change',
    'manufacturing-only-material': 'manufacturing-only',
    'packaging-label-regional': 'packaging-label-regional',
};

const toBaseRow = (item: EBOMItem): ComposedMBOMRow => ({
    id: `base:${item.id}`,
    partNumber: item.partNumber,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    revision: item.revision,
    source: 'base',
});

const createDeltaRow = (
    item: MBOMDeltaItem,
    source: ComposedMBOMSource,
): ComposedMBOMRow => ({
    id: `delta:${item.id}`,
    partNumber: item.newPartNumber ?? item.targetPartNumber ?? item.reason,
    name: item.reason,
    quantity: item.quantity ?? defaultDeltaQuantity,
    unit: defaultDeltaUnit,
    source,
    deltaItemId: item.id,
    ...(item.targetPartNumber ? { targetPartNumber: item.targetPartNumber } : {}),
    reason: item.reason,
});

const createWarningRow = (
    item: MBOMDeltaItem,
    source: ComposedMBOMSource,
): ComposedMBOMRow => {
    const targetPartNumber = item.targetPartNumber;
    const partNumber = targetPartNumber ?? item.newPartNumber ?? item.reason;

    return {
        id: `warning:${item.id}`,
        partNumber,
        name: item.reason,
        quantity: item.quantity ?? defaultDeltaQuantity,
        unit: defaultDeltaUnit,
        source,
        deltaItemId: item.id,
        ...(targetPartNumber ? { targetPartNumber } : {}),
        reason: item.reason,
        warning: targetPartNumber
            ? `Target part number not found: ${targetPartNumber}`
            : 'Target part number is missing',
    };
};

const findTargetRowIndex = (
    rows: ComposedMBOMRow[],
    targetPartNumber: string | undefined,
): number => {
    if (!targetPartNumber) {
        return -1;
    }

    return rows.findIndex((row) => row.partNumber === targetPartNumber);
};

export const composeMBOMPreview = (
    baseItems: EBOMItem[],
    deltaItems: MBOMDeltaItem[],
): ComposedMBOMRow[] => {
    const rows = baseItems.map(toBaseRow);

    deltaItems.forEach((item) => {
        const source = deltaSourceByType[item.type];

        if (
            item.type === 'add'
            || item.type === 'manufacturing-only-material'
            || (item.type === 'packaging-label-regional' && !item.targetPartNumber)
        ) {
            rows.push(createDeltaRow(item, source));
            return;
        }

        const targetIndex = findTargetRowIndex(rows, item.targetPartNumber);

        if (targetIndex === -1) {
            rows.push(createWarningRow(item, source));
            return;
        }

        const targetRow = rows[targetIndex];
        const sharedDeltaFields = {
            source,
            deltaItemId: item.id,
            targetPartNumber: item.targetPartNumber,
            reason: item.reason,
        };

        if (item.type === 'remove') {
            rows[targetIndex] = {
                ...targetRow,
                ...sharedDeltaFields,
            };
            return;
        }

        if (item.type === 'replace' || item.type === 'packaging-label-regional') {
            rows[targetIndex] = {
                ...targetRow,
                partNumber: item.newPartNumber ?? targetRow.partNumber,
                quantity: item.quantity ?? targetRow.quantity,
                ...sharedDeltaFields,
            };
            return;
        }

        if (item.type === 'quantity-change') {
            rows[targetIndex] = {
                ...targetRow,
                quantity: item.quantity ?? targetRow.quantity,
                ...sharedDeltaFields,
            };
        }
    });

    return rows;
};
