import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBOMStore } from '../stores/useBOMStore';
import { useToolingStore } from '../stores/useToolingStore';
import { useAuthStore } from '../stores/useAuthStore';
import { BOMNode, ComponentType, LifecycleState, LibraryPart, AttributeDefinition } from '../types';

const mockBOMData: BOMNode = {
  id: 'bom-root',
  partNumber: '100-ROOT-001',
  name: 'Root Assembly',
  revision: 'A',
  state: LifecycleState.Draft,
  type: ComponentType.Assembly,
  quantity: 1,
  unit: 'EA',
  cost: 10,
  currency: 'USD',
  children: [],
};

const mockPart: LibraryPart = {
  id: 'part-123',
  partNumber: '100-PART-999',
  description: 'Test Library Part',
  category: ComponentType.Part,
  state: LifecycleState.Draft,
  location: 'API',
  type: ComponentType.Part,
  cost: 1.5,
  stock: 10,
  minStock: 5,
};

describe('Zustand stores in API Mode', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    
    // Stub the backend API URL
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3101');

    // Setup active project state
    useBOMStore.setState({
      project: {
        id: 'proj-123',
        code: 'PRJ',
        name: 'Project PRJ',
        sku: 'SKU-PRJ',
        phase: 'EVT',
        lastModified: new Date().toISOString(),
        totalCost: 10,
        totalWeight: 5,
      },
      bomData: mockBOMData,
      libraryParts: [mockPart],
    });

    useToolingStore.setState({
      tooling: [
        {
          id: 'tool-456',
          projectId: 'proj-123',
          designMasterPartId: 'dm-123',
          name: 'Tool 1',
          milestones: [
            {
              id: 'ms-789',
              key: 'kickoff',
              status: 'not-started',
            },
          ],
        },
      ],
    });
  });

  const setupMockWorkspaceFetch = (fetchMock: any) => {
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url.includes('/api/auth/dev-login')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 'user-admin', role: 'ADMIN' }),
        };
      }
      if (url.includes('/api/projects/proj-123/bom')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            projectId: 'proj-123',
            roots: [
              {
                id: 'bom-root',
                partNumber: '100-ROOT-001',
                name: 'Root Assembly',
                revision: 'A',
                state: 'Draft',
                type: 'Assembly',
                quantity: 1,
                unit: 'EA',
                cost: 10,
                currency: 'USD',
                children: [],
              },
            ],
          }),
        };
      }
      if (url.includes('/api/projects')) {
        if (options?.method === 'POST') {
          if (url.includes('/transition')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                project: {
                  id: 'proj-123',
                  code: 'PRJ',
                  name: 'Project PRJ',
                  sku: 'SKU-PRJ',
                  phase: 'DVT',
                }
              }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({
              project: {
                id: 'proj-new',
                code: 'NEW',
                name: 'New Project',
                sku: 'SKU-NEW',
                phase: 'EVT',
              }
            }),
          };
        }
        if (options?.method === 'PATCH') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              project: {
                id: 'proj-123',
                code: 'PRJ',
                name: 'Updated Name',
                sku: 'Updated SKU',
                phase: 'EVT',
              }
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            projects: [
              {
                id: 'proj-123',
                code: 'PRJ',
                name: 'Project PRJ',
                sku: 'SKU-PRJ',
                phase: 'EVT',
              },
            ],
          }),
        };
      }
      if (url.includes('/api/parts')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            parts: [
              {
                id: 'part-123',
                partNumber: '100-PART-999',
                name: 'Test Library Part',
                type: 'Part',
                lifecycleState: 'Draft',
                cost: 1.5,
              },
            ],
          }),
        };
      }
      if (url.includes('/api/tooling')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            designMasters: [],
            toolingRecords: [
              {
                id: 'tool-456',
                projectId: 'proj-123',
                designMasterId: 'dm-123',
                name: 'Tool 1',
                milestones: [
                  {
                    id: 'ms-789',
                    key: 'kickoff',
                    status: 'in-progress',
                  },
                ],
              },
            ],
          }),
        };
      }
      if (url.includes('/api/audit')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            events: [
              {
                id: 'audit-1',
                actorUserId: 'user-1',
                actorName: 'Test Actor',
                entityType: 'project',
                entityId: 'proj-123',
                action: 'create',
                createdAt: '2026-06-08T12:00:00.000Z',
              }
            ],
            total: 1,
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      };
    });
  };

  it('calls PATCH /api/projects/:projectId/bom/:nodeId on updateBOMNode', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    await useBOMStore.getState().updateBOMNode('bom-root', { quantity: 5 });

    const patchCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/projects/proj-123/bom/bom-root') && call[1]?.method === 'PATCH'
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body)).toEqual({ quantity: 5 });

    const bomGetCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/projects/proj-123/bom') && call[1]?.method === undefined
    );
    expect(bomGetCall).toBeDefined();
  });

  it('calls POST /api/projects/:projectId/bom on addBOMNode', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const newNode: BOMNode = {
      id: 'bom-child',
      partNumber: '100-PART-999',
      name: 'New Child Part',
      revision: 'A',
      state: LifecycleState.Draft,
      type: ComponentType.Part,
      quantity: 2,
      unit: 'EA',
      cost: 1.5,
      currency: 'USD',
    };

    await useBOMStore.getState().addBOMNode('bom-root', newNode);

    const postCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/projects/proj-123/bom') && call[1]?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall[1].body)).toMatchObject({
      parentId: 'bom-root',
      partNumber: '100-PART-999',
      quantity: 2,
    });
  });

  it('calls DELETE /api/projects/:projectId/bom/:nodeId on deleteBOMNode', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    await useBOMStore.getState().deleteBOMNode('bom-root');

    const deleteCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/projects/proj-123/bom/bom-root') && call[1]?.method === 'DELETE'
    );
    expect(deleteCall).toBeDefined();
  });

  it('calls PATCH /api/parts/:partId on updateLibraryPart', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    await useBOMStore.getState().updateLibraryPart('part-123', { cost: 2.5 });

    const patchCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/parts/part-123') && call[1]?.method === 'PATCH'
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body)).toMatchObject({
      cost: 2.5,
    });
  });

  it('calls POST /api/parts on addLibraryPart', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const partToAdd: LibraryPart = {
      id: 'part-new',
      partNumber: '100-NEW-111',
      description: 'Brand New Part',
      category: ComponentType.Part,
      state: LifecycleState.Draft,
      location: 'API',
      type: ComponentType.Part,
      cost: 4.0,
      stock: 0,
      minStock: 0,
    };

    await useBOMStore.getState().addLibraryPart(partToAdd);

    const postCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/parts') && call[1]?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall[1].body)).toMatchObject({
      partNumber: '100-NEW-111',
      cost: 4.0,
    });
  });

  it('calls PATCH /api/tooling/milestones/:milestoneId on updateMilestone', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    await useToolingStore.getState().updateMilestone('tool-456', 'kickoff', { status: 'in-progress' });

    const patchCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/tooling/milestones/ms-789') && call[1]?.method === 'PATCH'
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body)).toEqual({ status: 'in-progress' });
  });

  it('calls PUT /api/workspace/settings on addAttributeDef', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    useBOMStore.setState({ attributeDefs: [] });

    const newDef: AttributeDefinition = {
      id: 'attr-1',
      name: 'Material',
      key: 'material',
      type: 'text',
    };

    await useBOMStore.getState().addAttributeDef(newDef);

    expect(useBOMStore.getState().attributeDefs).toContainEqual(newDef);

    const putCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/workspace/settings') && call[1]?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const payload = JSON.parse(putCall[1].body);
    expect(payload.attributeDefs).toContainEqual(newDef);
  });

  it('calls PUT /api/workspace/settings on deleteAttributeDef', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const targetDef: AttributeDefinition = {
      id: 'attr-1',
      name: 'Material',
      key: 'material',
      type: 'text',
    };
    useBOMStore.setState({ attributeDefs: [targetDef] });

    await useBOMStore.getState().deleteAttributeDef('attr-1');

    expect(useBOMStore.getState().attributeDefs).not.toContainEqual(targetDef);

    const putCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/workspace/settings') && call[1]?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const payload = JSON.parse(putCall[1].body);
    expect(payload.attributeDefs).not.toContainEqual(targetDef);
  });

  it('calls PUT /api/workspace/settings on updateAttributeDef', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const targetDef: AttributeDefinition = {
      id: 'attr-1',
      name: 'Material',
      key: 'material',
      type: 'text',
    };
    useBOMStore.setState({ attributeDefs: [targetDef] });

    await useBOMStore.getState().updateAttributeDef('attr-1', { name: 'Raw Material' });

    const updated = useBOMStore.getState().attributeDefs.find(a => a.id === 'attr-1');
    expect(updated?.name).toBe('Raw Material');

    const putCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/workspace/settings') && call[1]?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const payload = JSON.parse(putCall[1].body);
    expect(payload.attributeDefs.find((a: any) => a.id === 'attr-1')?.name).toBe('Raw Material');
  });

  it('calls PUT /api/workspace/settings on addWarehouseLocation', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    useBOMStore.setState({ warehouseLocations: [] });

    await useBOMStore.getState().addWarehouseLocation('Warehouse A');

    expect(useBOMStore.getState().warehouseLocations).toContain('Warehouse A');

    const putCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/workspace/settings') && call[1]?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const payload = JSON.parse(putCall[1].body);
    expect(payload.warehouseLocations).toContain('Warehouse A');
  });

  it('calls PUT /api/workspace/settings on deleteWarehouseLocation', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    useBOMStore.setState({ warehouseLocations: ['Warehouse A', 'Warehouse B'] });

    await useBOMStore.getState().deleteWarehouseLocation('Warehouse A');

    expect(useBOMStore.getState().warehouseLocations).not.toContain('Warehouse A');

    const putCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/workspace/settings') && call[1]?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const payload = JSON.parse(putCall[1].body);
    expect(payload.warehouseLocations).not.toContain('Warehouse A');
  });

  it('calls PUT /api/workspace/settings on updateWarehouseLocation', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    useBOMStore.setState({ warehouseLocations: ['Warehouse A'] });

    await useBOMStore.getState().updateWarehouseLocation('Warehouse A', 'Warehouse C');

    expect(useBOMStore.getState().warehouseLocations).toContain('Warehouse C');
    expect(useBOMStore.getState().warehouseLocations).not.toContain('Warehouse A');

    const putCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/workspace/settings') && call[1]?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const payload = JSON.parse(putCall[1].body);
    expect(payload.warehouseLocations).toContain('Warehouse C');
  });

  it('calls PUT /api/workspace/settings on updateComponentTypeLabel', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    useBOMStore.setState({ componentTypeLabels: { [ComponentType.Part]: 'Old Label' } as Record<ComponentType, string> });

    await useBOMStore.getState().updateComponentTypeLabel(ComponentType.Part, 'New Part Label');

    expect(useBOMStore.getState().componentTypeLabels[ComponentType.Part]).toBe('New Part Label');

    const putCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/workspace/settings') && call[1]?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const payload = JSON.parse(putCall[1].body);
    expect(payload.componentTypeLabels[ComponentType.Part]).toBe('New Part Label');
  });

  it('calls PUT /api/workspace/settings on updateLifecycleStateLabel', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    useBOMStore.setState({ lifecycleStateLabels: { [LifecycleState.Draft]: 'Old Draft' } as Record<LifecycleState, string> });

    await useBOMStore.getState().updateLifecycleStateLabel(LifecycleState.Draft, 'New Draft Label');

    expect(useBOMStore.getState().lifecycleStateLabels[LifecycleState.Draft]).toBe('New Draft Label');

    const putCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/workspace/settings') && call[1]?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const payload = JSON.parse(putCall[1].body);
    expect(payload.lifecycleStateLabels[LifecycleState.Draft]).toBe('New Draft Label');
  });

  it('calls POST /api/projects on createProject', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    await useBOMStore.getState().createProject({
      code: 'NEW',
      name: 'New Project',
      sku: 'SKU-NEW',
      flowId: 'flow-standard'
    });

    const postCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/projects') && call[1]?.method === 'POST' && !call[0].includes('/transition')
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall[1].body)).toEqual({
      code: 'NEW',
      name: 'New Project',
      sku: 'SKU-NEW'
    });
  });

  it('calls PATCH /api/projects/:projectId on updateProject', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    await useBOMStore.getState().updateProject('proj-123', {
      name: 'Updated Name',
      sku: 'Updated SKU'
    });

    const patchCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/projects/proj-123') && call[1]?.method === 'PATCH'
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body)).toEqual({
      name: 'Updated Name',
      sku: 'Updated SKU'
    });
  });

  it('calls POST /api/projects/:projectId/transition on updateProjectPhase', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const signatures = [
      { item: 'BOM Cost Review Completed', actorName: 'Test Engineer', userRole: 'ENG_LEAD', timestamp: '2026-06-08' }
    ];

    await useBOMStore.getState().updateProjectPhase('proj-123', 'DVT', signatures);

    const transitionCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/projects/proj-123/transition') && call[1]?.method === 'POST'
    );
    expect(transitionCall).toBeDefined();
    expect(JSON.parse(transitionCall[1].body)).toEqual({
      newPhase: 'DVT',
      signatures
    });
  });

  it('calls GET /api/audit on loadAuditTrail', async () => {
    const fetchMock = vi.fn();
    setupMockWorkspaceFetch(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    await useBOMStore.getState().loadAuditTrail({ entityType: 'project', limit: 20 });

    const getCall = fetchMock.mock.calls.find((call) =>
      call[0].includes('/api/audit') && call[0].includes('entityType=project') && call[0].includes('limit=20')
    );
    expect(getCall).toBeDefined();
    expect(useBOMStore.getState().auditEvents).toHaveLength(1);
    expect(useBOMStore.getState().totalAuditEvents).toBe(1);
  });
});
