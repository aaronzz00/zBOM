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
        toolingNumber: 'TL-INJ-001',
        name: 'Enclosure Cover Injection Mold',
        type: 'injection-mold',
        status: 'approved',
        supplier: 'Shenzhen Precision Mold Co.',
        cavityCount: '2',
        owner: 'Mia Chen',
        leadTimeDays: 21,
        milestones: [
            {
                key: 'drawingRelease',
                status: 'done',
            },
            {
                key: 'dfm',
                status: 'done',
            },
            {
                key: 'quotation',
                status: 'done',
            },
            {
                key: 'kickoff',
                plannedDate: '2026-02-01',
                status: 'done',
                actualDate: '2026-02-10',
            },
            {
                key: 't1',
                status: 'done',
                actualDate: '2026-03-03',
            },
        ],
    },
    {
        id: 'tooling-zp-a-pro-camera-deco',
        projectId: 'project-zphone-2026',
        designMasterPartId: 'dmp-zp-a-pro-camera-deco',
        toolingNumber: 'TL-STP-001',
        name: 'Pro Camera Decoration Ring Die',
        type: 'stamping-die',
        status: 'in-progress',
        supplier: 'Suzhou Micro Die Works',
        cavityCount: '4',
        owner: 'Leo Wang',
        leadTimeDays: 30,
        milestones: [
            {
                key: 'drawingRelease',
                status: 'done',
            },
            {
                key: 'dfm',
                status: 'done',
            },
            {
                key: 'quotation',
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
        toolingNumber: 'TL-GAU-001',
        name: 'Enclosure Cover Color Gauge',
        type: 'gauge',
        status: 'pending',
        supplier: 'Dongguan Appearance Fixtures',
        owner: 'Priya Nair',
        leadTimeDays: 14,
        milestones: [
            {
                key: 'drawingRelease',
                status: 'done',
            },
            {
                key: 'dfm',
                status: 'blocked',
                blockerReason: 'Color limit samples not signed off.',
            },
            {
                key: 'quotation',
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
