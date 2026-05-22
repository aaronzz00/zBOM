import { DesignMasterPart, Tooling } from '../domain/toolingTypes';

export const mockDesignMasterParts: DesignMasterPart[] = [
    {
        id: 'dmp-zp-a-enclosure-cover',
        projectId: 'project-zphone-2026',
        structureId: 'structure-zp-a-std',
        code: 'DMP-ZPA-ENC-COVER',
        name: 'Enclosure Cover',
        concretePartNumbers: [
            'ZP-A-STD-COVER-BLK',
            'ZP-A-STD-COVER-SLV',
        ],
    },
    {
        id: 'dmp-zp-a-pro-camera-deco',
        projectId: 'project-zphone-2026',
        structureId: 'structure-zp-a-pro',
        code: 'DMP-ZPA-PRO-CAMERA-DECO',
        name: 'Pro Camera Decoration Ring',
        concretePartNumbers: [
            'ZP-A-PRO-CAMERA-DECO-BLK',
        ],
    },
];

export const mockTooling: Tooling[] = [
    {
        id: 'tooling-zp-a-cover-injection',
        projectId: 'project-zphone-2026',
        designMasterPartId: 'dmp-zp-a-enclosure-cover',
        name: 'Enclosure Cover Injection Mold',
        supplier: 'Shenzhen Precision Mold Co.',
        cavityCount: 2,
        milestones: [
            {
                key: 'drawingRelease',
                plannedDate: '2026-01-12',
                status: 'done',
                actualDate: '2026-01-13',
            },
            {
                key: 'dfm',
                plannedDate: '2026-01-20',
                status: 'done',
                actualDate: '2026-01-22',
            },
            {
                key: 'quotation',
                plannedDate: '2026-01-28',
                status: 'done',
                actualDate: '2026-01-30',
            },
            {
                key: 'kickoff',
                plannedDate: '2026-02-01',
                status: 'done',
                actualDate: '2026-02-10',
            },
            {
                key: 't1',
                plannedDate: '2026-03-01',
                status: 'done',
                actualDate: '2026-03-03',
            },
        ],
    },
    {
        id: 'tooling-zp-a-pro-camera-deco',
        projectId: 'project-zphone-2026',
        designMasterPartId: 'dmp-zp-a-pro-camera-deco',
        name: 'Pro Camera Decoration Ring Die',
        supplier: 'Suzhou Micro Die Works',
        cavityCount: 4,
        milestones: [
            {
                key: 'drawingRelease',
                plannedDate: '2026-01-18',
                status: 'done',
            },
            {
                key: 'dfm',
                plannedDate: '2026-01-26',
                status: 'done',
            },
            {
                key: 'quotation',
                plannedDate: '2026-02-02',
                status: 'done',
            },
            {
                key: 'kickoff',
                plannedDate: '2026-02-15',
                status: 'in-progress',
            },
            {
                key: 't1',
                plannedDate: '2026-03-17',
                status: 'not-started',
            },
        ],
    },
    {
        id: 'tooling-zp-a-cover-color-gauge',
        projectId: 'project-zphone-2026',
        designMasterPartId: 'dmp-zp-a-enclosure-cover',
        name: 'Enclosure Cover Color Gauge',
        supplier: 'Dongguan Appearance Fixtures',
        milestones: [
            {
                key: 'drawingRelease',
                plannedDate: '2026-02-05',
                status: 'done',
            },
            {
                key: 'dfm',
                plannedDate: '2026-02-12',
                status: 'in-progress',
            },
            {
                key: 'quotation',
                plannedDate: '2026-02-19',
                status: 'not-started',
            },
            {
                key: 'kickoff',
                plannedDate: '2026-03-01',
                status: 'not-started',
            },
            {
                key: 't1',
                status: 'not-started',
            },
        ],
    },
];
