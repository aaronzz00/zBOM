import type {
  ApiBOMNode,
  ApiPart,
  ApiProject,
  ApiToolingRecord,
  ApiToolingResponse,
  ApiToolingMilestone,
  ApiECO,
} from '../shared/apiTypes';
import type { ApiAuditEvent, ApiWorkspaceSettings } from '../shared/apiTypes';
export type { ApiAuditEvent, ApiWorkspaceSettings };
import { ComponentType, LifecycleState, type BOMNode, type LibraryPart, type Project, type UserRole, type ECO } from '../types';
import type { DesignMasterPart, Tooling, ToolingMilestone, ToolingMilestoneKey } from '../domain/toolingTypes';

interface ProjectsResponse {
  projects: ApiProject[];
}

interface BOMResponse {
  projectId: string;
  roots: ApiBOMNode[];
}

interface PartsResponse {
  parts: ApiPart[];
}

type BackendChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

interface BackendChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export interface BackendWorkspaceSnapshot {
  activeProjectId: string;
  project: Project;
  projects: Project[];
  bomData: BOMNode;
  libraryParts: LibraryPart[];
  designMasterParts: DesignMasterPart[];
  tooling: Tooling[];
  settings?: ApiWorkspaceSettings;
  ecos?: ECO[];
}

export interface BackendAIProviderSettings {
  enabled: boolean;
  providerType: 'openai-compatible';
  baseUrl: string;
  model: string;
  temperature: number;
  apiKey?: string;
  clearApiKey?: boolean;
}

const apiBaseUrl = () => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export const isBackendApiConfigured = () => apiBaseUrl().length > 0;

export const isLocalRepositoryFallbackEnabled = () => (
  import.meta.env.VITE_ENABLE_LOCAL_REPOSITORY_FALLBACK !== 'false'
);

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const isWriteAuthError = response.status === 403 || 
                             (response.status === 401 && options.method && options.method !== 'GET');
    if (isWriteAuthError) {
      window.dispatchEvent(new CustomEvent('zbom:auth-required'));
    }
    const body = await response.text();
    throw new Error(`API ${response.status} ${path}: ${body || response.statusText}`);
  }

  if (response.status === 204) {
    return null as unknown as T;
  }

  return response.json() as Promise<T>;
};

export interface BackendUserSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  workspace: {
    id: string;
    name: string;
  };
  actor: {
    userId: string;
    workspaceId: string;
    role: UserRole;
    permissions: string[];
  };
}

export const getBackendUser = async (): Promise<BackendUserSession> => {
  return apiFetch<BackendUserSession>('/api/auth/me');
};

