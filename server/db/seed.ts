import { PrismaClient } from '@prisma/client';
import { complexBOM } from '../../data/mockBOM';
import { mockLibraryData } from '../../data/mockLibrary';
import { mockDesignMasterParts, mockTooling } from '../../data/mockTooling';
import { BOMNode, ComponentType, LifecycleState } from '../../types';

const prisma = new PrismaClient();

const WORKSPACE_ID = 'workspace-zbom-demo';
const PROJECT_ID = 'project-zphone-2026';

const defaultSettings = {
  flows: [
    {
      id: 'flow-standard',
      name: 'Standard Hardware Flow',
      stages: ['EVT', 'DVT', 'PVT', 'MP'],
      transitions: {
        EVT: { targetStages: ['DVT'], checklist: ['BOM Cost Review Completed', 'DFM Review Completed', 'Initial EVT Yield Report Attached'] },
        DVT: { targetStages: ['PVT'], checklist: ['Functional Testing Completed', 'Compliance Certificates Obtained', 'Tooling T1 Trials Completed'] },
        PVT: { targetStages: ['MP'], checklist: ['PVT Qualification Complete', 'Operator Training Complete', 'Final Golden Sample Approved'] },
        MP: { targetStages: [], checklist: [] }
      }
    },
    {
      id: 'flow-fast',
      name: 'Fast-Track IoT Flow',
      stages: ['EVT', 'PVT', 'MP'],
      transitions: {
        EVT: { targetStages: ['PVT'], checklist: ['BOM Cost Review Completed', 'Functional Testing Completed', 'DFM Review Completed'] },
        PVT: { targetStages: ['MP'], checklist: ['Operator Training Complete', 'Final Golden Sample Approved'] },
        MP: { targetStages: [], checklist: [] }
      }
    }
  ],
  flowAssociations: {
    'project-zphone-2026': 'flow-standard',
    'project-zphone-lite-2026': 'flow-fast'
  },
  componentTypes: ['Assembly', 'Part', 'Material', 'Software'],
  lifecycleStates: ['Draft', 'In Review', 'Released', 'Obsolete', 'Prototype'],
  warehouseLocations: ['WH-A', 'WH-B', 'WH-C'],
  complianceStandards: ['RoHS', 'REACH', 'UN38.3'],
  attributeDefs: [
    { id: 'attr-1', name: 'Material', key: 'material', type: 'text' },
    { id: 'attr-2', name: 'Finish', key: 'finish', type: 'text' },
    { id: 'attr-3', name: 'Torque Spec', key: 'torque', type: 'text' },
    { id: 'attr-4', name: 'Compliance', key: 'compliance', type: 'select', options: ['RoHS', 'REACH', 'UN38.3'] }
  ],
  componentTypeLabels: {
    Assembly: 'Assembly',
    Part: 'Part',
    Material: 'Material',
    Software: 'Software'
  },
  lifecycleStateLabels: {
    Draft: 'Draft',
    'In Review': 'In Review',
    Released: 'Released',
    Obsolete: 'Obsolete',
    Prototype: 'Prototype'
  }
};


const roleUsers = [
  { id: 'user-admin', email: 'admin@zbom.local', name: 'Admin User', role: 'ADMIN' },
  { id: 'user-engineer', email: 'engineer@zbom.local', name: 'Engineering Lead', role: 'ENG_LEAD' },
  { id: 'user-sourcing', email: 'sourcing@zbom.local', name: 'Sourcing Manager', role: 'SOURCING' },
  { id: 'user-viewer', email: 'viewer@zbom.local', name: 'Read Only Viewer', role: 'VIEWER' },
] as const;

const lifecycleStateToDb = (state: LifecycleState) => {
  if (state === LifecycleState.InReview) return 'InReview';
  return state;
};

const componentTypeToDb = (type: ComponentType) => type;

const dateFromIsoDay = (value?: string) => (value ? new Date(`${value}T00:00:00.000Z`) : undefined);

