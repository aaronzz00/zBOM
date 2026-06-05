import { create } from 'zustand';
import { mockDesignMasterParts, mockTooling } from '../data/mockTooling';
import {
    DesignMasterPart,
    Tooling,
    ToolingMilestone,
    ToolingMilestoneKey,
} from '../domain/toolingTypes';
import { coreRepository, calculateLeadTimeDays, toLegacyToolingState } from '../repositories/core/coreRepository';
import { useAuthStore } from './useAuthStore';

export interface ToolingState {
    designMasterParts: DesignMasterPart[];
    tooling: Tooling[];
    reset: () => void;
    getToolingByDesignMasterPart: (designMasterPartId: string) => Tooling[];
    createDesignMasterPart: (part: DesignMasterPart) => void;
    createTooling: (tooling: Tooling) => void;
    updateTooling: (toolingId: string, updates: Partial<Tooling>) => void;
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
    ...toLegacyToolingState(coreRepository.loadWorkspace()),
});

const getActor = () => {
    const user = useAuthStore.getState().currentUser;
    return {
        userId: user.id,
        name: user.name,
        role: user.role,
    };
};

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
        coreRepository.replaceLegacyTooling(clone(mockDesignMasterParts), clone(mockTooling));
        set(createInitialState());
    },

    getToolingByDesignMasterPart: (designMasterPartId: string) => (
        get().tooling.filter((item) => item.designMasterPartId === designMasterPartId)
    ),

    createDesignMasterPart: (part: DesignMasterPart) => {
        set((state) => {
            const designMasterParts = [...state.designMasterParts, part];
            coreRepository.replaceLegacyTooling(designMasterParts, state.tooling, getActor());
            return { designMasterParts };
        });
    },

    createTooling: (tooling: Tooling) => {
        set((state) => {
            const nextTooling = [...state.tooling, tooling];
            coreRepository.replaceLegacyTooling(state.designMasterParts, nextTooling, getActor());
            return { tooling: nextTooling };
        });
    },

    updateTooling: (toolingId: string, updates: Partial<Tooling>) => {
        set((state) => {
            const nextTooling = state.tooling.map((tooling) => (
                tooling.id === toolingId ? { ...tooling, ...updates, id: tooling.id } : tooling
            ));
            coreRepository.replaceLegacyTooling(state.designMasterParts, nextTooling, getActor());
            return { tooling: nextTooling };
        });
    },

    updateMilestone: (
        toolingId: string,
        milestoneKey: ToolingMilestoneKey,
        updates: Partial<ToolingMilestone>,
    ) => {
        set((state) => {
            const nextTooling = state.tooling.map((tooling) => {
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
            });
            coreRepository.replaceLegacyTooling(state.designMasterParts, nextTooling, getActor());
            return { tooling: nextTooling };
        });
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

        return calculateLeadTimeDays(tooling);
    },
}));