const ensureBackendSession = async (role: UserRole) => {
  await apiFetch('/api/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
};

const toProject = (project: ApiProject): Project => ({
  id: project.id,
  code: project.code,
  name: project.name,
  sku: project.sku,
  phase: project.phase as Project['phase'],
  lastModified: new Date().toISOString(),
  totalCost: 0,
  totalWeight: 0,
});

const toLifecycleState = (value: string): LifecycleState => {
  return Object.values(LifecycleState).includes(value as LifecycleState)
    ? value as LifecycleState
    : LifecycleState.Draft;
};

const toComponentType = (value: string): ComponentType => {
  return Object.values(ComponentType).includes(value as ComponentType)
    ? value as ComponentType
    : ComponentType.Part;
};

const toBOMNode = (node: ApiBOMNode): BOMNode => ({
  id: node.id,
  partNumber: node.partNumber,
  name: node.name,
  revision: node.revision,
  state: toLifecycleState(node.state),
  type: toComponentType(node.type),
  quantity: node.quantity,
  unit: node.unit,
  cost: node.cost ?? 0,
  currency: node.currency ?? 'USD',
  customAttributes: node.customAttributes,
  children: node.children?.map(toBOMNode) ?? [],
});

const toLibraryPart = (part: ApiPart): LibraryPart => ({
  id: part.id,
  partNumber: part.partNumber,
  mpn: part.mpn ?? 'N/A',
  manufacturer: part.manufacturer ?? 'Unassigned',
  description: part.description ?? part.name,
  category: part.type,
  state: toLifecycleState(part.lifecycleState),
  location: 'API',
  type: toComponentType(part.type),
  cost: part.cost ?? 0,
  stock: 0,
  minStock: 0,
  leadTimeWeeks: part.leadTimeWeeks ?? undefined,
  moq: part.moq ?? undefined,
  spq: part.spq ?? undefined,
});

const toMilestoneKey = (value: string): ToolingMilestoneKey => {
  return ['drawingRelease', 'dfm', 'quotation', 'kickoff', 't1'].includes(value)
    ? value as ToolingMilestoneKey
    : 'kickoff';
};

const toMilestoneStatus = (value: string): ToolingMilestone['status'] => {
  const normalized = value.toLowerCase().replace(/_/g, '-');
  if (normalized === 'done') return 'done';
  if (normalized === 'in-progress') return 'in-progress';
  if (normalized === 'blocked') return 'blocked';
  return 'not-started';
};

const toToolingMilestone = (record: ApiToolingRecord['milestones'][number]): ToolingMilestone => ({
  id: record.id,
  key: toMilestoneKey(record.key),
  status: toMilestoneStatus(record.status),
  plannedDate: record.plannedDate ?? undefined,
  actualDate: record.actualDate ?? undefined,
  owner: record.owner ?? undefined,
  notes: record.notes ?? undefined,
  blockerReason: record.blockerReason ?? undefined,
});

const toToolingRecord = (record: ApiToolingRecord): Tooling => ({
  id: record.id,
  projectId: record.projectId,
  designMasterPartId: record.designMasterId,
  name: record.name,
  supplier: record.supplier ?? undefined,
  cavityCount: record.cavityCount ?? undefined,
  owner: record.owner ?? undefined,
  milestones: record.milestones.map(toToolingMilestone),
});

const pickActiveProject = (projects: Project[], requestedProjectId?: string) => {
  return projects.find((project) => project.id === requestedProjectId) ?? projects[0];
};

export const loadBackendWorkspace = async (
  role: UserRole,
  requestedProjectId?: string
): Promise<BackendWorkspaceSnapshot> => {
  if (isBackendApiConfigured()) {
    try {
      const currentMe = await getBackendUser();
      if (currentMe.actor.role !== role) {
        await ensureBackendSession(role);
      }
    } catch {
      await ensureBackendSession(role);
    }
  }

  const projectsResponse = await apiFetch<ProjectsResponse>('/api/projects');
  const projects = projectsResponse.projects.map(toProject);
  const activeProject = pickActiveProject(projects, requestedProjectId);

  if (!activeProject) {
    throw new Error('API returned no projects.');
  }

  const [bomResponse, partsResponse, toolingResponse, settingsResponse, ecosResponse] = await Promise.all([
    apiFetch<BOMResponse>(`/api/projects/${activeProject.id}/bom`),
    apiFetch<PartsResponse>('/api/parts'),
    apiFetch<ApiToolingResponse>('/api/tooling'),
    apiFetch<{ settings: ApiWorkspaceSettings }>('/api/workspace/settings').catch((e) => {
      console.warn('Workspace settings API failed, returning null', e);
      return null;
    }),
    apiFetch<{ ecos: ApiECO[] }>('/api/ecos').catch((e) => {
      console.warn('ECOs API failed, returning empty list', e);
      return { ecos: [] };
    }),
  ]);

  const root = bomResponse.roots[0];
  if (!root) {
    throw new Error(`API returned no BOM root for project ${activeProject.id}.`);
  }

  const mappedSettings = settingsResponse?.settings ?? undefined;
  const mappedEcos = ecosResponse?.ecos ? ecosResponse.ecos.map(eco => ({
    id: eco.id,
    ecoNumber: eco.ecoNumber,
    title: eco.title,
    description: eco.description,
    status: eco.status,
    initiator: eco.initiator,
    createdDate: eco.createdDate,
    approvedBy: eco.approvedBy ?? undefined,
    approvalDate: eco.approvalDate ?? undefined,
    priority: eco.priority,
    impacts: eco.impacts.map(imp => ({
      partNumber: imp.partNumber,
      name: imp.name,
      changeType: imp.changeType,
      from: imp.from ?? undefined,
      to: imp.to ?? undefined
    }))
  })) : [];

  return {
    activeProjectId: activeProject.id,
    project: activeProject,
    projects,
    bomData: toBOMNode(root),
    libraryParts: partsResponse.parts.map(toLibraryPart),
    designMasterParts: toolingResponse.designMasters.map((designMaster) => ({
      id: designMaster.id,
      projectId: designMaster.projectId,
      structureId: designMaster.id,
      code: designMaster.code,
      name: designMaster.name,
      concretePartNumbers: designMaster.concreteParts.map((part) => part.partNumber),
    })),
    tooling: toolingResponse.toolingRecords.map(toToolingRecord),
    settings: mappedSettings,
    ecos: mappedEcos,
  };
};

export const requestBackendChatCompletion = async (
  messages: BackendChatMessage[],
  purpose = 'bom-assistant'
) => {
  return apiFetch<BackendChatCompletionResponse>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ purpose, messages }),
  });
};

