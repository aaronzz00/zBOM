export interface HealthResponse {
  ok: true;
  service: 'zbom-api';
  environment: string;
}

export interface ApiProject {
  id: string;
  code: string;
  name: string;
  sku: string;
  phase: string;
}

export interface ApiPart {
  id: string;
  partNumber: string;
  name: string;
  description?: string | null;
  type: string;
  lifecycleState: string;
  manufacturer?: string | null;
  mpn?: string | null;
  cost?: number | null;
  currency?: string | null;
  leadTimeWeeks?: number | null;
  moq?: number | null;
  spq?: number | null;
}

export interface ApiBOMNode {
  id: string;
  partNumber: string;
  name: string;
  revision: string;
  state: string;
  type: string;
  quantity: number;
  unit: string;
  cost?: number | null;
  currency?: string | null;
  customAttributes?: Record<string, unknown>;
  partId?: string | null;
  children: ApiBOMNode[];
}

export interface ApiBOMNodeMutationResponse {
  node: ApiBOMNode;
}

export interface ApiPartMutationResponse {
  part: ApiPart;
}

export interface ApiToolingMilestone {
  id: string;
  key: string;
  status: string;
  plannedDate?: string | null;
  actualDate?: string | null;
  owner?: string | null;
  notes?: string | null;
  blockerReason?: string | null;
}

export interface ApiToolingMilestoneMutationResponse {
  milestone: ApiToolingMilestone;
}

export interface ApiToolingDesignMaster {
  id: string;
  projectId: string;
  code: string;
  name: string;
  concreteParts: ApiPart[];
}

export interface ApiToolingRecord {
  id: string;
  projectId: string;
  designMasterId: string;
  toolingNumber: string;
  name: string;
  type: string;
  status: string;
  supplier?: string | null;
  owner?: string | null;
  cavityCount?: string | null;
  leadTimeDays?: number | null;
  milestones: ApiToolingMilestone[];
}

export interface ApiToolingRecordMutationResponse {
  toolingRecord: ApiToolingRecord;
}

export interface ApiECOImpact {
  id?: string;
  partNumber: string;
  name: string;
  changeType: 'RevUp' | 'New' | 'Obsolete' | 'QtyChange';
  from?: string | null;
  to?: string | null;
}

export interface ApiECO {
  id: string;
  ecoNumber: string;
  title: string;
  description: string;
  status: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Implemented';
  initiator: string;
  createdDate: string;
  approvedBy?: string | null;
  approvalDate?: string | null;
  impacts: ApiECOImpact[];
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
}

export interface ApiWorkspaceSettings {
  flows: any[];
  flowAssociations: Record<string, string>;
  componentTypes: string[];
  lifecycleStates: string[];
  warehouseLocations: string[];
  complianceStandards: string[];
  attributeDefs: any[];
  componentTypeLabels: Record<string, string>;
  lifecycleStateLabels: Record<string, string>;
}

export interface ApiToolingResponse {
  designMasters: ApiToolingDesignMaster[];
  toolingRecords: ApiToolingRecord[];
}

export interface ApiAuditEvent {
  id: string;
  actorUserId?: string | null;
  actorName: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson?: string | null;
  afterJson?: string | null;
  createdAt: string;
}
