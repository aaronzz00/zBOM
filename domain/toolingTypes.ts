export interface DesignMasterPart {
    id: string;
    projectId: string;
    structureId: string;
    code: string;
    name: string;
    concretePartNumbers: string[];
}

export type ToolingMilestoneKey =
    | 'drawingRelease'
    | 'dfm'
    | 'quotation'
    | 'kickoff'
    | 't1';

export type ToolingCategory =
    | 'injection-mold'
    | 'stamping-die'
    | 'die-cast-mold'
    | 'mim-mold'
    | 'press-mold'
    | 'gauge'
    | 'fixture'
    | 'jig'
    | 'other';

export type ToolingStatus =
    | 'pending'
    | 'in-progress'
    | 't1-complete'
    | 'in-modify'
    | 'approved'
    | 'approved-next-build'
    | 'on-hold'
    | 'scrapped';

export const TOOLING_CATEGORY_PREFIX: Record<ToolingCategory, string> = {
    'injection-mold': 'TL-INJ',
    'stamping-die': 'TL-STP',
    'die-cast-mold': 'TL-DCM',
    'mim-mold': 'TL-MIM',
    'press-mold': 'TL-PRS',
    gauge: 'TL-GAU',
    fixture: 'TL-FIX',
    jig: 'TL-JIG',
    other: 'TL-OTH',
};

export const TOOLING_CATEGORY_LABELS: Record<ToolingCategory, string> = {
    'injection-mold': 'Injection Mold',
    'stamping-die': 'Stamping Die',
    'die-cast-mold': 'Die-cast Mold',
    'mim-mold': 'MIM Mold',
    'press-mold': 'Press Mold',
    gauge: 'Gauge',
    fixture: 'Fixture',
    jig: 'Jig',
    other: 'Other',
};

export const TOOLING_STATUS_LABELS: Record<ToolingStatus, string> = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    't1-complete': 'T1 Complete',
    'in-modify': 'In Modify',
    approved: 'Approved',
    'approved-next-build': 'Approved for Next Build',
    'on-hold': 'On Hold',
    scrapped: 'Scrapped',
};

export const TOOLING_CATEGORIES = Object.keys(TOOLING_CATEGORY_PREFIX) as ToolingCategory[];
export const TOOLING_STATUSES = Object.keys(TOOLING_STATUS_LABELS) as ToolingStatus[];

export interface ToolingMilestone {
    id?: string;
    key: ToolingMilestoneKey;
    plannedDate?: string;
    status: 'not-started' | 'in-progress' | 'done' | 'blocked';
    actualDate?: string;
    owner?: string;
    notes?: string;
    blockerReason?: string;
}

export interface Tooling {
    id: string;
    projectId: string;
    designMasterPartId: string;
    toolingNumber: string;
    name: string;
    type: ToolingCategory;
    status: ToolingStatus;
    supplier?: string;
    cavityCount?: string;
    owner?: string;
    leadTimeDays?: number;
    milestones: ToolingMilestone[];
}

export const DEFAULT_TOOLING_MILESTONES: ToolingMilestone[] = [
    { key: 'drawingRelease', status: 'not-started' },
    { key: 'dfm', status: 'not-started' },
    { key: 'quotation', status: 'not-started' },
    { key: 'kickoff', status: 'not-started' },
    { key: 't1', status: 'not-started' },
];

export const getToolingCategoryPrefix = (category: ToolingCategory) => (
    TOOLING_CATEGORY_PREFIX[category] ?? TOOLING_CATEGORY_PREFIX.other
);

export const createToolingNumber = (category: ToolingCategory, sequence: number) => (
    `${getToolingCategoryPrefix(category)}-${String(sequence).padStart(3, '0')}`
);