export const saveBackendAIProvider = async (settings: BackendAIProviderSettings) => {
  return apiFetch('/api/ai/provider', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
};

export const addBackendBOMNode = async (
  projectId: string,
  node: {
    parentId: string | null;
    partId?: string | null;
    partNumber?: string;
    name?: string;
    revision?: string;
    state?: string;
    type?: string;
    quantity?: number;
    unit?: string;
    cost?: number | null;
    currency?: string | null;
    customAttributes?: Record<string, unknown>;
  }
): Promise<{ node: ApiBOMNode }> => {
  return apiFetch<{ node: ApiBOMNode }>(`/api/projects/${projectId}/bom`, {
    method: 'POST',
    body: JSON.stringify(node),
  });
};

export const updateBackendBOMNode = async (
  projectId: string,
  nodeId: string,
  updates: {
    parentId?: string | null;
    partId?: string | null;
    partNumber?: string;
    name?: string;
    revision?: string;
    state?: string;
    type?: string;
    quantity?: number;
    unit?: string;
    cost?: number | null;
    currency?: string | null;
    customAttributes?: Record<string, unknown>;
  }
): Promise<{ node: ApiBOMNode }> => {
  return apiFetch<{ node: ApiBOMNode }>(`/api/projects/${projectId}/bom/${nodeId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
};

export const deleteBackendBOMNode = async (projectId: string, nodeId: string): Promise<void> => {
  await apiFetch<void>(`/api/projects/${projectId}/bom/${nodeId}`, {
    method: 'DELETE',
  });
};

export const createBackendPart = async (
  part: {
    partNumber: string;
    name: string;
    description?: string | null;
    type?: string;
    lifecycleState?: string;
    manufacturer?: string | null;
    mpn?: string | null;
    cost?: number | null;
    currency?: string | null;
    leadTimeWeeks?: number | null;
    moq?: number | null;
    spq?: number | null;
  }
): Promise<{ part: ApiPart }> => {
  return apiFetch<{ part: ApiPart }>('/api/parts', {
    method: 'POST',
    body: JSON.stringify(part),
  });
};

export const updateBackendPart = async (
  partId: string,
  updates: {
    name?: string;
    description?: string | null;
    type?: string;
    lifecycleState?: string;
    manufacturer?: string | null;
    mpn?: string | null;
    cost?: number | null;
    currency?: string | null;
    leadTimeWeeks?: number | null;
    moq?: number | null;
    spq?: number | null;
  }
): Promise<{ part: ApiPart }> => {
  return apiFetch<{ part: ApiPart }>(`/api/parts/${partId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
};

export const updateBackendToolingMilestone = async (
  milestoneId: string,
  updates: {
    status?: string;
    plannedDate?: string | null;
    actualDate?: string | null;
    owner?: string | null;
    notes?: string | null;
    blockerReason?: string | null;
  }
): Promise<{ milestone: ApiToolingMilestone }> => {
  return apiFetch<{ milestone: ApiToolingMilestone }>(`/api/tooling/milestones/${milestoneId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
};

export const loadBackendECOs = async (): Promise<ECO[]> => {
  const response = await apiFetch<{ ecos: ApiECO[] }>('/api/ecos');
  return response.ecos.map(eco => ({
    id: eco.id,
    ecoNumber: eco.ecoNumber,
    title: eco.title,
    description: eco.description,
    status: eco.status,
    initiator: eco.initiator,
    createdDate: eco.createdDate,
    approvedBy: eco.approvedBy ?? undefined,
    approvalDate: eco.approvalDate ?? undefined,
    priority: eco.priority,
    impacts: eco.impacts.map(imp => ({
      partNumber: imp.partNumber,
      name: imp.name,
      changeType: imp.changeType,
      from: imp.from ?? undefined,
      to: imp.to ?? undefined
    }))
  }));
};

export const createBackendECO = async (eco: {
  title: string;
  description: string;
  initiator: string;
  priority: string;
  impacts: any[];
}): Promise<ECO> => {
  const response = await apiFetch<{ eco: ApiECO }>('/api/ecos', {
    method: 'POST',
    body: JSON.stringify(eco)
  });
  const newEco = response.eco;
  return {
    id: newEco.id,
    ecoNumber: newEco.ecoNumber,
    title: newEco.title,
    description: newEco.description,
    status: newEco.status,
    initiator: newEco.initiator,
    createdDate: newEco.createdDate,
    approvedBy: newEco.approvedBy ?? undefined,
    approvalDate: newEco.approvalDate ?? undefined,
    priority: newEco.priority,
    impacts: newEco.impacts.map(imp => ({
      partNumber: imp.partNumber,
      name: imp.name,
      changeType: imp.changeType,
      from: imp.from ?? undefined,
      to: imp.to ?? undefined
    }))
  };
};

export const updateBackendECO = async (ecoId: string, updates: {
  status?: string;
  priority?: string;
  approvedBy?: string | null;
  approvalDate?: string | null;
}): Promise<ECO> => {
  const response = await apiFetch<{ eco: ApiECO }>(`/api/ecos/${ecoId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
  const updatedEco = response.eco;
  return {
    id: updatedEco.id,
    ecoNumber: updatedEco.ecoNumber,
    title: updatedEco.title,
    description: updatedEco.description,
    status: updatedEco.status,
    initiator: updatedEco.initiator,
    createdDate: updatedEco.createdDate,
    approvedBy: updatedEco.approvedBy ?? undefined,
    approvalDate: updatedEco.approvalDate ?? undefined,
    priority: updatedEco.priority,
    impacts: updatedEco.impacts.map(imp => ({
      partNumber: imp.partNumber,
      name: imp.name,
      changeType: imp.changeType,
      from: imp.from ?? undefined,
      to: imp.to ?? undefined
    }))
  };
};

export const loadBackendWorkspaceSettings = async (): Promise<ApiWorkspaceSettings> => {
  const response = await apiFetch<{ settings: ApiWorkspaceSettings }>('/api/workspace/settings');
  return response.settings;
};

export const saveBackendWorkspaceSettings = async (settings: ApiWorkspaceSettings): Promise<ApiWorkspaceSettings> => {
  const response = await apiFetch<{ settings: ApiWorkspaceSettings }>('/api/workspace/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
  return response.settings;
};

export const loadBackendAIProviderConfig = async (): Promise<BackendAIProviderSettings & { keyLast4: string | null }> => {
  const response = await apiFetch<{ provider: BackendAIProviderSettings & { keyLast4: string | null } }>('/api/ai/provider');
  return response.provider;
};

export const createBackendProject = async (input: { code: string; name: string; sku: string }): Promise<ApiProject> => {
  const response = await apiFetch<{ project: ApiProject }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  return response.project;
};

export const updateBackendProject = async (projectId: string, updates: { name?: string; sku?: string; code?: string }): Promise<ApiProject> => {
  const response = await apiFetch<{ project: ApiProject }>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
  return response.project;
};

export const transitionBackendProjectPhase = async (projectId: string, newPhase: string, signatures: any[]): Promise<ApiProject> => {
  const response = await apiFetch<{ project: ApiProject }>(`/api/projects/${projectId}/transition`, {
    method: 'POST',
    body: JSON.stringify({ newPhase, signatures })
  });
  return response.project;
};

export const loadBackendAuditEvents = async (filters: {
  limit?: number;
  offset?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
  actorUserId?: string;
} = {}): Promise<{ events: ApiAuditEvent[]; total: number }> => {
  const params = new URLSearchParams();
  if (filters.limit !== undefined) params.append('limit', String(filters.limit));
  if (filters.offset !== undefined) params.append('offset', String(filters.offset));
  if (filters.entityType) params.append('entityType', filters.entityType);
  if (filters.entityId) params.append('entityId', filters.entityId);
  if (filters.action) params.append('action', filters.action);
  if (filters.actorUserId) params.append('actorUserId', filters.actorUserId);

  const queryString = params.toString();
  const url = `/api/audit${queryString ? `?${queryString}` : ''}`;
  return apiFetch<{ events: ApiAuditEvent[]; total: number }>(url);
};

export const previewBackendBOMImport = async (projectId: string, csvText: string): Promise<any> => {
  return apiFetch<any>(`/api/projects/${projectId}/bom/import-preview`, {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  });
};

export const commitBackendBOMImport = async (projectId: string, csvText: string): Promise<any> => {
  return apiFetch<any>(`/api/projects/${projectId}/bom/import-commit`, {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  });
};

export const uploadBackendAttachment = async (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${apiBaseUrl()}/api/attachments`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upload failed: ${response.statusText} - ${body}`);
  }

  const json = await response.json();
  return json.attachment;
};

export const linkBackendAttachment = async (
  entityType: 'part' | 'bom',
  entityId: string,
  attachmentId: string
): Promise<any> => {
  const pathSegment = entityType === 'bom' ? 'bom' : 'parts';
  return apiFetch<any>(`/api/attachments/${pathSegment}/${entityId}/link`, {
    method: 'POST',
    body: JSON.stringify({ attachmentId }),
  });
};

export const unlinkBackendAttachment = async (
  entityType: 'part' | 'bom',
  entityId: string,
  attachmentId: string
): Promise<any> => {
  const pathSegment = entityType === 'bom' ? 'bom' : 'parts';
  return apiFetch<any>(`/api/attachments/${pathSegment}/${entityId}/unlink`, {
    method: 'POST',
    body: JSON.stringify({ attachmentId }),
  });
};

export const deleteBackendAttachment = async (id: string): Promise<void> => {
  await apiFetch<void>(`/api/attachments/${id}`, {
    method: 'DELETE',
  });
};


