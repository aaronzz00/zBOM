import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL ?? `file://${process.cwd()}/server/db/dev.db`,
    },
  },
});

const WORKSPACE_ID = 'workspace-zbom-demo';
const scratchDir = '/Users/zz-orka/.gemini/antigravity/brain/a7f5702c-5360-4f18-ae16-d7c76a1fc816/scratch';

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
    'project-whisper-audio': 'flow-standard',
    'project-whisper-hearing': 'flow-standard'
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

interface RawBOMItem {
  id: string;
  level: number;
  subAssembly: string | null;
  type: string;
  category: string;
  name: string;
  description: string;
  qty: number;
  unit: string;
  process: string | null;
  cavity: string | null;
  skinContact: string | null;
  isShared: boolean;
  remark: string | null;
}

function parseRow(row: any[]): RawBOMItem | null {
  if (!row) return null;
  const partId = row[1];
  const level = parseInt(row[2], 10);
  if (isNaN(level) || !partId) return null;

  const subAssembly = row[3] || null;
  const type = row[4] || 'Part';
  const category = row[5] || 'Unassigned';
  const name = (row[6] || '').trim();
  const description = (row[7] || '').trim();

  const qty = parseFloat(row[15]) || 1;
  const unit = (row[16] || 'pcs').trim();
  const process = row[17] || null;
  const cavity = row[18] || null;
  const skinContact = row[19] || null;
  const isShared = (row[20] || '').toString().toLowerCase().includes('y') || (row[7] || '').includes('左右共用');
  const remark = row[21] || null;

  return {
    id: partId.toString(),
    level,
    subAssembly,
    type,
    category,
    name,
    description,
    qty,
    unit,
    process,
    cavity,
    skinContact,
    isShared,
    remark
  };
}

function loadBOMItems(filename: string): RawBOMItem[] {
  const filepath = path.join(scratchDir, filename);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  const rows = data.data.valueRange.values;
  const items: RawBOMItem[] = [];

  for (let i = 7; i < rows.length; i++) {
    const item = parseRow(rows[i]);
    if (item) {
      items.push(item);
    }
  }
  return items;
}

// Pre-pass set of common physical parts
const commonIds = new Set<string>();
const forcedSideSpecificItemIds = new Set(['7', '8']);

function getBaseItemId(itemId: string): string {
  return itemId.split('-')[0];
}

function initializeCommonIds(leftItems: RawBOMItem[], rightItems: RawBOMItem[]) {
  for (const item of [...leftItems, ...rightItems]) {
    const name = item.name || '';
    const desc = item.description || '';
    const remark = item.remark || '';

    // Physical common parts: screws, pogo-pins, membrane/films, magnets, mesh
    const isScrew = name.includes('螺丝') || name.toLowerCase().includes('screw');
    const isPogo = name.includes('PIN') || name.includes('pin') || name.includes('pogo') || name.includes('Contact');
    const isMembrane = name.includes('膜') || name.toLowerCase().includes('membrane') || name.toLowerCase().includes('mesh');
    const isMagnet = name.includes('磁铁') || name.toLowerCase().includes('magnet');
    const isMesh = name.includes('网') || name.toLowerCase().includes('mesh');

    // Stamping parts: physically identical on both sides
    const isStamping = item.process === '冲压' || (desc.includes('冲压') || remark.includes('冲压'));

    const hasCommonKeyword = name.includes('左右共用') || desc.includes('左右共用') || remark.includes('左右共用') ||
                              name.includes('共用') || desc.includes('共用') || remark.includes('共用') ||
                              name.includes('共模') || desc.includes('共模') || remark.includes('共模');

    if (((isScrew || isPogo || isMembrane || isMagnet || isMesh) && hasCommonKeyword) || isStamping) {
      commonIds.add(item.id);
    }
  }
}

function isItemCommon(itemId: string): boolean {
  if (forcedSideSpecificItemIds.has(getBaseItemId(itemId))) {
    return false;
  }

  for (const cid of commonIds) {
    if (itemId === cid || itemId.startsWith(cid + '-')) {
      return true;
    }
  }
  return false;
}

