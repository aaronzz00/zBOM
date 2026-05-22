import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ViewState {
    hiddenColumns: string[];
    toggleColumn: (columnId: string) => void;
    isColumnVisible: (columnId: string) => boolean;
}

export const useViewStore = create<ViewState>()(
    persist(
        (set, get) => ({
            hiddenColumns: [],
            toggleColumn: (columnId) =>
                set((state) => {
                    const isHidden = state.hiddenColumns.includes(columnId);
                    return {
                        hiddenColumns: isHidden
                            ? state.hiddenColumns.filter((id) => id !== columnId)
                            : [...state.hiddenColumns, columnId],
                    };
                }),
            isColumnVisible: (columnId) => !get().hiddenColumns.includes(columnId),
        }),
        {
            name: 'zbom-view-storage',
        }
    )
);
