import type {
  AuditEvent,
  ConcretePartMapping,
  CoreActor,
  CoreBOMNode,
  CoreBOMSnapshot,
  CoreDesignMasterPart,
  CorePart,
  CoreProject,
  CoreWorkspace,
  CoreWorkspaceSnapshot,
  CreateBOMNodeInput,
  CreateDesignMasterPartInput,
  CreatePartInput,
  CreateToolingRecordInput,
  PartSearchInput,
  PartSearchResult,
  ToolingRecord,
} from '../../domain/coreTypes';
import { CoreRepositoryError } from '../../domain/coreTypes';
import { ComponentType, LifecycleState, Permission, type BOMNode, type LibraryPart } from '../../types';
import type { DesignMasterPart, Tooling, ToolingMilestone, ToolingMilestoneKey } from '../../domain/toolingTypes';
import { FormulaEngine } from '../../services/FormulaEngine';
import { createSeedCoreWorkspace } from './coreSeed';
import { assertCanUpdatePartFields, requireCorePermission, SYSTEM_ACTOR } from './corePolicy';
import {
  assertUniquePartNumber,
  validateBOMNodeUpdates,
  validateCreateBOMNodeInput,
  validateMilestone,
  validatePartInput,
  validatePartUpdates,
} from './coreValidation';

export interface CoreStorage {
  read: () => CoreWorkspace | null;
  write: (workspace: CoreWorkspace) => void;
}

export interface CoreRepository {
  loadWorkspace: () => CoreWorkspaceSnapshot;
  getProjects: () => CoreProject[];
  setActiveProject: (projectId: string) => CoreProject;
  updateProjectPhase: (projectId: string, phase: 'EVT' | 'DVT' | 'PVT' | 'MP', actor: CoreActor) => CoreProject;
  searchParts: (input?: PartSearchInput) => PartSearchResult;
  getPart: (partId: string) => CorePart;
  createPart: (input: CreatePartInput, actor: CoreActor) => CorePart;
  updatePart: (partId: string, updates: Partial<CorePart>, actor: CoreActor) => CorePart;
  archivePart: (partId: string, actor: CoreActor) => CorePart;
  getPartUsage: (partId: string) => CoreBOMNode[];
  createBOMNode: (input: CreateBOMNodeInput, actor: CoreActor) => CoreBOMNode;
  updateBOMNode: (nodeId: string, updates: Partial<CoreBOMNode>, actor: CoreActor) => CoreBOMNode;
  deleteBOMNode: (nodeId: string, actor: CoreActor) => void;
  createBOMSnapshot: (bomId: string, name: string, actor: CoreActor) => CoreBOMSnapshot;
  createDesignMasterPart: (input: CreateDesignMasterPartInput, actor: CoreActor) => CoreDesignMasterPart;
  mapConcretePart: (designMasterPartId: string, partId: string, actor: CoreActor) => ConcretePartMapping;
  unmapConcretePart: (designMasterPartId: string, partId: string, actor: CoreActor) => void;
  createToolingRecord: (input: CreateToolingRecordInput, actor: CoreActor) => ToolingRecord;
  updateToolingRecord: (toolingId: string, updates: Partial<ToolingRecord>, actor: CoreActor) => ToolingRecord;
  updateToolingMilestone: (
    toolingId: string,
    milestoneKey: ToolingMilestoneKey,
    updates: Partial<ToolingMilestone>,
    actor: CoreActor,
  ) => ToolingRecord;
  getToolingLinksForPart: (partId: string) => ToolingRecord[];
  getAuditEvents: (entityType?: AuditEvent['entityType'], entityId?: string) => AuditEvent[];
  replaceLegacyBOMTree: (tree: BOMNode, actor?: CoreActor) => void;
  replaceLegacyLibraryParts: (parts: LibraryPart[], actor?: CoreActor) => void;
  replaceLegacyTooling: (designMasterParts: DesignMasterPart[], tooling: Tooling[], actor?: CoreActor) => void;
  resetToSeed: () => void;
}

const STORAGE_KEY = 'zbom.core.workspace.v1';
const millisecondsPerDay = 24 * 60 * 60 * 1000;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const now = () => new Date().toISOString();

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const createId = (prefix: string) => {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
};

const partIdFor = (partNumber: string) => `part-${slug(partNumber)}`;
const revisionIdFor = (partId: string, revision: string) => `${partId}-rev-${slug(revision || 'a')}`;

