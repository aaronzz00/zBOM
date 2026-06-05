import { describe, expect, it } from 'vitest';
import { createCoreRepository, createInMemoryCoreStorage } from '../repositories/core/coreRepository';
import { createSeedCoreWorkspace } from '../repositories/core/coreSeed';
import { ComponentType, LifecycleState } from '../types';
import type { CoreActor } from '../domain/coreTypes';
import { CoreRepositoryError } from '../domain/coreTypes';

const admin: CoreActor = { userId: 'u1', name: 'Admin', role: 'ADMIN' };
const sourcing: CoreActor = { userId: 'u3', name: 'Sourcing', role: 'SOURCING' };
const engineer: CoreActor = { userId: 'u2', name: 'Engineer', role: 'ENG_LEAD' };
const viewer: CoreActor = { userId: 'u4', name: 'Viewer', role: 'VIEWER' };

const createRepository = () => createCoreRepository(createInMemoryCoreStorage(createSeedCoreWorkspace()));

describe('coreRepository', () => {
  it('loads seeded parts, BOM nodes, tooling mappings, and a BOM tree', () => {
    const repository = createRepository();
    const snapshot = repository.loadWorkspace();

    expect(snapshot.parts.map((part) => part.partNumber)).toContain('100-55512-A');
    expect(snapshot.bomTree.partNumber).toBe('800-00234-A');
    expect(snapshot.designMasterParts.map((part) => part.code)).toContain('DMP-ZPA-ENC-COVER');
    expect(snapshot.concretePartMappings.length).toBeGreaterThan(0);
  });

  it('persists changes across repository instances using the same storage', () => {
    const storage = createInMemoryCoreStorage(createSeedCoreWorkspace());
    const first = createCoreRepository(storage);

    first.createPart({
      partNumber: 'LIB-PERSIST-001',
      description: 'Persisted library part',
      category: 'Mechanical',
      type: ComponentType.Part,
      state: LifecycleState.Draft,
      cost: 1.5,
    }, admin);

    const second = createCoreRepository(storage);
    expect(second.searchParts({ query: 'LIB-PERSIST-001' }).items).toHaveLength(1);
  });

  it('rejects duplicate part numbers with a conflict error', () => {
    const repository = createRepository();

    expect(() => repository.createPart({
      partNumber: '100-55512-A',
      description: 'Duplicate part',
      category: 'Mechanical',
      type: ComponentType.Part,
      state: LifecycleState.Draft,
    }, admin)).toThrow(CoreRepositoryError);
  });

  it('links BOM nodes to library part IDs and resolves usage by relationship', () => {
    const repository = createRepository();
    const part = repository.searchParts({ query: '110-22311-B' }).items[0];
    const root = repository.loadWorkspace().bomTree;

    const node = repository.createBOMNode({
      parentId: root.id,
      partId: part.id,
      quantity: 2,
      unit: 'EA',
    }, admin);

    expect(node.partId).toBe(part.id);
    expect(repository.getPartUsage(part.id).map((usage) => usage.id)).toContain(node.id);
  });

  it('allows local BOM nodes without a part reference but marks them explicitly', () => {
    const repository = createRepository();
    const root = repository.loadWorkspace().bomTree;

    const node = repository.createBOMNode({
      parentId: root.id,
      localItem: {
        partNumber: 'LOCAL-001',
        name: 'Local fixture',
        type: ComponentType.Part,
      },
      quantity: 1,
      unit: 'EA',
    }, admin);

    expect(node.isLocalItem).toBe(true);
    expect(node.partId).toBeUndefined();
  });

  it('updates part commercial fields and reflects the change in the BOM tree', () => {
    const repository = createRepository();
    const part = repository.searchParts({ query: '100-55512-A' }).items[0];

    repository.updatePart(part.id, { cost: 41, moq: 500 }, sourcing);

    const bomTreeText = JSON.stringify(repository.loadWorkspace().bomTree);
    expect(bomTreeText).toContain('"cost":41');
    expect(bomTreeText).toContain('"moq":500');
  });

  it('enforces role policy for core writes', () => {
    const repository = createRepository();
    const part = repository.searchParts({ query: '100-55512-A' }).items[0];

    expect(() => repository.updatePart(part.id, { cost: 99 }, viewer)).toThrow(/VIEWER cannot/);
    expect(() => repository.updatePart(part.id, { description: 'Blocked edit' }, sourcing)).toThrow(/SOURCING cannot/);
    expect(() => repository.updatePart(part.id, { description: 'Engineer edit' }, engineer)).not.toThrow();
  });

  it('maps tooling through design-master concrete parts and writes audit events', () => {
    const repository = createRepository();
    const part = repository.searchParts({ query: 'ZP-A-STD-COVER-BLK' }).items[0];
    const toolingLinks = repository.getToolingLinksForPart(part.id);

    expect(toolingLinks.map((tooling) => tooling.name)).toContain('Enclosure Cover Injection Mold');

    repository.updateToolingMilestone(toolingLinks[0].id, 'dfm', {
      status: 'blocked',
      blockerReason: 'Supplier DFM question open',
    }, engineer);

    expect(repository.getAuditEvents('tooling-milestone')).toHaveLength(1);
  });
});
