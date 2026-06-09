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
import { useBOMStore } from './useBOMStore';
import {
    isBackendApiConfigured,
    createBackendTooling,
    updateBackendTooling,
    updateBackendToolingMilestone,
    type BackendWorkspaceSnapshot,
} from '../services/backendApi';

export interface ToolingState {
    designMasterParts: DesignMasterPart[];
    tooling: Tooling[];
    reset: () => void;
    loadFromRepository: () => void;
    applyBackendWorkspace: (snapshot: BackendWorkspaceSnapshot) => void;
    getToolingByDesignMasterPart: (designMasterPartId: string) => Tooling[];
    createDesignMasterPart: (part: DesignMasterPart) => void;
    createTooling: (tooling: Tooling) => Promise<Tooling>;
    updateTooling: (toolingId: string, updates: Partial<Tooling>) => Promise<Tooling | null>;
    updateMilestone: (
        toolingId: string,
        milestoneKey: ToolingMilestoneKey,
        updates: Partial<ToolingMilestone>,
    ) => void;
    getLeadTimeDays: (toolingId: string) => number | null;
    getT1PlannedDate: (toolingId: string) => string | null;
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

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const addDaysIso = (date: string | undefined, days: number | undefined) => {
    if (!date || !Number.isFinite(days) || !days) {
        return null;
    }
    const value = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(value.getTime())) {
        return null;
    }
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
};

export const useToolingStore = create<ToolingState>((set, get) => ({
    ...createInitialState(),

    reset: () => {
        coreRepository.replaceLegacyTooling(clone(mockDesignMasterParts), clone(mockTooling));
        set(createInitialState());
    },

    loadFromRepository: () => {
        set(createInitialState());
    },

    applyBackendWorkspace: (snapshot: BackendWorkspaceSnapshot) => {
        set({
            designMasterParts: snapshot.designMasterParts,
            tooling: snapshot.tooling,
        });
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

    createTooling: async (tooling: Tooling) => {
        if (isBackendApiConfigured()) {
            const created = await createBackendTooling({
                projectId: tooling.projectId,
                designMasterPartId: tooling.designMasterPartId,
                name: tooling.name,
                type: tooling.type,
                leadTimeDays: tooling.leadTimeDays,
                supplier: tooling.supplier ?? null,
                cavityCount: tooling.cavityCount ?? null,
                owner: tooling.owner ?? null,
            });
            set((state) => ({ tooling: [...state.tooling, created] }));
            return created;
        }

        const created = coreRepository.createToolingRecord({
            id: tooling.id,
            projectId: tooling.projectId,
            designMasterPartId: tooling.designMasterPartId,
            name: tooling.name,
            type: tooling.type ?? 'injection-mold',
            status: tooling.status ?? 'pending',
            supplier: tooling.supplier,
            cavityCount: tooling.cavityCount,
            owner: tooling.owner,
            leadTimeDays: tooling.leadTimeDays,
            milestones: tooling.milestones,
        }, getActor());
        const legacyCreated: Tooling = (({ updatedAt, ...record }) => record)(created);
        set((state) => ({ tooling: [...state.tooling, legacyCreated] }));
        return legacyCreated;
    },

    updateTooling: async (toolingId: string, updates: Partial<Tooling>) => {
        if (isBackendApiConfigured()) {
            const previous = get().tooling.find((tooling) => tooling.id === toolingId) ?? null;
            set((state) => ({
                tooling: state.tooling.map((tooling) => (
                    tooling.id === toolingId ? { ...tooling, ...updates, id: tooling.id } : tooling
                )),
            }));

            const payload = {
                name: updates.name,
                type: updates.type,
                status: updates.status,
                leadTimeDays: hasOwn(updates, 'leadTimeDays') ? updates.leadTimeDays ?? null : undefined,
                supplier: hasOwn(updates, 'supplier') ? updates.supplier ?? null : undefined,
                cavityCount: hasOwn(updates, 'cavityCount') ? updates.cavityCount ?? null : undefined,
                owner: hasOwn(updates, 'owner') ? updates.owner ?? null : undefined,
            };

            try {
                const updated = await updateBackendTooling(toolingId, payload);
                set((state) => ({
                    tooling: state.tooling.map((tooling) => tooling.id === toolingId ? updated : tooling),
                }));
                return updated;
            } catch (error) {
                if (previous) {
                    set((state) => ({
                        tooling: state.tooling.map((tooling) => tooling.id === toolingId ? previous : tooling),
                    }));
                }
                throw error;
            }
        }

        const updated = coreRepository.updateToolingRecord(toolingId, updates, getActor());
        const legacyUpdated: Tooling = (({ updatedAt, ...record }) => record)(updated);
        set((state) => ({
            tooling: state.tooling.map((tooling) => tooling.id === toolingId ? legacyUpdated : tooling),
        }));
        return legacyUpdated;
    },

    updateMilestone: async (
        toolingId: string,
        milestoneKey: ToolingMilestoneKey,
        updates: Partial<ToolingMilestone>,
    ) => {
        if (isBackendApiConfigured()) {
            const tooling = get().tooling.find(t => t.id === toolingId);
            const milestone = tooling?.milestones.find(m => m.key === milestoneKey);
            if (milestone && milestone.id) {
                const previous = tooling ?? null;
                set((state) => ({
                    tooling: state.tooling.map((item) => (
                        item.id === toolingId
                            ? {
                                ...item,
                                milestones: item.milestones.map((itemMilestone) => (
                                    itemMilestone.key === milestoneKey
                                        ? { ...itemMilestone, ...updates, key: itemMilestone.key }
                                        : itemMilestone
                                )),
                            }
                            : item
                    )),
                }));
                try {
                    const payload = {
                        status: updates.status,
                        plannedDate: hasOwn(updates, 'plannedDate') ? updates.plannedDate ?? null : undefined,
                        actualDate: hasOwn(updates, 'actualDate') ? updates.actualDate ?? null : undefined,
                        owner: hasOwn(updates, 'owner') ? updates.owner ?? null : undefined,
                        notes: hasOwn(updates, 'notes') ? updates.notes ?? null : undefined,
                        blockerReason: hasOwn(updates, 'blockerReason') ? updates.blockerReason ?? null : undefined,
                    };
                    await updateBackendToolingMilestone(milestone.id, payload);
                } catch (error) {
                    if (previous) {
                        set((state) => ({
                            tooling: state.tooling.map((item) => item.id === toolingId ? previous : item),
                        }));
                    }
                    console.error('Failed to update tooling milestone in API mode:', error);
                    throw error;
                }
            } else {
                console.error('Milestone ID not found for key:', milestoneKey);
            }
            return;
        }

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

    getT1PlannedDate: (toolingId: string) => {
        const tooling = get().tooling.find((item) => item.id === toolingId);
        if (!tooling) {
            return null;
        }
        const kickoff = tooling.milestones.find((milestone) => milestone.key === 'kickoff');
        return addDaysIso(kickoff?.plannedDate, tooling.leadTimeDays);
    },
}));