const createAuditEvent = (
  entityType: AuditEvent['entityType'],
  entityId: string,
  action: string,
  actor: CoreActor,
  summary: string,
  sourceModule: AuditEvent['sourceModule'],
  changes?: Record<string, unknown>,
): AuditEvent => ({
  id: createId('audit'),
  entityType,
  entityId,
  action,
  actor,
  timestamp: now(),
  summary,
  sourceModule,
  changes,
});

const getStorage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function createLocalStorageCoreStorage(seed: CoreWorkspace = createSeedCoreWorkspace()): CoreStorage {
  return {
    read() {
      const storage = getStorage();
      if (!storage) {
        return clone(seed);
      }
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        const seeded = clone(seed);
        storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
      try {
        return JSON.parse(raw) as CoreWorkspace;
      } catch {
        const seeded = clone(seed);
        storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
    },
    write(workspace) {
      const storage = getStorage();
      if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      }
    },
  };
}

export function createInMemoryCoreStorage(seed: CoreWorkspace = createSeedCoreWorkspace()): CoreStorage {
  let state = clone(seed);
  return {
    read: () => clone(state),
    write: (workspace) => {
      state = clone(workspace);
    },
  };
}

const toLegacyLibraryPart = (part: CorePart): LibraryPart => ({
  id: part.id,
  partNumber: part.partNumber,
  mpn: part.mpn ?? 'N/A',
  manufacturer: part.manufacturer ?? 'Unassigned',
  description: part.description,
  imageUrl: part.imageUrl,
  category: part.category,
  state: part.active ? part.state : LifecycleState.Obsolete,
  location: part.location ?? 'WH-A',
  type: part.type,
  cost: part.cost,
  stock: part.stock,
  minStock: part.minStock,
  supplierId: part.supplierId,
  leadTimeWeeks: part.leadTimeWeeks,
  moq: part.moq,
  spq: part.spq,
  pricingTiers: part.pricingTiers,
  weightG: part.weightG,
  customAttributes: part.customAttributes,
  attachments: part.attachments,
});

export const toLegacyLibraryParts = (workspace: CoreWorkspace): LibraryPart[] => (
  workspace.parts.map(toLegacyLibraryPart)
);

const getActiveProjectId = (workspace: CoreWorkspace) => (
  workspace.activeProjectId ?? workspace.projectId ?? workspace.projects[0]?.id
);

const getActiveBOM = (workspace: CoreWorkspace) => {
  const activeProjectId = getActiveProjectId(workspace);
  return workspace.boms.find((item) => item.projectId === activeProjectId) ?? workspace.boms[0];
};

const buildBOMTree = (workspace: CoreWorkspace): BOMNode => {
  const bom = getActiveBOM(workspace);
  if (!bom) {
    throw new CoreRepositoryError('NOT_FOUND', 'No core BOM exists.');
  }
  const childrenByParent = new Map<string | undefined, CoreBOMNode[]>();
  for (const node of workspace.bomNodes.filter((item) => item.bomId === bom.id)) {
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const convert = (node: CoreBOMNode): BOMNode => {
    const part = node.partId ? workspace.parts.find((item) => item.id === node.partId) : undefined;
    const source = part && part.active ? part : undefined;
    return {
      id: node.id,
      partNumber: source?.partNumber ?? node.partNumber,
      name: source?.description ?? node.name,
      description: source?.description ?? node.description,
      imageUrl: source?.imageUrl ?? node.imageUrl,
      revision: node.revision,
      state: source?.state ?? node.state,
      type: source?.type ?? node.type,
      quantity: node.quantity,
      unit: node.unit,
      cost: source?.cost ?? node.cost,
      currency: source?.currency ?? node.currency,
      manufacturer: source?.manufacturer ?? node.manufacturer,
      mpn: source?.mpn ?? node.mpn,
      leadTimeWeeks: source?.leadTimeWeeks ?? node.leadTimeWeeks,
      refDes: node.refDes,
      variants: node.variants,
      targetCost: node.targetCost,
      moq: source?.moq ?? node.moq,
      spq: source?.spq ?? node.spq,
      pricingTiers: source?.pricingTiers ?? node.pricingTiers,
      weightG: source?.weightG ?? node.weightG,
      isAuxiliary: node.isAuxiliary,
      customAttributes: source?.customAttributes ?? node.customAttributes,
      attachments: source?.attachments ?? node.attachments,
      children: childrenByParent.get(node.id)?.map(convert),
    };
  };

  const root = workspace.bomNodes.find((node) => node.id === bom.rootNodeId);
  if (!root) {
    throw new CoreRepositoryError('NOT_FOUND', 'Core BOM root node was not found.', { rootNodeId: bom.rootNodeId });
  }
  return FormulaEngine.recalculate(convert(root));
};

const collectLegacyBOMNodes = (
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
    ...(node.children ?? []).flatMap((child) => collectLegacyBOMNodes(child, bomId, partsByNumber, node.id)),
  ];
};

