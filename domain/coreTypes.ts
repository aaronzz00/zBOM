import type {
  Attachment,
  BOMNode,
  ComponentType,
  LifecycleState,
  PricingTier,
  Supplier,
  UserRole,
} from '../types';
import type { ToolingMilestoneKey } from './toolingTypes';

export type CoreEntityType =
  | 'part'
  | 'part-revision'
  | 'bom'
  | 'bom-node'
  | 'bom-snapshot'
  | 'design-master-part'
  | 'concrete-part-mapping'
  | 'tooling-record'
  | 'tooling-milestone'
  | 'supplier';

export type CoreErrorCode =
  | 'VALIDATION'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PERSISTENCE';

export class CoreRepositoryError extends Error {
  constructor(
    public readonly code: CoreErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'CoreRepositoryError';
  }
}

export interface CoreActor {
  userId: string;
  name: string;
  role: UserRole;
}

export interface CorePart {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  state: LifecycleState;
  type: ComponentType;
  imageUrl?: string;
  active: boolean;
  manufacturer?: string;
  mpn?: string;
  weightG?: number;
  customAttributes?: Record<string, unknown>;
  attachments?: Attachment[];
  cost: number;
  currency: string;
  stock: number;
  minStock: number;
  supplierId?: string;
  leadTimeWeeks?: number;
  moq?: number;
  spq?: number;
  pricingTiers?: PricingTier[];
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartRevision {
  id: string;
  partId: string;
  revision: string;
  state: LifecycleState;
  effectiveDate: string;
}

export interface CoreBOM {
  id: string;
  projectId: string;
  name: string;
  revision: string;
  rootNodeId: string;
  updatedAt: string;
}

export interface CoreBOMNode {
  id: string;
  bomId: string;
  parentId?: string;
  partId?: string;
  partRevisionId?: string;
  isLocalItem: boolean;
  partNumber: string;
  name: string;
  description?: string;
  imageUrl?: string;
  revision: string;
  state: LifecycleState;
  type: ComponentType;
  quantity: number;
  unit: string;
  cost: number;
  currency: string;
  manufacturer?: string;
  mpn?: string;
  leadTimeWeeks?: number;
  refDes?: string;
  variants?: string[];
  targetCost?: number;
  moq?: number;
  spq?: number;
  pricingTiers?: PricingTier[];
  weightG?: number;
  isAuxiliary?: boolean;
  customAttributes?: Record<string, unknown>;
  attachments?: Attachment[];
}

export interface CoreBOMSnapshot {
  id: string;
  bomId: string;
  name: string;
  timestamp: string;
  rootNodeId: string;
  nodes: CoreBOMNode[];
}

export interface CoreDesignMasterPart {
  id: string;
  projectId: string;
  structureId: string;
  code: string;
  name: string;
}

export interface ConcretePartMapping {
  id: string;
  designMasterPartId: string;
  partId: string;
  createdAt: string;
}

export interface CoreToolingMilestone {
  key: ToolingMilestoneKey;
  plannedDate?: string;
  status: 'not-started' | 'in-progress' | 'done' | 'blocked';
  actualDate?: string;
  owner?: string;
  notes?: string;
  blockerReason?: string;
}

export interface ToolingRecord {
  id: string;
  projectId: string;
  designMasterPartId: string;
  name: string;
  supplier?: string;
  cavityCount?: number;
  owner?: string;
  milestones: CoreToolingMilestone[];
  updatedAt: string;
}

export interface AVL {
  id: string;
  partId: string;
  supplierId: string;
  manufacturer: string;
  mpn: string;
  status: 'Preferred' | 'Alternate' | 'DoNotUse' | 'Pending';
}

export interface AuditEvent {
  id: string;
  entityType: CoreEntityType;
  entityId: string;
  action: string;
  actor: CoreActor;
  timestamp: string;
  summary: string;
  changes?: Record<string, unknown>;
  sourceModule: 'BOM Editor' | 'Part Library' | 'Tooling Hub' | 'Core Repository';
}

export interface CoreWorkspace {
  version: 1;
  projectId: string;
  parts: CorePart[];
  partRevisions: PartRevision[];
  suppliers: Supplier[];
  boms: CoreBOM[];
  bomNodes: CoreBOMNode[];
  bomSnapshots: CoreBOMSnapshot[];
  designMasterParts: CoreDesignMasterPart[];
  concretePartMappings: ConcretePartMapping[];
  toolingRecords: ToolingRecord[];
  avl: AVL[];
  auditEvents: AuditEvent[];
}

export interface CoreWorkspaceSnapshot extends CoreWorkspace {
  bomTree: BOMNode;
}

export interface PartSearchInput {
  query?: string;
  category?: string;
  includeInactive?: boolean;
  sortBy?: 'partNumber' | 'description' | 'category' | 'updatedAt';
  direction?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PartSearchResult {
  items: CorePart[];
  total: number;
}

export interface CreatePartInput {
  partNumber: string;
  description: string;
  category: string;
  type: ComponentType;
  state: LifecycleState;
  manufacturer?: string;
  mpn?: string;
  cost?: number;
  currency?: string;
  stock?: number;
  minStock?: number;
  supplierId?: string;
  leadTimeWeeks?: number;
  moq?: number;
  spq?: number;
  pricingTiers?: PricingTier[];
  location?: string;
  weightG?: number;
}

export interface CreateBOMNodeInput {
  bomId?: string;
  parentId: string;
  partId?: string;
  partRevisionId?: string;
  localItem?: {
    partNumber: string;
    name: string;
    revision?: string;
    type: ComponentType;
    cost?: number;
    currency?: string;
  };
  quantity: number;
  unit: string;
}

export interface CreateDesignMasterPartInput {
  projectId: string;
  structureId: string;
  code: string;
  name: string;
  concretePartIds?: string[];
}

export interface CreateToolingRecordInput {
  projectId: string;
  designMasterPartId: string;
  name: string;
  supplier?: string;
  cavityCount?: number;
  owner?: string;
  milestones?: CoreToolingMilestone[];
}
