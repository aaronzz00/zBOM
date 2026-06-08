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
    name: string;
    supplier?: string;
    cavityCount?: number;
    owner?: string;
    milestones: ToolingMilestone[];
}
