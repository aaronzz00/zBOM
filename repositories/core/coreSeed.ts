import { complexBOM, mockProject, previousBOM } from '../../data/mockBOM';
import { mockLibraryData } from '../../data/mockLibrary';
import { mockSuppliers } from '../../data/mockSuppliers';
import { mockDesignMasterParts, mockTooling } from '../../data/mockTooling';
import type {
  ConcretePartMapping,
  CoreBOMNode,
  CoreBOMSnapshot,
  CorePart,
  CoreWorkspace,
  PartRevision,
} from '../../domain/coreTypes';
import type { BOMNode, LibraryPart } from '../../types';
import { ComponentType, LifecycleState } from '../../types';

const SEED_TIMESTAMP = '2026-06-05T00:00:00.000Z';
const DEFAULT_BOM_ID = 'bom-zphone-pro';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const partIdFor = (partNumber: string) => `part-${slug(partNumber)}`;
const revisionIdFor = (partId: string, revision: string) => `${partId}-rev-${slug(revision || 'a')}`;

const libraryPartToCorePart = (part: LibraryPart): CorePart => ({
  id: partIdFor(part.partNumber),
  partNumber: part.partNumber,
  description: part.description,
  category: part.category,
  state: part.state,
  type: part.type ?? ComponentType.Part,
  imageUrl: part.imageUrl,
  active: part.state !== LifecycleState.Obsolete,
  manufacturer: part.manufacturer,
  mpn: part.mpn,
  weightG: part.weightG,
  customAttributes: part.customAttributes,
  attachments: part.attachments,
  cost: part.cost,
  currency: 'USD',
  stock: part.stock,
  minStock: part.minStock,
  supplierId: part.supplierId,
  leadTimeWeeks: part.leadTimeWeeks,
  moq: part.moq,
  spq: part.spq,
  pricingTiers: part.pricingTiers,
  location: part.location,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
});

const createRevisionForPart = (part: CorePart, revision = 'A'): PartRevision => ({
  id: revisionIdFor(part.id, revision),
  partId: part.id,
  revision,
  state: part.state,
  effectiveDate: SEED_TIMESTAMP,
});

const collectBOMNodes = (
  node: BOMNode,
  bomId: string,
  partsByNumber: Map<string, CorePart>,
  parentId?: string,
): CoreBOMNode[] => {
  const part = partsByNumber.get(node.partNumber);
  const coreNode: CoreBOMNode = {
    id: node.id,
    bomId,
    parentId,
    partId: part?.id,
    partRevisionId: part ? revisionIdFor(part.id, node.revision || 'A') : undefined,
    isLocalItem: !part,
    partNumber: node.partNumber,
    name: node.name,
    description: node.description,
    imageUrl: node.imageUrl,
    revision: node.revision,
    state: node.state,
    type: node.type,
    quantity: node.quantity,
    unit: node.unit,
    cost: node.cost,
    currency: node.currency,
    manufacturer: node.manufacturer,
    mpn: node.mpn,
    leadTimeWeeks: node.leadTimeWeeks,
    refDes: node.refDes,
    variants: node.variants,
    targetCost: node.targetCost,
    moq: node.moq,
    spq: node.spq,
    pricingTiers: node.pricingTiers,
    weightG: node.weightG,
    isAuxiliary: node.isAuxiliary,
    customAttributes: node.customAttributes,
    attachments: node.attachments,
  };

  return [
    coreNode,
    ...(node.children ?? []).flatMap((child) => collectBOMNodes(child, bomId, partsByNumber, node.id)),
  ];
};

const ensureSyntheticPart = (
  partsByNumber: Map<string, CorePart>,
  partNumber: string,
  description: string,
) => {
  const existing = partsByNumber.get(partNumber);
  if (existing) {
    return existing;
  }

  const part: CorePart = {
    id: partIdFor(partNumber),
    partNumber,
    description,
    category: 'Mechanical',
    state: LifecycleState.Draft,
    type: ComponentType.Part,
    active: true,
    manufacturer: 'Unassigned',
    mpn: 'N/A',
    cost: 0,
    currency: 'USD',
    stock: 0,
    minStock: 0,
    location: 'WH-A-NEW',
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
  partsByNumber.set(partNumber, part);
  return part;
};

export function createSeedCoreWorkspace(): CoreWorkspace {
  const partsByNumber = new Map<string, CorePart>();
  for (const part of mockLibraryData.map(libraryPartToCorePart)) {
    partsByNumber.set(part.partNumber, part);
  }

  for (const designMasterPart of mockDesignMasterParts) {
    for (const partNumber of designMasterPart.concretePartNumbers) {
      ensureSyntheticPart(partsByNumber, partNumber, `${designMasterPart.name} concrete part`);
    }
  }

  const parts = Array.from(partsByNumber.values());
  const partRevisions = parts.map((part) => createRevisionForPart(part));
  const bomNodes = collectBOMNodes(complexBOM, DEFAULT_BOM_ID, partsByNumber);

  for (const node of bomNodes) {
    if (node.partId && !partRevisions.some((revision) => revision.id === node.partRevisionId)) {
      partRevisions.push(createRevisionForPart(partsByNumber.get(node.partNumber)!, node.revision || 'A'));
    }
  }

  const concretePartMappings: ConcretePartMapping[] = mockDesignMasterParts.flatMap((designMasterPart) => (
    designMasterPart.concretePartNumbers.map((partNumber) => {
      const part = partsByNumber.get(partNumber)!;
      return {
        id: `mapping-${slug(designMasterPart.id)}-${slug(part.partNumber)}`,
        designMasterPartId: designMasterPart.id,
        partId: part.id,
        createdAt: SEED_TIMESTAMP,
      };
    })
  ));

  const bomSnapshots: CoreBOMSnapshot[] = [{
    id: 'snap-001',
    bomId: DEFAULT_BOM_ID,
    name: 'Baseline (Rev A.01)',
    timestamp: '2026-05-28T00:00:00.000Z',
    rootNodeId: previousBOM.id,
    nodes: collectBOMNodes(previousBOM, DEFAULT_BOM_ID, partsByNumber),
  }];

  return {
    version: 1,
    projectId: mockProject.id,
    parts,
    partRevisions,
    suppliers: clone(mockSuppliers),
    boms: [{
      id: DEFAULT_BOM_ID,
      projectId: mockProject.id,
      name: complexBOM.name,
      revision: complexBOM.revision,
      rootNodeId: complexBOM.id,
      updatedAt: SEED_TIMESTAMP,
    }],
    bomNodes,
    bomSnapshots,
    designMasterParts: clone(mockDesignMasterParts.map(({ concretePartNumbers, ...part }) => part)),
    concretePartMappings,
    toolingRecords: clone(mockTooling.map((tooling) => ({
      ...tooling,
      updatedAt: SEED_TIMESTAMP,
    }))),
    avl: parts.flatMap((part) => (
      part.supplierId
        ? [{
          id: `avl-${part.id}-${part.supplierId}`,
          partId: part.id,
          supplierId: part.supplierId,
          manufacturer: part.manufacturer ?? 'Unassigned',
          mpn: part.mpn ?? 'N/A',
          status: 'Preferred' as const,
        }]
        : []
    )),
    auditEvents: [],
  };
}
