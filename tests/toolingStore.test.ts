import { beforeEach, describe, expect, it } from 'vitest';
import { mockDesignMasterParts, mockTooling } from '../data/mockTooling';
import { useToolingStore } from '../stores/useToolingStore';

const multiPartDesignMasterPartId = 'dmp-zp-a-enclosure-cover';
const actualDatesToolingId = 'tooling-zp-a-cover-injection';
const plannedDatesToolingId = 'tooling-zp-a-pro-camera-deco';
const dateLessToolingId = 'tooling-zp-a-cover-color-gauge';

describe('useToolingStore', () => {
    beforeEach(() => {
        useToolingStore.getState().reset();
    });

    it('loads the initial mock design master parts and tooling', () => {
        const state = useToolingStore.getState();

        expect(state.designMasterParts).toEqual(mockDesignMasterParts);
        expect(state.tooling).toEqual(mockTooling);
    });

    it('returns tooling by design master part', () => {
        const tooling = useToolingStore.getState().getToolingByDesignMasterPart(multiPartDesignMasterPartId);

        expect(tooling.map((item) => item.id)).toEqual([
            'tooling-zp-a-cover-injection',
            'tooling-zp-a-cover-color-gauge',
        ]);
    });

    it('keeps one design master part mapped to multiple concrete part numbers', () => {
        const designMasterPart = useToolingStore.getState().designMasterParts.find((part) => (
            part.id === multiPartDesignMasterPartId
        ));

        expect(designMasterPart?.concretePartNumbers).toEqual([
            'ZP-A-STD-COVER-BLK',
            'ZP-A-STD-COVER-SLV',
        ]);
    });

    it('links tooling records to design master parts instead of direct concrete part numbers', () => {
        const tooling = useToolingStore.getState().tooling;

        expect(tooling.every((item) => Boolean(item.designMasterPartId))).toBe(true);
        expect(tooling.some((item) => 'concretePartNumber' in item || 'concretePartNumbers' in item)).toBe(false);
    });

    it('updates milestone status and actual date for a known tooling milestone', () => {
        useToolingStore.getState().updateMilestone(actualDatesToolingId, 'dfm', {
            status: 'blocked',
            actualDate: '2026-01-25',
        });

        const tooling = useToolingStore.getState().tooling.find((item) => item.id === actualDatesToolingId);
        const dfm = tooling?.milestones.find((milestone) => milestone.key === 'dfm');
        const quotation = tooling?.milestones.find((milestone) => milestone.key === 'quotation');

        expect(dfm).toMatchObject({
            key: 'dfm',
            status: 'blocked',
            actualDate: '2026-01-25',
        });
        expect(quotation).toEqual(mockTooling[0]?.milestones[2]);
    });

    it('does not create unknown tooling records or unknown milestones', () => {
        const initialToolingCount = useToolingStore.getState().tooling.length;
        const initialMilestoneCount = useToolingStore
            .getState()
            .tooling.find((item) => item.id === actualDatesToolingId)
            ?.milestones.length;

        useToolingStore.getState().updateMilestone('tooling-unknown', 'dfm', {
            status: 'done',
        });
        useToolingStore.getState().updateMilestone(actualDatesToolingId, 'not-a-milestone' as never, {
            status: 'done',
        });

        const tooling = useToolingStore.getState().tooling.find((item) => item.id === actualDatesToolingId);

        expect(useToolingStore.getState().tooling).toHaveLength(initialToolingCount);
        expect(tooling?.milestones).toHaveLength(initialMilestoneCount);
        expect(tooling?.milestones.some((milestone) => milestone.key === 'not-a-milestone')).toBe(false);
    });

    it('returns Kickoff to T1 lead time days using actual dates when present', () => {
        expect(useToolingStore.getState().getLeadTimeDays(actualDatesToolingId)).toBe(21);
    });

    it('falls back to planned dates when actual dates are absent', () => {
        expect(useToolingStore.getState().getLeadTimeDays(plannedDatesToolingId)).toBe(30);
    });

    it('returns null when Kickoff or T1 is missing or date-less', () => {
        useToolingStore.setState((state) => ({
            tooling: state.tooling.map((item) => (
                item.id === plannedDatesToolingId
                    ? {
                        ...item,
                        milestones: item.milestones.filter((milestone) => milestone.key !== 'kickoff'),
                    }
                    : item
            )),
        }));

        expect(useToolingStore.getState().getLeadTimeDays(plannedDatesToolingId)).toBeNull();
        expect(useToolingStore.getState().getLeadTimeDays(dateLessToolingId)).toBeNull();
        expect(useToolingStore.getState().getLeadTimeDays('tooling-unknown')).toBeNull();
    });

    it('returns null when T1 is before kickoff', () => {
        useToolingStore.getState().updateMilestone('tooling-zp-a-cover-injection', 'kickoff', {
            plannedDate: '2026-05-20',
            actualDate: undefined,
        });
        useToolingStore.getState().updateMilestone('tooling-zp-a-cover-injection', 't1', {
            plannedDate: '2026-05-10',
            actualDate: undefined,
        });

        expect(useToolingStore.getState().getLeadTimeDays('tooling-zp-a-cover-injection')).toBeNull();
    });

    it('restores mutated milestone data on reset', () => {
        useToolingStore.getState().updateMilestone(actualDatesToolingId, 'dfm', {
            status: 'blocked',
            actualDate: '2026-01-25',
        });

        useToolingStore.getState().reset();

        expect(useToolingStore.getState().tooling).toEqual(mockTooling);
    });
});
