import { create } from 'zustand';
import { mockDesignMasterParts, mockTooling } from '../data/mockTooling';
import {
    DesignMasterPart,
    Tooling,
    ToolingMilestone,
    ToolingMilestoneKey,
} from '../domain/toolingTypes';

export interface ToolingState {
    designMasterParts: DesignMasterPart[];
    tooling: Tooling[];
    reset: () => void;
    getToolingByDesignMasterPart: (designMasterPartId: string) => Tooling[];
    updateMilestone: (
        toolingId: string,
        milestoneKey: ToolingMilestoneKey,
        updates: Partial<ToolingMilestone>,
    ) => void;
    getLeadTimeDays: (toolingId: string) => number | null;
}

const millisecondsPerDay = 24 * 60 * 60 * 1000;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createInitialState = () => ({
    designMasterParts: clone(mockDesignMasterParts),
    tooling: clone(mockTooling),
});

const getMilestoneDate = (milestone: ToolingMilestone | undefined) => (
    milestone?.actualDate ?? milestone?.plannedDate
);

const getDateTime = (date: string | undefined) => {
    if (!date) {
        return null;
    }

    const time = new Date(date).getTime();

    return Number.isNaN(time) ? null : time;
};

export const useToolingStore = create<ToolingState>((set, get) => ({
    ...createInitialState(),

    reset: () => {
        set(createInitialState());
    },

    getToolingByDesignMasterPart: (designMasterPartId: string) => (
        get().tooling.filter((item) => item.designMasterPartId === designMasterPartId)
    ),

    updateMilestone: (
        toolingId: string,
        milestoneKey: ToolingMilestoneKey,
        updates: Partial<ToolingMilestone>,
    ) => {
        set((state) => ({
            tooling: state.tooling.map((tooling) => {
                if (tooling.id !== toolingId) {
                    return tooling;
                }

                return {
                    ...tooling,
                    milestones: tooling.milestones.map((milestone) => (
                        milestone.key === milestoneKey
                            ? { ...milestone, ...updates, key: milestone.key }
                            : milestone
                    )),
                };
            }),
        }));
    },

    getLeadTimeDays: (toolingId: string) => {
        const tooling = get().tooling.find((item) => item.id === toolingId);

        if (!tooling) {
            return null;
        }

        const kickoff = tooling.milestones.find((milestone) => milestone.key === 'kickoff');
        const t1 = tooling.milestones.find((milestone) => milestone.key === 't1');
        const kickoffTime = getDateTime(getMilestoneDate(kickoff));
        const t1Time = getDateTime(getMilestoneDate(t1));

        if (kickoffTime === null || t1Time === null) {
            return null;
        }

        const leadTimeDays = Math.round((t1Time - kickoffTime) / millisecondsPerDay);

        return leadTimeDays < 0 ? null : leadTimeDays;
    },
}));