// Generate unique Part Number
function getPartNumber(item: RawBOMItem, isLeft: boolean): string {
  const cleanId = item.id.replace(/[^\w-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const side = isLeft ? 'L' : 'R';
  if (item.id === '1' && item.category === 'PCBA') {
    return `800-WHISPER-${side}-PCBA-MAIN`;
  }
  if (item.id === '2' && item.category === 'FPC') {
    return `800-WHISPER-${side}-FPC-MIC-BTN`;
  }
  if (item.id === '3' && item.category === '喇叭组件') {
    return `800-WHISPER-${side}-SPK-MODULE`;
  }
  if (item.id === '4' && item.category === '电池') {
    return '800-WHISPER-CMN-BATT-MODULE';
  }
  if (item.level === 2 && item.category === '组件' && /6[（(]2[）)]/.test(item.id)) {
    return `800-WHISPER-${side}-BTN-ASSY-SUS`;
  }
  if (item.level === 2 && item.category === '组件' && /6[（(]3[）)]/.test(item.id)) {
    return `800-WHISPER-${side}-BTN-ASSY-OPT3`;
  }

  if (isItemCommon(item.id)) {
    return `800-WHISPER-CMN-${cleanId}`;
  }
  return `800-WHISPER-${side}-${cleanId}`;
}

async function clearDatabase() {
  console.log('Clearing database tables...');
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
  console.log('Database cleared.');
}

async function main() {
  const leftItems = loadBOMItems('left_temple.json');
  const rightItems = loadBOMItems('right_temple.json');

  console.log(`Loaded ${leftItems.length} left temple items and ${rightItems.length} right temple items.`);

  // Initialize common physical parts detection
  initializeCommonIds(leftItems, rightItems);
  console.log(`Identified ${commonIds.size} physically common part IDs.`);

  await clearDatabase();

  // Seed Workspace and Users
  console.log('Seeding workspace, users, and memberships...');
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

  // Create Projects
  console.log('Creating Whisper projects...');
  const audioProject = await prisma.project.create({
    data: {
      id: 'project-whisper-audio',
      workspaceId: WORKSPACE_ID,
      code: 'WHISPER-AUDIO',
      name: 'Whisper Audio Frame',
      sku: 'Audio Frame Config',
      phase: 'EVT',
    },
  });

  const hearingProject = await prisma.project.create({
    data: {
      id: 'project-whisper-hearing',
      workspaceId: WORKSPACE_ID,
      code: 'WHISPER-HEARING',
      name: 'Whisper Hearing Frame',
      sku: 'Hearing Frame Config',
      phase: 'EVT',
    },
  });

  // Collect all parts to insert into Part Library
  const partMap = new Map<string, {
    partNumber: string;
    name: string;
    description: string;
    type: string;
    lifecycleState: string;
    process: string | null;
  }>();

  // Helper to add parts
  const addPart = (pn: string, name: string, desc: string, type: string, process: string | null = null) => {
    partMap.set(pn, {
      partNumber: pn,
      name,
      description: desc,
      type,
      lifecycleState: 'Draft',
      process,
    });
  };

  // Add top level parts
  addPart('800-WHISPER-AUDIO-TLA', 'Whisper Audio Frame Top Level Assembly', 'Whisper Audio Frame Top Level Assembly FATP BOM', 'Assembly');
  addPart('800-WHISPER-HEARING-TLA', 'Whisper Hearing Frame Top Level Assembly', 'Whisper Hearing Frame Top Level Assembly FATP BOM', 'Assembly');
  addPart('800-WHISPER-FRM', '前框组件 Frame Assy', 'OK02 Frame Assembly', 'Assembly');
  addPart('800-WHISPER-TMP-L-OUTER', '左外镜腿 Left Temple Assy', 'Left Outer Temple Sleeve Assembly', 'Assembly');
  addPart('800-WHISPER-TMP-R-OUTER', '右外镜腿 Right Temple Assy', 'Right Outer Temple Sleeve Assembly', 'Assembly');
  addPart('800-WHISPER-TMP-COVER-L', '左镜腿盖板 OK02 TEMPLE COVER-L', 'Left Temple Cover', 'Part', '注塑');
  addPart('800-WHISPER-TMP-COVER-R', '右镜腿盖板 OK02 TEMPLE COVER-R', 'Right Temple Cover', 'Part', '注塑');
  addPart('800-WHISPER-CBL', '充电线 Charge Cable', 'Magnetic Pogo Pin Charge Cable', 'Part');
  addPart('800-WHISPER-TRAY', '包装托盘 Packaging Tray', 'Plastic Tray for Smart Glasses Packaging', 'Part');
  addPart('SW-WHISPER-AUDIO', 'Audio Software / Firmware', 'Audio Frame Smart Glasses Firmware', 'Software');
  addPart('SW-WHISPER-HEARING', 'Hearing Software / Firmware', 'Hearing Assist Frame Smart Glasses Firmware', 'Software');

  // Add left temple parts
  for (const item of leftItems) {
    const pn = getPartNumber(item, true);
    const type = item.level === 1 || item.category === '组装\nModule' || item.category === '组件' ? 'Assembly' : 'Part';
    addPart(pn, item.name, item.description, type, item.process);
  }

  // Add right temple parts
  for (const item of rightItems) {
    const pn = getPartNumber(item, false);
    const type = item.level === 1 || item.category === '组装\nModule' || item.category === '组件' ? 'Assembly' : 'Part';
    addPart(pn, item.name, item.description, type, item.process);
  }

  const canonicalWhisperParts = [
    ['800-WHISPER-L-2', '左镜腿支架 OK02 BRACKET-L', 'Left Temple Bracket', 'Part', '嵌件注塑'],
    ['800-WHISPER-R-2', '右镜腿支架 OK02 BRACKET-R', 'Right Temple Bracket', 'Part', '嵌件注塑'],
    ['800-WHISPER-L-3', '喇叭支架-左 OK02 SPK HOLDER-L', 'Left Speaker Holder', 'Part', '注塑'],
    ['800-WHISPER-R-3', '喇叭支架-右 OK02 SPK HOLDER-R', 'Right Speaker Holder', 'Part', '注塑'],
    ['800-WHISPER-L-4', '按键支架-左 OK02 BUTTON FRAME-L', 'Left Button Frame', 'Part', '注塑'],
    ['800-WHISPER-R-4', '按键支架-右 OK02 BUTTON FRAME-R', 'Right Button Frame', 'Part', '注塑'],
    ['800-WHISPER-CMN-5', '充电pin模组 OK02 CONTACT PIN MODULE', 'Contact Pin Module, L/R Shared', 'Part', '嵌件注塑'],
    ['800-WHISPER-R-6-1', 'MODE按键 MODE BUTTON_PLUNGER-PLASTIC', 'MODE Button Plunger Plastic', 'Part', '注塑'],
    ['800-WHISPER-L-6-1', '音量按键 VOLUME BUTTON_PLUNGER-PLASTIC', 'Volume Button Plunger Plastic', 'Part', '注塑'],
    ['800-WHISPER-R-6-2-1', 'MODE按键 MODE BUTTON_PLUNGER-SUS', 'MODE Button Plunger SUS', 'Part', '注塑+烧结'],
    ['800-WHISPER-L-6-2-1', '音量按键 VOLUME BUTTON_PLUNGER-SUS', 'Volume Button Plunger SUS', 'Part', '注塑+烧结'],
    ['800-WHISPER-L-7', '喇叭支架盖板-左 OK02 SPK HOLDER COVER-L', 'Left Speaker Holder Cover', 'Part', '冲压'],
    ['800-WHISPER-R-7', '喇叭支架盖板-右 OK02 SPK HOLDER COVER-R', 'Right Speaker Holder Cover', 'Part', '冲压'],
    ['800-WHISPER-L-8', '电池固定支架-左 OK02 BATTERY HOLDER-L', 'Left Battery Holder', 'Part', '冲压'],
    ['800-WHISPER-R-8', '电池固定支架-右 OK02 BATTERY HOLDER-R', 'Right Battery Holder', 'Part', '冲压'],
    ['800-WHISPER-CMN-9', '按键FPC支撑支架 OK02 button FPC frame', 'Button FPC Frame, L/R Shared', 'Part', '冲压'],
    ['800-WHISPER-CMN-14-2', '喇叭前出声孔金属网 SPK_front_port-metal', 'Speaker Front Port Metal Mesh, L/R Shared', 'Part', '冲压'],
    ['800-WHISPER-CMN-15-2', '喇叭前泄气孔金属网 SPK_front_vent-metal', 'Speaker Front Vent Metal Mesh, L/R Shared', 'Part', '冲压'],
    ['800-WHISPER-CMN-16-2', '喇叭后出声孔金属网 SPK_rear_port-metal', 'Speaker Rear Port Metal Mesh, L/R Shared', 'Part', '冲压'],
    ['800-WHISPER-L-PCBA-MAIN', '主板-左 main PCBA', 'Left Main PCBA', 'Part', null],
    ['800-WHISPER-R-PCBA-MAIN', '主板-右 main PCBA', 'Right Main PCBA', 'Part', null],
    ['800-WHISPER-L-FPC-MIC-BTN', 'MIC&按键 FPC-左', 'Left MIC and Button FPC', 'Part', null],
    ['800-WHISPER-R-FPC-MIC-BTN', 'MIC&按键 FPC-右', 'Right MIC and Button FPC', 'Part', null],
    ['800-WHISPER-L-SPK-MODULE', '喇叭模组-左 speaker module', 'Left Speaker Module', 'Part', null],
    ['800-WHISPER-R-SPK-MODULE', '喇叭模组-右 speaker module', 'Right Speaker Module', 'Part', null],
    ['800-WHISPER-CMN-BATT-MODULE', '电池模组 Battery Module', 'Battery module, L/R shared', 'Assembly', '组装'],
    ['800-WHISPER-CMN-BATT-CELL-7840', '7840 电池 Battery Cell', '7840 battery cell for battery module', 'Part', null],
    ['800-WHISPER-CMN-BATT-TAB-POS', '电池正极片 Battery Positive Tab', 'Battery positive pole tab', 'Part', '冲压'],
    ['800-WHISPER-CMN-BATT-TAB-NEG', '电池负极片 Battery Negative Tab', 'Battery negative pole tab', 'Part', '冲压'],
    ['800-WHISPER-L-BTN-ASSY-SUS', '音量键组件 OK02 VOLUME BUTTON ASSY-SUS', 'Left Volume Button Assembly, SUS Option', 'Assembly', '组装'],
    ['800-WHISPER-R-BTN-ASSY-SUS', 'MODE键组件 OK02 MODE BUTTON ASSY-SUS', 'Right MODE Button Assembly, SUS Option', 'Assembly', '组装'],
    ['800-WHISPER-L-BTN-ASSY-OPT3', '音量键组件 OK02 VOLUME BUTTON ASSY-AL', 'Left Volume Button Assembly, Option 3', 'Assembly', '组装'],
    ['800-WHISPER-R-BTN-ASSY-OPT3', 'MODE键组件 OK02 MODE BUTTON ASSY-SUS 方案三', 'Right MODE Button Assembly, Option 3', 'Assembly', '组装'],
  ] as const;

  for (const [pn, name, desc, type, process] of canonicalWhisperParts) {
    addPart(pn, name, desc, type, process);
  }

  // Save parts to Database
  console.log('Inserting parts into Part Library...');
  const dbPartsMap = new Map<string, string>(); // partNumber -> id
  for (const p of partMap.values()) {
    const dbPart = await prisma.part.create({
      data: {
        id: `part-${p.partNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        workspaceId: WORKSPACE_ID,
        partNumber: p.partNumber,
        name: p.name,
        description: p.description,
        type: p.type,
        lifecycleState: p.lifecycleState,
        cost: null, // Cost left blank
        currency: 'USD',
      },
    });
    dbPartsMap.set(p.partNumber, dbPart.id);
  }
  console.log(`Inserted ${partMap.size} parts.`);

  // Create Tooling Masters and Tooling Records
  console.log('Setting up Tooling...');
  
  interface ToolingConfig {
    code: string;
    name: string;
    parts: string[]; // part numbers mapped to this tooling master
    category: 'injection-mold' | 'mim-mold' | 'stamping-die' | 'press-mold';
    cavityCount: string;
    leadTimeDays?: number;
  }

  const toolingConfigs: ToolingConfig[] = [
    { code: 'TDM-BRACKET-L', name: 'Left Temple Bracket Mold', parts: ['800-WHISPER-L-2'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-BRACKET-R', name: 'Right Temple Bracket Mold', parts: ['800-WHISPER-R-2'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-SPK-HOLDER-L', name: 'Left Speaker Holder Mold', parts: ['800-WHISPER-L-3'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-SPK-HOLDER-R', name: 'Right Speaker Holder Mold', parts: ['800-WHISPER-R-3'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-BUTTON-FRAME-L', name: 'Left Button Frame Mold', parts: ['800-WHISPER-L-4'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-BUTTON-FRAME-R', name: 'Right Button Frame Mold', parts: ['800-WHISPER-R-4'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-PIN-MODULE', name: 'Contact Pin Module Mold (L/R Shared)', parts: ['800-WHISPER-CMN-5'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-MODE-BUTTON-PLASTIC', name: 'MODE Button Plunger Plastic Mold', parts: ['800-WHISPER-R-6-1'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-VOLUME-BUTTON-PLASTIC', name: 'Volume Button Plunger Plastic Mold', parts: ['800-WHISPER-L-6-1'], category: 'injection-mold', cavityCount: '4' },
    { code: 'TDM-CHARGE-CABLE', name: 'Charge Cable Injection Mold', parts: ['800-WHISPER-CBL'], category: 'injection-mold', cavityCount: 'TBD' },
    { code: 'TDM-MODE-BUTTON-SUS', name: 'MODE Button Plunger SUS MIM Mold', parts: ['800-WHISPER-R-6-2-1'], category: 'mim-mold', cavityCount: '4' },
    { code: 'TDM-VOLUME-BUTTON-SUS', name: 'Volume Button Plunger SUS MIM Mold', parts: ['800-WHISPER-L-6-2-1'], category: 'mim-mold', cavityCount: '4' },
    { code: 'TDM-SPK-COVER-L', name: 'Left Speaker Holder Cover Die', parts: ['800-WHISPER-L-7'], category: 'stamping-die', cavityCount: '1' },
    { code: 'TDM-SPK-COVER-R', name: 'Right Speaker Holder Cover Die', parts: ['800-WHISPER-R-7'], category: 'stamping-die', cavityCount: '1' },
    { code: 'TDM-BATT-HOLDER-L', name: 'Left Battery Holder Progressive Die', parts: ['800-WHISPER-L-8'], category: 'press-mold', cavityCount: 'progressive' },
    { code: 'TDM-BATT-HOLDER-R', name: 'Right Battery Holder Progressive Die', parts: ['800-WHISPER-R-8'], category: 'press-mold', cavityCount: 'progressive' },
    { code: 'TDM-FPC-FRAME', name: 'Button FPC Frame Die (L/R Shared)', parts: ['800-WHISPER-CMN-9'], category: 'stamping-die', cavityCount: '1' },
    { code: 'TDM-BATT-TAB-POS', name: 'Battery Positive Tab Stamping Die', parts: ['800-WHISPER-CMN-BATT-TAB-POS'], category: 'stamping-die', cavityCount: '1' },
    { code: 'TDM-BATT-TAB-NEG', name: 'Battery Negative Tab Stamping Die', parts: ['800-WHISPER-CMN-BATT-TAB-NEG'], category: 'stamping-die', cavityCount: '1' },
    { code: 'TDM-SPK-FRONT-MESH', name: 'Speaker Front Mesh Die (L/R Shared)', parts: ['800-WHISPER-CMN-14-2'], category: 'stamping-die', cavityCount: '1' },
    { code: 'TDM-SPK-REAR-MESH', name: 'Speaker Rear Mesh Die (L/R Shared)', parts: ['800-WHISPER-CMN-16-2'], category: 'stamping-die', cavityCount: '1' },
    { code: 'TDM-SPK-FRONT-VENT', name: 'Speaker Front Vent Mesh Die (L/R Shared)', parts: ['800-WHISPER-CMN-15-2'], category: 'stamping-die', cavityCount: '1' },
  ];

  const targetProjectId = 'project-whisper-audio';
  const toolingNumberPrefix: Record<ToolingConfig['category'], string> = {
    'injection-mold': 'TL-INJ',
    'mim-mold': 'TL-MIM',
    'stamping-die': 'TL-STP',
    'press-mold': 'TL-PRS',
  };
  const toolingCategorySequences = new Map<ToolingConfig['category'], number>();

  for (const t of toolingConfigs) {
    const dmId = `dmp-${t.code.toLowerCase()}`;
    await prisma.toolingDesignMaster.create({
      data: {
        id: dmId,
        workspaceId: WORKSPACE_ID,
        projectId: targetProjectId,
        code: t.code,
        name: t.name,
      },
    });

    // Link concrete parts
    for (const pn of t.parts) {
      const partId = dbPartsMap.get(pn);
      if (partId) {
        await prisma.toolingConcretePartMapping.create({
          data: {
            id: `mapping-${t.code.toLowerCase()}-${pn.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            workspaceId: WORKSPACE_ID,
            designMasterId: dmId,
            partId,
          },
        });
      }
    }

    const toolId = `tooling-${t.code.toLowerCase()}`;
    const sequence = (toolingCategorySequences.get(t.category) ?? 0) + 1;
    toolingCategorySequences.set(t.category, sequence);
    
    await prisma.toolingRecord.create({
      data: {
        id: toolId,
        workspaceId: WORKSPACE_ID,
        projectId: targetProjectId,
        designMasterId: dmId,
        toolingNumber: `${toolingNumberPrefix[t.category]}-${sequence.toString().padStart(3, '0')}`,
        name: `${t.name} Tooling`,
        type: t.category,
        status: 'pending',
        supplier: 'TBD',
        owner: 'TBD',
        cavityCount: t.cavityCount,
        leadTimeDays: t.leadTimeDays ?? 28,
        milestones: {
          create: ['drawingRelease', 'dfm', 'quotation', 'kickoff', 't1'].map((key) => ({
            id: `${toolId}-${key}`,
            workspaceId: WORKSPACE_ID,
            key,
            status: 'NOT_STARTED',
          })),
        },
      },
    });
  }
  console.log('Tooling configurations created.');

  // Create the BOM nodes trees for both projects
  console.log('Building and inserting BOM trees...');

  async function createBOMTree(projectId: string, isAudio: boolean) {
    const rootPN = isAudio ? '800-WHISPER-AUDIO-TLA' : '800-WHISPER-HEARING-TLA';
    const rootName = isAudio ? 'Whisper Audio Frame Top Level Assembly' : 'Whisper Hearing Frame Top Level Assembly';
    const rootNodeId = `root-whisper-${isAudio ? 'audio' : 'hearing'}`;

    // Create the BOM Master Record
    await prisma.bOMNode.create({
      data: {
        id: rootNodeId,
        workspaceId: WORKSPACE_ID,
        projectId,
        partId: dbPartsMap.get(rootPN),
        partNumber: rootPN,
        name: rootName,
        revision: 'A',
        state: 'Draft',
        type: 'Assembly',
        quantity: 1,
        unit: 'PCS',
        cost: null,
      },
    });

    // Helper to insert a BOMNode
    const insertNode = async (
      nodeId: string,
      parentId: string,
      pn: string,
      name: string,
      qty: number,
      unit: string,
      type: string,
      customAttributesJson?: string
    ) => {
      await prisma.bOMNode.create({
        data: {
          id: nodeId,
          workspaceId: WORKSPACE_ID,
          projectId,
          parentId,
          partId: dbPartsMap.get(pn),
          partNumber: pn,
          name,
          revision: 'A',
          state: 'Draft',
          type,
          quantity: qty,
          unit,
          cost: null,
          customAttributesJson,
        },
      });
    };

    // Add top level components to this TLA root
    const frameNodeId = `${rootNodeId}-frame`;
    const leftTempleNodeId = `${rootNodeId}-left-core`;
    const rightTempleNodeId = `${rootNodeId}-right-core`;
    const leftSleeveNodeId = `${rootNodeId}-left-outer`;
    const rightSleeveNodeId = `${rootNodeId}-right-outer`;
    const cableNodeId = `${rootNodeId}-cable`;
    const trayNodeId = `${rootNodeId}-tray`;
    const swNodeId = `${rootNodeId}-sw`;

    await insertNode(frameNodeId, rootNodeId, '800-WHISPER-FRM', '前框组件 Frame Assy', 1, 'pcs', 'Assembly');
    await insertNode(leftTempleNodeId, rootNodeId, '800-WHISPER-L-1', '智能眼镜左镜腿组件 OK02-L', 1, 'pcs', 'Assembly');
    await insertNode(rightTempleNodeId, rootNodeId, '800-WHISPER-R-1', '智能眼镜右镜腿组件 OK02-R', 1, 'pcs', 'Assembly');
    await insertNode(leftSleeveNodeId, rootNodeId, '800-WHISPER-TMP-L-OUTER', '左外镜腿 Left Temple Assy', 1, 'pcs', 'Assembly');
    await insertNode(rightSleeveNodeId, rootNodeId, '800-WHISPER-TMP-R-OUTER', '右外镜腿 Right Temple Assy', 1, 'pcs', 'Assembly');
    await insertNode(`${leftSleeveNodeId}-cover`, leftSleeveNodeId, '800-WHISPER-TMP-COVER-L', '左镜腿盖板\nOK02 TEMPLE COVER-L', 1, 'pcs', 'Part', JSON.stringify({ process: '注塑', category: '塑胶件', source: 'manual-tooling-list-update' }));
    await insertNode(`${rightSleeveNodeId}-cover`, rightSleeveNodeId, '800-WHISPER-TMP-COVER-R', '右镜腿盖板\nOK02 TEMPLE COVER-R', 1, 'pcs', 'Part', JSON.stringify({ process: '注塑', category: '塑胶件', source: 'manual-tooling-list-update' }));
    await insertNode(cableNodeId, rootNodeId, '800-WHISPER-CBL', '充电线 Charge Cable', 1, 'pcs', 'Part');
    await insertNode(trayNodeId, rootNodeId, '800-WHISPER-TRAY', '包装托盘 Packaging Tray', 1, 'pcs', 'Part');
    
    // Add specific software part
    const swPN = isAudio ? 'SW-WHISPER-AUDIO' : 'SW-WHISPER-HEARING';
    const swName = isAudio ? 'Audio Software / Firmware' : 'Hearing Software / Firmware';
    await insertNode(swNodeId, rootNodeId, swPN, swName, 1, 'pcs', 'Software');

    // Helper function to build children of Left/Right Temple core modules
    async function buildTempleTree(templeItems: RawBOMItem[], parentNodeId: string, isLeft: boolean) {
      const stack: { level: number; nodeId: string }[] = [{ level: 1, nodeId: parentNodeId }];
      
      for (let i = 1; i < templeItems.length; i++) {
        const item = templeItems[i];
        const pn = getPartNumber(item, isLeft);
        const type = pn === '800-WHISPER-CMN-BATT-MODULE' || item.level === 1 || item.category === '组装\nModule' || item.category === '组件' ? 'Assembly' : 'Part';
        
        while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
          stack.pop();
        }
        
        if (stack.length === 0) {
          throw new Error(`Invalid level hierarchy at row ${i + 8} in ${isLeft ? 'left' : 'right'} temple.`);
        }
        
        const parent = stack[stack.length - 1];
        const nodeId = `${rootNodeId}-${isLeft ? 'l' : 'r'}-${item.id.replace(/[^\w-]/g, '-')}-${i}`;
        
        const customAttributes = {
          process: item.process,
          skinContact: item.skinContact,
          category: item.category,
          remark: item.remark
        };
        
        await insertNode(
          nodeId,
          parent.nodeId,
          pn,
          item.name,
          item.qty,
          item.unit,
          type,
          JSON.stringify(customAttributes)
        );

        if (pn === '800-WHISPER-CMN-BATT-MODULE') {
          await insertNode(`${nodeId}-cell-7840`, nodeId, '800-WHISPER-CMN-BATT-CELL-7840', '7840 电池\nBattery Cell', 2, 'pcs', 'Part');
          await insertNode(`${nodeId}-tab-pos`, nodeId, '800-WHISPER-CMN-BATT-TAB-POS', '电池正极片\nBattery Positive Tab', 1, 'pcs', 'Part', JSON.stringify({ process: '冲压', category: '五金件', tooling: 'stamping-die' }));
          await insertNode(`${nodeId}-tab-neg`, nodeId, '800-WHISPER-CMN-BATT-TAB-NEG', '电池负极片\nBattery Negative Tab', 1, 'pcs', 'Part', JSON.stringify({ process: '冲压', category: '五金件', tooling: 'stamping-die' }));
        }
        
        stack.push({ level: item.level, nodeId });
      }
    }

    // Build the sub-trees
    await buildTempleTree(leftItems, leftTempleNodeId, true);
    await buildTempleTree(rightItems, rightTempleNodeId, false);
  }

  await createBOMTree(audioProject.id, true);
  await createBOMTree(hearingProject.id, false);

  console.log('BOM trees populated successfully.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('Successfully completed Whisper BOM data import!');
  })
  .catch(async (e) => {
    console.error('Import failed with error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