const flattenBom = (node: BOMNode, parentId?: string): Array<{ node: BOMNode; parentId?: string }> => {
  return [
    { node, parentId },
    ...(node.children ?? []).flatMap((child) => flattenBom(child, node.id)),
  ];
};

const libraryPartByNumber = new Map(mockLibraryData.map((part) => [part.partNumber, part]));

const ensureToolingConcreteParts = () => {
  for (const designMaster of mockDesignMasterParts) {
    for (const partNumber of designMaster.concretePartNumbers) {
      if (!libraryPartByNumber.has(partNumber)) {
        libraryPartByNumber.set(partNumber, {
          id: `part-${partNumber.toLowerCase()}`,
          partNumber,
          mpn: partNumber,
          manufacturer: 'Internal',
          description: `${designMaster.name} concrete part`,
          type: ComponentType.Part,
          state: LifecycleState.Draft,
          category: 'Mechanical',
          cost: 0,
          stock: 0,
          minStock: 0,
          location: 'TBD',
        });
      }
    }
  }
};

const resetDatabase = async () => {
  await prisma.aiRequestLog.deleteMany();
  await prisma.aiProviderConfig.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.toolingMilestone.deleteMany();
  await prisma.toolingRecord.deleteMany();
  await prisma.toolingConcretePartMapping.deleteMany();
  await prisma.toolingDesignMaster.deleteMany();
  await prisma.bOMNode.deleteMany();
  await prisma.part.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.eCOImpact.deleteMany();
  await prisma.eCO.deleteMany();
  await prisma.workspace.deleteMany();
};

const seedIdentity = async () => {
  await prisma.workspace.create({
    data: {
      id: WORKSPACE_ID,
      name: 'zBOM Demo Workspace',
      settingsJson: JSON.stringify(defaultSettings),
    },
  });

  for (const user of roleUsers) {
    await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        memberships: {
          create: {
            id: `membership-${user.role.toLowerCase()}`,
            workspaceId: WORKSPACE_ID,
            role: user.role,
          },
        },
      },
    });
  }
};

const seedProject = async () => {
  await prisma.project.create({
    data: {
      id: PROJECT_ID,
      workspaceId: WORKSPACE_ID,
      code: 'ZPM-14',
      name: 'zPhone Pro Max',
      sku: 'Multi-SKU Config',
      phase: 'DVT',
    },
  });
};