const legacyPartToCore = (part: LibraryPart, existing?: CorePart): CorePart => ({
  id: existing?.id ?? part.id ?? partIdFor(part.partNumber),
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
  createdAt: existing?.createdAt ?? now(),
  updatedAt: now(),
});

const toLegacyDesignMasterParts = (workspace: CoreWorkspace): DesignMasterPart[] => {
  const activeProjectId = getActiveProjectId(workspace);
  return workspace.designMasterParts.filter((part) => part.projectId === activeProjectId).map((part) => ({
    ...part,
    concretePartNumbers: workspace.concretePartMappings
      .filter((mapping) => mapping.designMasterPartId === part.id)
      .map((mapping) => workspace.parts.find((item) => item.id === mapping.partId)?.partNumber)
      .filter((partNumber): partNumber is string => Boolean(partNumber)),
  }));
};

const toLegacyTooling = (workspace: CoreWorkspace): Tooling[] => {
  const activeProjectId = getActiveProjectId(workspace);
  return workspace.toolingRecords
    .filter((tooling) => tooling.projectId === activeProjectId)
    .map(({ updatedAt, ...tooling }) => tooling);
};

export const toLegacyToolingState = (workspace: CoreWorkspace) => ({
  designMasterParts: toLegacyDesignMasterParts(workspace),
  tooling: toLegacyTooling(workspace),
});

export function calculateLeadTimeDays(tooling: ToolingRecord | Tooling) {
  const getMilestoneDate = (milestone: ToolingMilestone | undefined) => (
    milestone?.actualDate ?? milestone?.plannedDate
  );
  const kickoff = tooling.milestones.find((milestone) => milestone.key === 'kickoff');
  const t1 = tooling.milestones.find((milestone) => milestone.key === 't1');
  const kickoffTime = getMilestoneDate(kickoff) ? new Date(getMilestoneDate(kickoff)!).getTime() : null;
  const t1Time = getMilestoneDate(t1) ? new Date(getMilestoneDate(t1)!).getTime() : null;
  if (kickoffTime === null || t1Time === null || Number.isNaN(kickoffTime) || Number.isNaN(t1Time)) {
    return null;
  }
  const leadTimeDays = Math.round((t1Time - kickoffTime) / millisecondsPerDay);
  return leadTimeDays < 0 ? null : leadTimeDays;
}

