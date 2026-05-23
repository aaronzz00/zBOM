import { describe, expect, it } from 'vitest';
import type { EBOMItem } from '../domain/ebomArchitectureTypes';
import { ComponentType, LifecycleState } from '../types';
import { toLegacyBOMNode } from '../utils/legacyBomAdapter';

const item = (overrides: Partial<EBOMItem> & Pick<EBOMItem, 'id'>): EBOMItem => ({
  id: overrides.id,
  baseId: 'base-a',
  parentItemId: undefined,
  partNumber: `PN-${overrides.id}`,
  name: `Item ${overrides.id}`,
  quantity: 1,
  unit: 'EA',
  revision: 'A',
  inheritanceState: 'local',
  ...overrides,
});

describe('legacyBomAdapter', () => {
  it('converts a flat resolved EBOM item list into a nested BOMNode tree', () => {
    const resolvedItems: EBOMItem[] = [
      item({ id: 'root', partNumber: 'ASSY-100', name: 'Root Assembly' }),
      item({ id: 'child-a', parentItemId: 'root', partNumber: 'PART-100', name: 'Child A' }),
      item({ id: 'child-b', parentItemId: 'root', partNumber: 'ASSY-200', name: 'Child B' }),
      item({ id: 'grandchild', parentItemId: 'child-b', partNumber: 'PART-200', name: 'Grandchild' }),
    ];

    const root = toLegacyBOMNode(resolvedItems, 'root');

    expect(root.id).toBe('root');
    expect(root.children?.map((child) => child.id)).toEqual(['child-a', 'child-b']);
    expect(root.children?.[1].children?.map((child) => child.id)).toEqual(['grandchild']);
  });

  it('preserves quantity, unit, part number, revision, and name', () => {
    const resolvedItems: EBOMItem[] = [
      item({
        id: 'root',
        partNumber: 'ASSY-100',
        name: 'Root Assembly',
        quantity: 2,
        unit: 'SET',
        revision: 'B',
      }),
    ];

    const root = toLegacyBOMNode(resolvedItems, 'root');

    expect(root).toMatchObject({
      id: 'root',
      partNumber: 'ASSY-100',
      name: 'Root Assembly',
      revision: 'B',
      quantity: 2,
      unit: 'SET',
      state: LifecycleState.Draft,
      currency: 'USD',
      cost: 0,
    });
  });

  it('encodes inheritance metadata into customAttributes', () => {
    const resolvedItems: EBOMItem[] = [
      item({
        id: 'root',
        baseId: 'base-child',
        sourceItemId: 'source-item',
        sourceBaseId: 'base-parent',
        inheritanceState: 'locked',
        designMasterPartId: 'design-master-1',
        lockedFields: ['quantity', 'revision'],
      }),
    ];

    const root = toLegacyBOMNode(resolvedItems, 'root');

    expect(root.customAttributes).toEqual({
      zbom: {
        baseId: 'base-child',
        sourceItemId: 'source-item',
        sourceBaseId: 'base-parent',
        inheritanceState: 'locked',
        designMasterPartId: 'design-master-1',
        lockedFields: ['quantity', 'revision'],
      },
    });
  });

  it('assigns Assembly type to nodes with children and Part type to leaves', () => {
    const resolvedItems: EBOMItem[] = [
      item({ id: 'root' }),
      item({ id: 'child', parentItemId: 'root' }),
    ];

    const root = toLegacyBOMNode(resolvedItems, 'root');

    expect(root.type).toBe(ComponentType.Assembly);
    expect(root.children?.[0].type).toBe(ComponentType.Part);
  });

  it('throws a clear error if the root item is missing', () => {
    expect(() => toLegacyBOMNode([item({ id: 'other-root' })], 'missing-root')).toThrow(
      /EBOM root item not found: missing-root/,
    );
  });

  it('throws a clear error for item parent cycles reachable from the selected root', () => {
    const resolvedItems: EBOMItem[] = [
      item({ id: 'root', parentItemId: 'child-b' }),
      item({ id: 'child-a', parentItemId: 'root' }),
      item({ id: 'child-b', parentItemId: 'child-a' }),
    ];

    expect(() => toLegacyBOMNode(resolvedItems, 'root')).toThrow(
      /EBOM item parent cycle detected: root -> child-a -> child-b -> root/,
    );
  });

  it('does not mutate input items', () => {
    const resolvedItems: EBOMItem[] = [
      item({ id: 'root' }),
      item({ id: 'child', parentItemId: 'root', lockedFields: ['quantity'] }),
    ];
    const before = structuredClone(resolvedItems);

    toLegacyBOMNode(resolvedItems, 'root');

    expect(resolvedItems).toEqual(before);
  });

  it('excludes unrelated and orphan items outside the selected root', () => {
    const resolvedItems: EBOMItem[] = [
      item({ id: 'root-a' }),
      item({ id: 'child-a', parentItemId: 'root-a' }),
      item({ id: 'root-b' }),
      item({ id: 'child-b', parentItemId: 'root-b' }),
      item({ id: 'orphan', parentItemId: 'missing-parent' }),
    ];

    const root = toLegacyBOMNode(resolvedItems, 'root-a');

    expect(root.id).toBe('root-a');
    expect(root.children?.map((child) => child.id)).toEqual(['child-a']);
    expect(JSON.stringify(root)).not.toContain('root-b');
    expect(JSON.stringify(root)).not.toContain('orphan');
  });
});