const seedParts = async () => {
  ensureToolingConcreteParts();

  for (const part of libraryPartByNumber.values()) {
    await prisma.part.create({
      data: {
        id: `part-${part.partNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        workspaceId: WORKSPACE_ID,
        partNumber: part.partNumber,
        name: part.description,
        description: part.description,
        type: componentTypeToDb(part.type),
        lifecycleState: lifecycleStateToDb(part.state),
        manufacturer: part.manufacturer,
        mpn: part.mpn,
        cost: part.cost,
        currency: 'USD',
        leadTimeWeeks: part.leadTimeWeeks,
        moq: part.moq,
        spq: part.spq,
      },
    });
  }
};

const seedBom = async () => {
  const parts = await prisma.part.findMany({
    where: { workspaceId: WORKSPACE_ID },
  });
  const partIdByNumber = new Map(parts.map((part) => [part.partNumber, part.id]));

  for (const { node, parentId } of flattenBom(complexBOM)) {
    await prisma.bOMNode.create({
      data: {
        id: `bom-${node.id}`,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        parentId: parentId ? `bom-${parentId}` : undefined,
        partId: partIdByNumber.get(node.partNumber),
        partNumber: node.partNumber,
        name: node.name,
        revision: node.revision,
        state: lifecycleStateToDb(node.state),
        type: componentTypeToDb(node.type),
        quantity: node.quantity,
        unit: node.unit,
        cost: node.cost,
        currency: node.currency,
        customAttributesJson: node.customAttributes ? JSON.stringify(node.customAttributes) : undefined,
      },
    });
  }
};

const seedTooling = async () => {
  const parts = await prisma.part.findMany({
    where: { workspaceId: WORKSPACE_ID },
  });
  const partIdByNumber = new Map(parts.map((part) => [part.partNumber, part.id]));

  for (const designMaster of mockDesignMasterParts) {
    await prisma.toolingDesignMaster.create({
      data: {
        id: designMaster.id,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        code: designMaster.code,
        name: designMaster.name,
      },
    });

    for (const partNumber of designMaster.concretePartNumbers) {
      const partId = partIdByNumber.get(partNumber);
      if (!partId) continue;

      await prisma.toolingConcretePartMapping.create({
        data: {
          id: `mapping-${designMaster.id}-${partNumber.toLowerCase()}`,
          workspaceId: WORKSPACE_ID,
          designMasterId: designMaster.id,
          partId,
        },
      });
    }
  }

  const statusMap = {
    'not-started': 'NOT_STARTED',
    'in-progress': 'IN_PROGRESS',
    done: 'DONE',
    blocked: 'BLOCKED',
  } as const;

  for (const tooling of mockTooling) {
    await prisma.toolingRecord.create({
      data: {
        id: tooling.id,
        workspaceId: WORKSPACE_ID,
        projectId: PROJECT_ID,
        designMasterId: tooling.designMasterPartId,
        toolingNumber: tooling.toolingNumber,
        name: tooling.name,
        type: tooling.type,
        status: tooling.status,
        supplier: tooling.supplier,
        owner: tooling.owner,
        cavityCount: tooling.cavityCount,
        leadTimeDays: tooling.leadTimeDays,
        milestones: {
          create: tooling.milestones.map((milestone) => ({
            id: `${tooling.id}-${milestone.key}`,
            workspaceId: WORKSPACE_ID,
            key: milestone.key,
            status: statusMap[milestone.status],
            plannedDate: dateFromIsoDay(milestone.plannedDate),
            actualDate: dateFromIsoDay(milestone.actualDate),
            owner: milestone.owner,
            notes: milestone.notes,
            blockerReason: milestone.blockerReason,
          })),
        },
      },
    });
  }
};

const seedAiProvider = async () => {
  await prisma.aiProviderConfig.create({
    data: {
      id: 'ai-provider-default',
      workspaceId: WORKSPACE_ID,
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      temperature: 0.3,
      enabled: false,
    },
  });
};

const main = async () => {
  await resetDatabase();
  await seedIdentity();
  await seedProject();
  await seedParts();
  await seedBom();
  await seedTooling();
  await seedAiProvider();
  await seedECOs();
};

const seedECOs = async () => {
  await prisma.eCO.create({
    data: {
      id: 'eco-001',
      workspaceId: WORKSPACE_ID,
      ecoNumber: 'ECO-2024-112',
      title: 'Replace M1.2 screws with M1.4',
      description: 'Field failure reports indicate M1.2 screws stripping during assembly torque. Upgrading to M1.4 for durability.',
      status: 'Approved',
      initiator: 'Alex Chen',
      createdDate: new Date('2024-10-12T00:00:00Z'),
      approvedBy: 'Sarah Engineer',
      approvalDate: new Date('2024-10-14T00:00:00Z'),
      priority: 'High',
      impacts: {
        create: [
          { id: 'impact-001-1', partNumber: '500-22101-A', name: 'Screw, M1.2x3, Torx', changeType: 'Obsolete' },
          { id: 'impact-001-2', partNumber: '500-22105-A', name: 'Screw, M1.4x3, Torx', changeType: 'New' }
        ]
      }
    }
  });

  await prisma.eCO.create({
    data: {
      id: 'eco-002',
      workspaceId: WORKSPACE_ID,
      ecoNumber: 'ECO-2024-115',
      title: 'Update FW Bootloader',
      description: 'Security patch for bootloader. Required for PVT builds.',
      status: 'Pending Approval',
      initiator: 'Mike Smith',
      createdDate: new Date('2024-10-14T00:00:00Z'),
      priority: 'Medium',
      impacts: {
        create: [
          { id: 'impact-002-1', partNumber: 'SW-10001', name: 'Firmware, Bootloader', changeType: 'RevUp', from: 'v1.2', to: 'v1.3' }
        ]
      }
    }
  });
};

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