export function createCoreRepository(storage: CoreStorage = createLocalStorageCoreStorage()): CoreRepository {
  const normalizeWorkspace = (value: CoreWorkspace | null): CoreWorkspace => {
    const seed = createSeedCoreWorkspace();
    const source = value ?? seed;
    const projects = source.projects?.length ? source.projects : seed.projects;
    const requestedActiveProjectId = source.activeProjectId ?? source.projectId ?? projects[0]?.id;
    const activeProjectId = projects.some((project) => project.id === requestedActiveProjectId)
      ? requestedActiveProjectId
      : projects[0]?.id ?? seed.activeProjectId;

    return {
      ...source,
      projectId: activeProjectId,
      activeProjectId,
      projects,
    };
  };

  let workspace = normalizeWorkspace(storage.read());
  const persist = () => {
    storage.write(workspace);
  };
  const recordAudit = (event: AuditEvent) => {
    workspace = { ...workspace, auditEvents: [event, ...workspace.auditEvents] };
  };

  const loadWorkspace = (): CoreWorkspaceSnapshot => ({
    ...clone(workspace),
    bomTree: buildBOMTree(workspace),
  });

  return {
    loadWorkspace,

    getProjects() {
      return clone(workspace.projects);
    },

    setActiveProject(projectId) {
      const project = workspace.projects.find((item) => item.id === projectId);
      if (!project) {
        throw new CoreRepositoryError('NOT_FOUND', 'Project was not found.', { projectId });
      }
      workspace = { ...workspace, projectId, activeProjectId: projectId };
      persist();
      return clone(project);
    },

    updateProjectPhase(projectId, phase, actor) {
      const project = workspace.projects.find((item) => item.id === projectId);
      if (!project) {
        throw new CoreRepositoryError('NOT_FOUND', 'Project was not found.', { projectId });
      }
      const oldPhase = project.phase;
      project.phase = phase;
      project.updatedAt = now();
      
      workspace = {
        ...workspace,
        projects: workspace.projects.map((item) => item.id === projectId ? project : item),
      };
      
      recordAudit(createAuditEvent(
        'project',
        projectId,
        'transition-phase',
        actor,
        `Transitioned project ${project.name} from ${oldPhase} to ${phase}.`,
        'BOM Editor',
        { oldPhase, newPhase: phase }
      ));
      
      persist();
      return clone(project);
    },

    searchParts(input = {}) {
      const query = input.query?.trim().toLowerCase() ?? '';
      let items = workspace.parts.filter((part) => (
        (input.includeInactive || part.active) &&
        (!input.category || input.category === 'All' || part.category === input.category)
      ));
      if (query) {
        items = items.filter((part) => [
          part.partNumber,
          part.mpn,
          part.manufacturer,
          part.description,
          part.category,
          part.state,
        ].some((value) => String(value ?? '').toLowerCase().includes(query)));
      }
      const sortBy = input.sortBy ?? 'partNumber';
      const direction = input.direction === 'desc' ? -1 : 1;
      items = [...items].sort((a, b) => String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? '')) * direction);
      const total = items.length;
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? total;
      if (pageSize > 0) {
        const start = (page - 1) * pageSize;
        items = items.slice(start, start + pageSize);
      }
      return { items: clone(items), total };
    },

    getPart(partId) {
      const part = workspace.parts.find((item) => item.id === partId);
      if (!part) {
        throw new CoreRepositoryError('NOT_FOUND', 'Part was not found.', { partId });
      }
      return clone(part);
    },

    createPart(input, actor) {
      requireCorePermission(actor, Permission.EDIT_BOM_METADATA, 'create parts');
      validatePartInput(input);
      assertUniquePartNumber(workspace, input.partNumber);
      const timestamp = now();
      const part: CorePart = {
        id: partIdFor(input.partNumber),
        partNumber: input.partNumber.trim(),
        description: input.description.trim(),
        category: input.category,
        state: input.state,
        type: input.type,
        active: true,
        manufacturer: input.manufacturer,
        mpn: input.mpn,
        cost: input.cost ?? 0,
        currency: input.currency ?? 'USD',
        stock: input.stock ?? 0,
        minStock: input.minStock ?? 0,
        supplierId: input.supplierId,
        leadTimeWeeks: input.leadTimeWeeks,
        moq: input.moq,
        spq: input.spq,
        pricingTiers: input.pricingTiers,
        location: input.location,
        weightG: input.weightG,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const revision = {
        id: revisionIdFor(part.id, 'A'),
        partId: part.id,
        revision: 'A',
        state: part.state,
        effectiveDate: timestamp,
      };
      workspace = {
        ...workspace,
        parts: [...workspace.parts, part],
        partRevisions: [...workspace.partRevisions, revision],
      };
      recordAudit(createAuditEvent('part', part.id, 'create', actor, `Created part ${part.partNumber}.`, 'Part Library'));
      persist();
      return clone(part);
    },

    updatePart(partId, updates, actor) {
      const existing = workspace.parts.find((part) => part.id === partId);
      if (!existing) {
        throw new CoreRepositoryError('NOT_FOUND', 'Part was not found.', { partId });
      }
      validatePartUpdates(updates);
      assertCanUpdatePartFields(actor, updates as Record<string, unknown>);
      if (updates.partNumber) {
        assertUniquePartNumber(workspace, updates.partNumber, partId);
      }
      const updated = { ...existing, ...updates, updatedAt: now() };
      workspace = {
        ...workspace,
        parts: workspace.parts.map((part) => (part.id === partId ? updated : part)),
      };
      recordAudit(createAuditEvent('part', partId, 'update', actor, `Updated part ${updated.partNumber}.`, 'Part Library', updates));
      persist();
      return clone(updated);
    },

    archivePart(partId, actor) {
      requireCorePermission(actor, Permission.EDIT_BOM_METADATA, 'archive parts');
      return this.updatePart(partId, { active: false, state: LifecycleState.Obsolete }, actor);
    },

    getPartUsage(partId) {
      return clone(workspace.bomNodes.filter((node) => node.partId === partId));
    },

    createBOMNode(input, actor) {
      requireCorePermission(actor, Permission.EDIT_BOM_STRUCTURE, 'create BOM nodes');
      validateCreateBOMNodeInput(workspace, input);
      const bom = workspace.boms.find((item) => item.id === (input.bomId ?? getActiveBOM(workspace)?.id));
      if (!bom) {
        throw new CoreRepositoryError('NOT_FOUND', 'BOM was not found.', { bomId: input.bomId });
      }
      const part = input.partId ? workspace.parts.find((item) => item.id === input.partId) : undefined;
      const revision = input.partRevisionId
        ? workspace.partRevisions.find((item) => item.id === input.partRevisionId)
        : workspace.partRevisions.find((item) => item.partId === input.partId);
      const node: CoreBOMNode = {
        id: createId('bom-node'),
        bomId: bom.id,
        parentId: input.parentId,
        partId: part?.id,
        partRevisionId: revision?.id,
        isLocalItem: !part,
        partNumber: part?.partNumber ?? input.localItem!.partNumber.trim(),
        name: part?.description ?? input.localItem!.name.trim(),
        revision: revision?.revision ?? input.localItem?.revision ?? 'A',
        state: part?.state ?? LifecycleState.Draft,
        type: part?.type ?? input.localItem!.type,
        quantity: input.quantity,
        unit: input.unit.trim(),
        cost: part?.cost ?? input.localItem?.cost ?? 0,
        currency: part?.currency ?? input.localItem?.currency ?? 'USD',
        manufacturer: part?.manufacturer,
        mpn: part?.mpn,
        leadTimeWeeks: part?.leadTimeWeeks,
        moq: part?.moq,
        spq: part?.spq,
        pricingTiers: part?.pricingTiers,
        weightG: part?.weightG,
      };
      workspace = {
        ...workspace,
        bomNodes: [...workspace.bomNodes, node],
        boms: workspace.boms.map((item) => item.id === bom.id ? { ...item, updatedAt: now() } : item),
      };
      recordAudit(createAuditEvent('bom-node', node.id, 'create', actor, `Added ${node.partNumber} to BOM.`, 'BOM Editor'));
      persist();
      return clone(node);
    },

    updateBOMNode(nodeId, updates, actor) {
      requireCorePermission(actor, Permission.EDIT_BOM_METADATA, 'update BOM nodes');
      validateBOMNodeUpdates(updates);
      const existing = workspace.bomNodes.find((node) => node.id === nodeId);
      if (!existing) {
        throw new CoreRepositoryError('NOT_FOUND', 'BOM node was not found.', { nodeId });
      }
      const updated = { ...existing, ...updates, id: existing.id, bomId: existing.bomId };
      workspace = {
        ...workspace,
        bomNodes: workspace.bomNodes.map((node) => (node.id === nodeId ? updated : node)),
        boms: workspace.boms.map((bom) => bom.id === existing.bomId ? { ...bom, updatedAt: now() } : bom),
      };
      recordAudit(createAuditEvent('bom-node', nodeId, 'update', actor, `Updated BOM node ${updated.partNumber}.`, 'BOM Editor', updates));
      persist();
      return clone(updated);
    },

    deleteBOMNode(nodeId, actor) {
      requireCorePermission(actor, Permission.EDIT_BOM_STRUCTURE, 'delete BOM nodes');
      const existing = workspace.bomNodes.find((node) => node.id === nodeId);
      if (!existing) {
        throw new CoreRepositoryError('NOT_FOUND', 'BOM node was not found.', { nodeId });
      }
      if (workspace.boms.some((bom) => bom.rootNodeId === nodeId)) {
        throw new CoreRepositoryError('VALIDATION', 'Root BOM node cannot be deleted.', { nodeId });
      }
      const toDelete = new Set<string>([nodeId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of workspace.bomNodes) {
          if (node.parentId && toDelete.has(node.parentId) && !toDelete.has(node.id)) {
            toDelete.add(node.id);
            changed = true;
          }
        }
      }
      workspace = {
        ...workspace,
        bomNodes: workspace.bomNodes.filter((node) => !toDelete.has(node.id)),
        boms: workspace.boms.map((bom) => bom.id === existing.bomId ? { ...bom, updatedAt: now() } : bom),
      };
      recordAudit(createAuditEvent('bom-node', nodeId, 'delete', actor, `Deleted BOM node ${existing.partNumber}.`, 'BOM Editor'));
      persist();
    },

    createBOMSnapshot(bomId, name, actor) {
      requireCorePermission(actor, Permission.VIEW_BOM, 'create BOM snapshots');
      const bom = workspace.boms.find((item) => item.id === bomId);
      if (!bom) {
        throw new CoreRepositoryError('NOT_FOUND', 'BOM was not found.', { bomId });
      }
      const snapshot: CoreBOMSnapshot = {
        id: createId('snap'),
        bomId,
        name: name.trim() || `Snapshot ${new Date().toLocaleTimeString()}`,
        timestamp: now(),
        rootNodeId: bom.rootNodeId,
        nodes: clone(workspace.bomNodes.filter((node) => node.bomId === bomId)),
      };
      workspace = { ...workspace, bomSnapshots: [snapshot, ...workspace.bomSnapshots] };
      recordAudit(createAuditEvent('bom-snapshot', snapshot.id, 'create', actor, `Created BOM snapshot ${snapshot.name}.`, 'BOM Editor'));
      persist();
      return clone(snapshot);
    },

    createDesignMasterPart(input, actor) {
      requireCorePermission(actor, Permission.MANAGE_TOOLING, 'create design-master parts');
      if (!input.code.trim() || !input.name.trim()) {
        throw new CoreRepositoryError('VALIDATION', 'Design-master code and name are required.');
      }
      const duplicate = workspace.designMasterParts.find((part) => part.code.toLowerCase() === input.code.toLowerCase());
      if (duplicate) {
        throw new CoreRepositoryError('CONFLICT', `Design-master code ${input.code} already exists.`, { code: input.code });
      }
      const designMasterPart: CoreDesignMasterPart = {
        id: `dmp-${slug(input.code)}`,
        projectId: input.projectId,
        structureId: input.structureId,
        code: input.code,
        name: input.name,
      };
      workspace = { ...workspace, designMasterParts: [...workspace.designMasterParts, designMasterPart] };
      for (const partId of input.concretePartIds ?? []) {
        this.mapConcretePart(designMasterPart.id, partId, actor);
      }
      recordAudit(createAuditEvent('design-master-part', designMasterPart.id, 'create', actor, `Created design master ${input.code}.`, 'Tooling Hub'));
      persist();
      return clone(designMasterPart);
    },

    mapConcretePart(designMasterPartId, partId, actor) {
      requireCorePermission(actor, Permission.MANAGE_TOOLING, 'map concrete parts');
      if (!workspace.designMasterParts.some((part) => part.id === designMasterPartId)) {
        throw new CoreRepositoryError('NOT_FOUND', 'Design-master part was not found.', { designMasterPartId });
      }
      if (!workspace.parts.some((part) => part.id === partId && part.active)) {
        throw new CoreRepositoryError('NOT_FOUND', 'Concrete part was not found or inactive.', { partId });
      }
      const existing = workspace.concretePartMappings.find((mapping) => (
        mapping.designMasterPartId === designMasterPartId && mapping.partId === partId
      ));
      if (existing) {
        return clone(existing);
      }
      const mapping: ConcretePartMapping = {
        id: createId('mapping'),
        designMasterPartId,
        partId,
        createdAt: now(),
      };
      workspace = { ...workspace, concretePartMappings: [...workspace.concretePartMappings, mapping] };
      recordAudit(createAuditEvent('concrete-part-mapping', mapping.id, 'create', actor, 'Mapped concrete part to design master.', 'Tooling Hub'));
      persist();
      return clone(mapping);
    },

    unmapConcretePart(designMasterPartId, partId, actor) {
      requireCorePermission(actor, Permission.MANAGE_TOOLING, 'unmap concrete parts');
      const existing = workspace.concretePartMappings.find((mapping) => (
        mapping.designMasterPartId === designMasterPartId && mapping.partId === partId
      ));
      if (!existing) {
        throw new CoreRepositoryError('NOT_FOUND', 'Concrete part mapping was not found.', { designMasterPartId, partId });
      }
      workspace = {
        ...workspace,
        concretePartMappings: workspace.concretePartMappings.filter((mapping) => mapping.id !== existing.id),
      };
      recordAudit(createAuditEvent('concrete-part-mapping', existing.id, 'delete', actor, 'Removed concrete part from design master.', 'Tooling Hub'));
      persist();
    },

    createToolingRecord(input, actor) {
      requireCorePermission(actor, Permission.MANAGE_TOOLING, 'create tooling records');
      if (!workspace.designMasterParts.some((part) => part.id === input.designMasterPartId)) {
        throw new CoreRepositoryError('NOT_FOUND', 'Design-master part was not found.', { designMasterPartId: input.designMasterPartId });
      }
      const tooling: ToolingRecord = {
        id: createId('tooling'),
        projectId: input.projectId,
        designMasterPartId: input.designMasterPartId,
        name: input.name,
        supplier: input.supplier,
        cavityCount: input.cavityCount,
        owner: input.owner,
        milestones: input.milestones ?? [
          { key: 'drawingRelease', status: 'not-started' },
          { key: 'dfm', status: 'not-started' },
          { key: 'quotation', status: 'not-started' },
          { key: 'kickoff', status: 'not-started' },
          { key: 't1', status: 'not-started' },
        ],
        updatedAt: now(),
      };
      workspace = { ...workspace, toolingRecords: [...workspace.toolingRecords, tooling] };
      recordAudit(createAuditEvent('tooling-record', tooling.id, 'create', actor, `Created tooling record ${tooling.name}.`, 'Tooling Hub'));
      persist();
      return clone(tooling);
    },

    updateToolingRecord(toolingId, updates, actor) {
      requireCorePermission(actor, Permission.MANAGE_TOOLING, 'update tooling records');
      const existing = workspace.toolingRecords.find((tooling) => tooling.id === toolingId);
      if (!existing) {
        throw new CoreRepositoryError('NOT_FOUND', 'Tooling record was not found.', { toolingId });
      }
      const updated = { ...existing, ...updates, id: existing.id, updatedAt: now() };
      workspace = {
        ...workspace,
        toolingRecords: workspace.toolingRecords.map((tooling) => tooling.id === toolingId ? updated : tooling),
      };
      recordAudit(createAuditEvent('tooling-record', toolingId, 'update', actor, `Updated tooling record ${updated.name}.`, 'Tooling Hub', updates));
      persist();
      return clone(updated);
    },

    updateToolingMilestone(toolingId, milestoneKey, updates, actor) {
      requireCorePermission(actor, Permission.MANAGE_TOOLING, 'update tooling milestones');
      validateMilestone(updates);
      const existing = workspace.toolingRecords.find((tooling) => tooling.id === toolingId);
      if (!existing) {
        throw new CoreRepositoryError('NOT_FOUND', 'Tooling record was not found.', { toolingId });
      }
      const hasMilestone = existing.milestones.some((milestone) => milestone.key === milestoneKey);
      if (!hasMilestone) {
        throw new CoreRepositoryError('NOT_FOUND', 'Tooling milestone was not found.', { toolingId, milestoneKey });
      }
      const updated = {
        ...existing,
        milestones: existing.milestones.map((milestone) => (
          milestone.key === milestoneKey ? { ...milestone, ...updates, key: milestone.key } : milestone
        )),
        updatedAt: now(),
      };
      workspace = {
        ...workspace,
        toolingRecords: workspace.toolingRecords.map((tooling) => tooling.id === toolingId ? updated : tooling),
      };
      recordAudit(createAuditEvent(
        'tooling-milestone',
        `${toolingId}:${milestoneKey}`,
        'update',
        actor,
        `Updated ${milestoneKey} milestone for ${existing.name}.`,
        'Tooling Hub',
        updates,
      ));
      persist();
      return clone(updated);
    },

    getToolingLinksForPart(partId) {
      const activeProjectId = getActiveProjectId(workspace);
      const designMasterIds = workspace.concretePartMappings
        .filter((mapping) => mapping.partId === partId)
        .map((mapping) => mapping.designMasterPartId);
      return clone(workspace.toolingRecords.filter((tooling) => (
        tooling.projectId === activeProjectId && designMasterIds.includes(tooling.designMasterPartId)
      )));
    },

    getAuditEvents(entityType, entityId) {
      return clone(workspace.auditEvents.filter((event) => (
        (!entityType || event.entityType === entityType) &&
        (!entityId || event.entityId === entityId)
      )));
    },

    replaceLegacyBOMTree(tree, actor = SYSTEM_ACTOR) {
      const bom = getActiveBOM(workspace);
      if (!bom) {
        throw new CoreRepositoryError('NOT_FOUND', 'No core BOM exists.');
      }
      const partsByNumber = new Map(workspace.parts.map((part) => [part.partNumber, part]));
      const nodes = collectLegacyBOMNodes(tree, bom.id, partsByNumber);
      workspace = {
        ...workspace,
        boms: workspace.boms.map((item) => item.id === bom.id ? {
          ...item,
          name: tree.name,
          revision: tree.revision,
          rootNodeId: tree.id,
          updatedAt: now(),
        } : item),
        bomNodes: [
          ...workspace.bomNodes.filter((node) => node.bomId !== bom.id),
          ...nodes,
        ],
      };
      recordAudit(createAuditEvent('bom', bom.id, 'replace-tree', actor, 'Replaced BOM tree from legacy editor flow.', 'BOM Editor'));
      persist();
    },

    replaceLegacyLibraryParts(parts, actor = SYSTEM_ACTOR) {
      const existingByPartNumber = new Map(workspace.parts.map((part) => [part.partNumber, part]));
      const coreParts = parts.map((part) => legacyPartToCore(part, existingByPartNumber.get(part.partNumber)));
      const knownPartIds = new Set(coreParts.map((part) => part.id));
      const retainedSyntheticParts = workspace.parts.filter((part) => !knownPartIds.has(part.id) && part.partNumber.startsWith('ZP-'));
      workspace = {
        ...workspace,
        parts: [...coreParts, ...retainedSyntheticParts],
      };
      recordAudit(createAuditEvent('part', 'bulk-library', 'replace-library', actor, 'Replaced library parts from legacy Part Library flow.', 'Part Library'));
      persist();
    },

    replaceLegacyTooling(designMasterParts, tooling, actor = SYSTEM_ACTOR) {
      const activeProjectId = getActiveProjectId(workspace);
      let nextParts = workspace.parts;
      const partsByNumber = new Map(nextParts.map((part) => [part.partNumber, part]));
      const designMasters = designMasterParts.map(({ concretePartNumbers, ...part }) => ({
        ...part,
        projectId: activeProjectId,
      }));
      const mappings = designMasterParts.flatMap((designMasterPart) => (
        designMasterPart.concretePartNumbers.map((partNumber) => {
          let part = partsByNumber.get(partNumber);
          if (!part) {
            part = {
              id: partIdFor(partNumber),
              partNumber,
              description: `${designMasterPart.name} concrete part`,
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
              createdAt: now(),
              updatedAt: now(),
            };
            nextParts = [...nextParts, part];
            partsByNumber.set(partNumber, part);
          }
          return {
            id: `mapping-${slug(designMasterPart.id)}-${slug(part.partNumber)}`,
            designMasterPartId: designMasterPart.id,
            partId: part.id,
            createdAt: now(),
          };
        })
      ));
      const activeDesignMasterIds = new Set(designMasters.map((part) => part.id));
      workspace = {
        ...workspace,
        parts: nextParts,
        designMasterParts: [
          ...workspace.designMasterParts.filter((part) => part.projectId !== activeProjectId),
          ...designMasters,
        ],
        concretePartMappings: [
          ...workspace.concretePartMappings.filter((mapping) => !activeDesignMasterIds.has(mapping.designMasterPartId)),
          ...mappings,
        ],
        toolingRecords: [
          ...workspace.toolingRecords.filter((item) => item.projectId !== activeProjectId),
          ...tooling.map((item) => ({ ...item, projectId: activeProjectId, updatedAt: now() })),
        ],
      };
      recordAudit(createAuditEvent('tooling-record', 'bulk-tooling', 'replace-tooling', actor, 'Replaced tooling records from legacy Tooling Hub flow.', 'Tooling Hub'));
      persist();
    },

    resetToSeed() {
      workspace = createSeedCoreWorkspace();
      persist();
    },
  };
}

export const coreRepository = createCoreRepository();
