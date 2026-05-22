import { create } from 'zustand';
import {
    ProductSeries,
    ProductStructure,
    ProjectProgram,
    SKU,
    VariationAxis,
    VariationOption,
} from '../domain/productTypes';
import {
    mockProjectPrograms,
    mockSeries,
    mockSKUs,
    mockStructures,
    mockVariationAxes,
} from '../data/mockProductConfig';

export interface ProductConfigState {
    projects: ProjectProgram[];
    series: ProductSeries[];
    structures: ProductStructure[];
    variationAxes: VariationAxis[];
    skus: SKU[];
    activeProjectId: string;
    reset: () => void;
    setActiveProject: (projectId: string) => void;
    activateSKU: (skuId: string) => void;
    freezeSKU: (skuId: string) => void;
    suppressSKU: (skuId: string) => void;
    generateCandidateSKUs: (projectId: string) => SKU[];
    getSKUsByStructure: (structureId: string) => SKU[];
    getActiveSKUs: (projectId: string) => SKU[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createInitialState = () => ({
    projects: clone(mockProjectPrograms),
    series: clone(mockSeries),
    structures: clone(mockStructures),
    variationAxes: clone(mockVariationAxes),
    skus: clone(mockSKUs),
    activeProjectId: mockProjectPrograms[0]?.id ?? '',
});

const getOptionSlug = (option: VariationOption, slugsInCombination: string[]) => {
    const codeSlug = option.code.toLowerCase();

    if (!slugsInCombination.includes(codeSlug)) {
        return codeSlug;
    }

    return option.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

const getOptionCombinations = (axes: VariationAxis[]) => (
    axes.reduce<VariationOption[][]>(
        (combinations, axis) => combinations.flatMap((combination) => (
            axis.options.map((option) => [...combination, option])
        )),
        [[]]
    )
);

export const useProductConfigStore = create<ProductConfigState>((set, get) => ({
    ...createInitialState(),

    reset: () => {
        set(createInitialState());
    },

    setActiveProject: (projectId: string) => {
        set({ activeProjectId: projectId });
    },

    activateSKU: (skuId: string) => {
        set((state) => ({
            skus: state.skus.map((sku) => (
                sku.id === skuId && sku.status === 'candidate'
                    ? { ...sku, status: 'active' }
                    : sku
            )),
        }));
    },

    freezeSKU: (skuId: string) => {
        set((state) => ({
            skus: state.skus.map((sku) => (
                sku.id === skuId && sku.status !== 'suppressed'
                    ? { ...sku, status: 'frozen', frozenAt: new Date().toISOString() }
                    : sku
            )),
        }));
    },

    suppressSKU: (skuId: string) => {
        set((state) => ({
            skus: state.skus.map((sku) => (
                sku.id === skuId && sku.status !== 'frozen'
                    ? { ...sku, status: 'suppressed' }
                    : sku
            )),
        }));
    },

    generateCandidateSKUs: (projectId: string) => {
        const { series, structures, variationAxes } = get();
        const projectStructures = structures.filter((structure) => structure.projectId === projectId);

        return projectStructures.flatMap((structure) => {
            const productSeries = series.find((item) => item.id === structure.seriesId);
            const applicableAxes = variationAxes.filter((axis) => (
                axis.projectId === projectId
                && (!axis.appliesToStructureIds || axis.appliesToStructureIds.includes(structure.id))
            ));
            const optionCombinations = getOptionCombinations(applicableAxes);

            return optionCombinations.map((options) => {
                const optionCodeSegments = options.map((option) => option.code);
                const optionIdSegments = options.reduce<string[]>((slugs, option) => (
                    [...slugs, getOptionSlug(option, slugs)]
                ), []);

                return {
                    id: `sku-${productSeries?.code.toLowerCase() ?? 'unknown'}-${structure.code.toLowerCase()}-${optionIdSegments.join('-')}`,
                    projectId,
                    seriesId: structure.seriesId,
                    structureId: structure.id,
                    code: `${productSeries?.code ?? 'UNKNOWN'}-${structure.code}-${optionCodeSegments.join('-')}`,
                    status: 'candidate',
                    optionIds: options.map((option) => option.id),
                    generatedByRule: true,
                };
            });
        });
    },

    getSKUsByStructure: (structureId: string) => (
        get().skus.filter((sku) => sku.structureId === structureId)
    ),

    getActiveSKUs: (projectId: string) => (
        get().skus.filter((sku) => (
            sku.projectId === projectId && (sku.status === 'active' || sku.status === 'frozen')
        ))
    ),
}));
