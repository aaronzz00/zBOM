import { describe, expect, it } from 'vitest';
import type { EBOMBase, EBOMItem } from '../domain/ebomArchitectureTypes';
import { mockEBOMBases, mockEBOMItems } from '../data/mockEBOMArchitecture';
import {
  getInheritanceChain,
  getOverrideSummary,
  resolveEBOMBase,
} from '../utils/ebomInheritance';

describe('ebomInheritance', () => {
  it('resolves a structure base with inherited series items', () => {
    const resolved = resolveEBOMBase('ebom-structure-zp-a-pro', mockEBOMBases, mockEBOMItems);

    expect(resolved.map((item) => item.id)).toEqual([
      'item-pro-root',
      'item-pro-display-override',
      'item-pro-battery',
      'item-pro-camera-local',
    ]);
    expect(resolved.find((item) => item.id === 'item-pro-battery')).toMatchObject({
      sourceItemId: 'item-series-battery',
      inheritanceState: 'inherited',
    });
  });

  it('resolves a series base with inherited platform items', () => {
    const resolved = resolveEBOMBase('ebom-series-zp-a', mockEBOMBases, mockEBOMItems);

    expect(resolved.map((item) => item.id)).toEqual([
      'item-series-root',
      'item-series-display',
      'item-series-battery',
    ]);
    expect(resolved.every((item) => item.baseId === 'ebom-series-zp-a')).toBe(true);
  });

  it('returns the inheritance chain from top-most ancestor to PRO structure', () => {
    const chain = getInheritanceChain('ebom-structure-zp-a-pro', mockEBOMBases);

    expect(chain.map((base) => base.id)).toEqual([
      'ebom-platform-zp26',
      'ebom-series-zp-a',
      'ebom-structure-zp-a-pro',
    ]);
  });

  it('replaces source items with override items in PRO resolution', () => {
    const resolved = resolveEBOMBase('ebom-structure-zp-a-pro', mockEBOMBases, mockEBOMItems);

    expect(resolved.find((item) => item.id === 'item-series-display')).toBeUndefined();
    expect(resolved.find((item) => item.id === 'item-pro-display-override')).toMatchObject({
      sourceItemId: 'item-series-display',
      partNumber: 'ZP26-4100-PRO',
      name: 'Display Module, ProMotion OLED',
      inheritanceState: 'overridden',
    });
  });

  it('includes local items in PRO resolution', () => {
    const resolved = resolveEBOMBase('ebom-structure-zp-a-pro', mockEBOMBases, mockEBOMItems);
    const localItem = resolved.find((item) => item.id === 'item-pro-camera-local');

    expect(localItem).toMatchObject({
      inheritanceState: 'local',
    });
    expect(localItem?.sourceItemId).toBeUndefined();
  });

  it('preserves locked field values while merging unlocked source fields', () => {
    const sourceBattery = mockEBOMItems.find((item) => item.id === 'item-series-battery');
    const resolved = resolveEBOMBase('ebom-structure-zp-a-std', mockEBOMBases, mockEBOMItems);

    expect(resolved.find((item) => item.id === 'item-std-battery-locked')).toMatchObject({
      id: 'item-std-battery-locked',
      sourceItemId: 'item-series-battery',
      quantity: 2,
      name: sourceBattery?.name,
      partNumber: sourceBattery?.partNumber,
      inheritanceState: 'locked',
      lockedFields: ['quantity'],
    });
  });

  it('removes unlocked optional local-only fields when merging locked items', () => {
    const bases: EBOMBase[] = [
      {
        id: 'base-parent',
        projectId: 'project',
        scope: 'platform',
        rootItemId: 'item-parent-root',
        revision: 'A',
        status: 'released',
      },
      {
        id: 'base-child',
        projectId: 'project',
        scope: 'structure',
        parentBaseId: 'base-parent',
        rootItemId: 'item-child-root',
        revision: 'A',
        status: 'draft',
      },
    ];
    const items: EBOMItem[] = [
      {
        id: 'item-parent-part',
        baseId: 'base-parent',
        partNumber: 'SRC-100',
        name: 'Source Part',
        quantity: 1,
        unit: 'EA',
        revision: 'A',
        inheritanceState: 'local',
      },
      {
        id: 'item-child-part',
        baseId: 'base-child',
        partNumber: 'LOCAL-STALE',
        name: 'Stale Local Name',
        quantity: 5,
        unit: 'EA',
        revision: 'LOCAL',
        designMasterPartId: 'stale-local-only-dmp',
        sourceItemId: 'item-parent-part',
        sourceBaseId: 'base-parent',
        inheritanceState: 'locked',
        lockedFields: ['quantity'],
      },
    ];

    const resolved = resolveEBOMBase('base-child', bases, items);

    expect(resolved).toEqual([
      {
        id: 'item-child-part',
        baseId: 'base-child',
        partNumber: 'SRC-100',
        name: 'Source Part',
        quantity: 5,
        unit: 'EA',
        revision: 'A',
        sourceItemId: 'item-parent-part',
        sourceBaseId: 'base-parent',
        inheritanceState: 'locked',
        lockedFields: ['quantity'],
      },
    ]);
    expect(resolved[0].designMasterPartId).toBeUndefined();
  });

  it('does not mutate bases or items during resolution', () => {
    const basesBefore = structuredClone(mockEBOMBases);
    const itemsBefore = structuredClone(mockEBOMItems);

    resolveEBOMBase('ebom-structure-zp-a-std', mockEBOMBases, mockEBOMItems);

    expect(mockEBOMBases).toEqual(basesBefore);
    expect(mockEBOMItems).toEqual(itemsBefore);
  });

  it('summarizes resolved inheritance states', () => {
    expect(getOverrideSummary('ebom-structure-zp-a-pro', mockEBOMBases, mockEBOMItems)).toEqual({
      inherited: 1,
      overridden: 2,
      local: 1,
      locked: 0,
    });
  });

  it('throws a clear error for a missing base', () => {
    expect(() => getInheritanceChain('missing-base', mockEBOMBases)).toThrow(
      /EBOM base not found: missing-base/,
    );
  });

  it('throws a clear error for a missing parent base', () => {
    const bases: EBOMBase[] = [
      {
        id: 'base-child',
        projectId: 'project',
        scope: 'structure',
        parentBaseId: 'missing-parent',
        rootItemId: 'item-child-root',
        revision: 'A',
        status: 'draft',
      },
    ];

    expect(() => getInheritanceChain('base-child', bases)).toThrow(
      /EBOM parent base not found: missing-parent for base base-child/,
    );
  });

  it('throws a clear error when base inheritance contains a cycle', () => {
    const cyclicBases: EBOMBase[] = [
      {
        id: 'base-a',
        projectId: 'project',
        scope: 'platform',
        parentBaseId: 'base-c',
        rootItemId: 'item-a',
        revision: 'A',
        status: 'draft',
      },
      {
        id: 'base-b',
        projectId: 'project',
        scope: 'series',
        parentBaseId: 'base-a',
        rootItemId: 'item-b',
        revision: 'A',
        status: 'draft',
      },
      {
        id: 'base-c',
        projectId: 'project',
        scope: 'structure',
        parentBaseId: 'base-b',
        rootItemId: 'item-c',
        revision: 'A',
        status: 'draft',
      },
    ];

    expect(() => getInheritanceChain('base-c', cyclicBases)).toThrow(
      /EBOM inheritance cycle detected: base-c -> base-b -> base-a -> base-c/,
    );
  });
});
