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
    key: ToolingMilestoneKey;
    plannedDate?: string;
    status: 'not-started' | 'in-progress' | 'done' | 'blocked';
    actualDate?: string;
}

export interface Tooling {
    id: string;
    projectId: string;
    designMasterPartId: string;
    name: string;
    supplier?: string;
    cavityCount?: number;
    milestones: ToolingMilestone[];
}
