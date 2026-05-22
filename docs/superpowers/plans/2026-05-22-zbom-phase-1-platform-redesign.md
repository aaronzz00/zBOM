# zBOM Phase 1 Platform Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the phase 1 domain backbone for a multi-project product configuration and manufacturing difference management platform while keeping the current single-project BOM prototype operational.

**Architecture:** Add the new product configuration, EBOM inheritance, MBOM delta, and tooling subject model side-by-side with the current legacy BOM model. Existing pages continue using `BOMNode` and `useBOMStore`; new phase 1 pages consume new focused stores directly. Compatibility is introduced later through a read-only legacy BOM adapter, not by immediately rewriting the current BOM editor.

**Tech Stack:** React 18, TypeScript, Vite, Zustand, Zod, Vitest, Testing Library, Recharts, lucide-react.

---

## Current Repository Assessment

The current repository is a runnable frontend prototype centered on a single active project and one editable BOM tree.

Relevant current files:

- `types.ts`: owns current IAM, BOM, project, supplier, library, ECO, and AI types.
- `stores/useBOMStore.ts`: single business store for project, BOM tree, library parts, suppliers, snapshots, attributes, and attachments.
- `context/AppContext.tsx`: compatibility facade over `useBOMStore`.
- `pages/BOMEditor.tsx`: current EBOM/MBOM toggle, tree/matrix/flat views, CSV, snapshots, properties panel, attachments, and AI panel.
- `components/BOMTable.tsx`: legacy `BOMNode` tree renderer with virtualized rows.
- `components/BOMMatrix.tsx`: variant-tag matrix over a legacy BOM tree.
- `components/BOMFlatView.tsx`: procurement-flattened view over a legacy BOM tree.
- `pages/BOMCompare.tsx`: full-tree snapshot comparison by part number.
- `data/mockBOM.ts`: single-project BOM mock.

Important gaps against the redesign:

- No first-class `Series`, `Structure`, `VariationAxis`, or `SKU`.
- No double-layer EBOM inheritance model.
- No `DesignMasterPart` / `ToolingSubject` layer.
- No typed MBOM delta pack model.
- No SKU-first MBOM difference retrieval.
- No frozen released MBOM model.
- Current MBOM is only a boolean view over `BOMNode.isAuxiliary`.
- Current matrix columns are variant tags, not SKU objects.

## Phase 1 Implementation Strategy

Use additive migration first.

- Keep `types.ts` stable initially.
- Keep `useBOMStore` stable initially.
- Keep all existing pages working.
- Add new domain files under `domain/`.
- Add new mock files under `data/`.
- Add new focused stores under `stores/`.
- Add new pages under `pages/`.
- Add route entries in `App.tsx` and `components/Sidebar.tsx`.
- Add compatibility adapter only after new domain stores are tested.

Do not directly rewrite `BOMEditor` in the first slice.

## File Structure

Create:

- `domain/productTypes.ts`: project, series, structure, variation axis, option, SKU types.
- `domain/ebomArchitectureTypes.ts`: EBOM base, EBOM item, inheritance and lock types.
- `domain/mbomTypes.ts`: MBOM delta pack, delta item, released MBOM types.
- `domain/toolingTypes.ts`: design master part, tooling, milestone types.
- `data/mockProductConfig.ts`: phase 1 product configuration mock.
- `data/mockEBOMArchitecture.ts`: phase 1 EBOM inheritance mock.
- `data/mockMBOMDeltas.ts`: phase 1 MBOM delta mock.
- `data/mockTooling.ts`: phase 1 tooling mock.
- `stores/useProductConfigStore.ts`: product matrix state and SKU actions.
- `stores/useEBOMArchitectureStore.ts`: EBOM bases/items and inheritance-facing selectors.
- `stores/useMBOMDeltaStore.ts`: SKU-first MBOM delta retrieval.
- `stores/useToolingStore.ts`: tooling subjects, tooling records, milestone updates.
- `utils/ebomInheritance.ts`: pure EBOM inheritance resolution utilities.
- `utils/legacyBomAdapter.ts`: read-only projection from resolved EBOM items to legacy `BOMNode`.
- `pages/ProductMatrixCenter.tsx`: product matrix and SKU activation page.
- `pages/EBOMArchitectureWorkspace.tsx`: inheritance workspace.
- `pages/MBOMDeltaConsole.tsx`: SKU-first MBOM delta page.
- `pages/ToolingHub.tsx`: tooling subject and milestone page.
- `tests/productConfigStore.test.ts`
- `tests/ebomInheritance.test.ts`
- `tests/mbomDeltaStore.test.ts`
- `tests/toolingStore.test.ts`
- `tests/legacyBomAdapter.test.ts`

Modify:

- `App.tsx`: add new page switch cases.
- `components/Sidebar.tsx`: add navigation entries.
- `types.ts`: only add permissions if a page truly requires distinct visibility control.

Avoid modifying in first slice:

- `stores/useBOMStore.ts`
- `context/AppContext.tsx`
- `pages/BOMEditor.tsx`
- `components/BOMTable.tsx`
- `components/BOMMatrix.tsx`
- `components/BOMFlatView.tsx`
- `data/mockBOM.ts`

---

## Task 1: Product Configuration Domain Types

**Files:**

- Create: `domain/productTypes.ts`
- Test: `tests/productConfigStore.test.ts`

- [ ] **Step 1: Add product domain type file**

Create `domain/productTypes.ts`:

```ts
export type ProjectPhase = 'EVT' | 'DVT' | 'PVT' | 'MP';

export interface ProjectProgram {
  id: string;
  code: string;
  name: string;
  phase: ProjectPhase;
  primarySeriesId: string;
  status: 'active' | 'archived';
}

export interface ProductSeries {
  id: string;
  projectId: string;
  code: string;
  name: string;
  isPrimary: boolean;
  baseSeriesId?: string;
}

export interface ProductStructure {
  id: string;
  projectId: string;
  seriesId: string;
  code: string;
  name: string;
  baseStructureId?: string;
}

export interface VariationOption {
  id: string;
  axisId: string;
  code: string;
  label: string;
}

export interface VariationAxis {
  id: string;
  projectId: string;
  code: string;
  name: string;
  appliesToStructureIds?: string[];
  options: VariationOption[];
}

export type SKUStatus = 'candidate' | 'active' | 'frozen' | 'suppressed';

export interface SKU {
  id: string;
  projectId: string;
  seriesId: string;
  structureId: string;
  code: string;
  status: SKUStatus;
  optionIds: string[];
  generatedByRule: boolean;
  frozenAt?: string;
}
```

- [ ] **Step 2: Run typecheck through build**

Run:

```bash
npm run build
```

Expected: build passes or only existing bundle-size warning appears.

- [ ] **Step 3: Commit**

```bash
git add domain/productTypes.ts
git commit -m "feat: add product configuration domain types"
```

---

## Task 2: Product Configuration Mock Data

**Files:**

- Create: `data/mockProductConfig.ts`
- Depends on: `domain/productTypes.ts`

- [ ] **Step 1: Add mock data**

Create `data/mockProductConfig.ts`:

```ts
import {
  ProductSeries,
  ProductStructure,
  ProjectProgram,
  SKU,
  VariationAxis,
} from '../domain/productTypes';

export const mockProjectPrograms: ProjectProgram[] = [
  {
    id: 'project-zphone-2026',
    code: 'ZP26',
    name: 'zPhone 2026 Platform',
    phase: 'DVT',
    primarySeriesId: 'series-zp-a',
    status: 'active',
  },
];

export const mockSeries: ProductSeries[] = [
  {
    id: 'series-zp-a',
    projectId: 'project-zphone-2026',
    code: 'ZP-A',
    name: 'zPhone A Series',
    isPrimary: true,
  },
  {
    id: 'series-zp-b',
    projectId: 'project-zphone-2026',
    code: 'ZP-B',
    name: 'zPhone B Series',
    isPrimary: false,
    baseSeriesId: 'series-zp-a',
  },
];

export const mockStructures: ProductStructure[] = [
  {
    id: 'structure-zp-a-std',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    code: 'STD',
    name: 'Standard Structure',
  },
  {
    id: 'structure-zp-a-pro',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    code: 'PRO',
    name: 'Pro Structure',
    baseStructureId: 'structure-zp-a-std',
  },
];

export const mockVariationAxes: VariationAxis[] = [
  {
    id: 'axis-color',
    projectId: 'project-zphone-2026',
    code: 'COLOR',
    name: 'Color',
    options: [
      { id: 'opt-color-black', axisId: 'axis-color', code: 'BLK', label: 'Black' },
      { id: 'opt-color-silver', axisId: 'axis-color', code: 'SLV', label: 'Silver' },
    ],
  },
  {
    id: 'axis-region',
    projectId: 'project-zphone-2026',
    code: 'REGION',
    name: 'Region',
    options: [
      { id: 'opt-region-us', axisId: 'axis-region', code: 'US', label: 'United States' },
      { id: 'opt-region-eu', axisId: 'axis-region', code: 'EU', label: 'Europe' },
    ],
  },
  {
    id: 'axis-packaging',
    projectId: 'project-zphone-2026',
    code: 'PKG',
    name: 'Packaging',
    options: [
      { id: 'opt-packaging-retail', axisId: 'axis-packaging', code: 'RTL', label: 'Retail' },
      { id: 'opt-packaging-bulk', axisId: 'axis-packaging', code: 'BLK', label: 'Bulk' },
    ],
  },
];

export const mockSKUs: SKU[] = [
  {
    id: 'sku-zp-a-std-blk-us-rtl',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    structureId: 'structure-zp-a-std',
    code: 'ZP-A-STD-BLK-US-RTL',
    status: 'active',
    optionIds: ['opt-color-black', 'opt-region-us', 'opt-packaging-retail'],
    generatedByRule: true,
  },
  {
    id: 'sku-zp-a-std-slv-eu-rtl',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    structureId: 'structure-zp-a-std',
    code: 'ZP-A-STD-SLV-EU-RTL',
    status: 'frozen',
    optionIds: ['opt-color-silver', 'opt-region-eu', 'opt-packaging-retail'],
    generatedByRule: true,
    frozenAt: '2026-05-22T00:00:00.000Z',
  },
  {
    id: 'sku-zp-a-pro-blk-us-rtl',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    structureId: 'structure-zp-a-pro',
    code: 'ZP-A-PRO-BLK-US-RTL',
    status: 'candidate',
    optionIds: ['opt-color-black', 'opt-region-us', 'opt-packaging-retail'],
    generatedByRule: true,
  },
  {
    id: 'sku-zp-a-pro-slv-eu-bulk',
    projectId: 'project-zphone-2026',
    seriesId: 'series-zp-a',
    structureId: 'structure-zp-a-pro',
    code: 'ZP-A-PRO-SLV-EU-BLK',
    status: 'suppressed',
    optionIds: ['opt-color-silver', 'opt-region-eu', 'opt-packaging-bulk'],
    generatedByRule: true,
  },
];
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add data/mockProductConfig.ts
git commit -m "feat: add product configuration mock data"
```

---

## Task 3: Product Configuration Store

**Files:**

- Create: `stores/useProductConfigStore.ts`
- Test: `tests/productConfigStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/productConfigStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useProductConfigStore } from '../stores/useProductConfigStore';

describe('useProductConfigStore', () => {
  beforeEach(() => {
    useProductConfigStore.getState().reset();
  });

  it('loads the active project and primary series', () => {
    const state = useProductConfigStore.getState();
    const project = state.projects.find((p) => p.id === state.activeProjectId);
    expect(project?.primarySeriesId).toBe('series-zp-a');
    expect(state.series.find((s) => s.id === project?.primarySeriesId)?.isPrimary).toBe(true);
  });

  it('filters SKUs by structure', () => {
    const skus = useProductConfigStore.getState().getSKUsByStructure('structure-zp-a-std');
    expect(skus.length).toBeGreaterThan(0);
    expect(skus.every((sku) => sku.structureId === 'structure-zp-a-std')).toBe(true);
  });

  it('activates a candidate SKU', () => {
    const store = useProductConfigStore.getState();
    store.activateSKU('sku-zp-a-pro-blk-us-rtl');
    expect(useProductConfigStore.getState().skus.find((sku) => sku.id === 'sku-zp-a-pro-blk-us-rtl')?.status).toBe('active');
  });

  it('freezes an active SKU', () => {
    const store = useProductConfigStore.getState();
    store.activateSKU('sku-zp-a-pro-blk-us-rtl');
    store.freezeSKU('sku-zp-a-pro-blk-us-rtl');
    const sku = useProductConfigStore.getState().skus.find((item) => item.id === 'sku-zp-a-pro-blk-us-rtl');
    expect(sku?.status).toBe('frozen');
    expect(sku?.frozenAt).toBeDefined();
  });

  it('excludes suppressed SKUs from active SKU list', () => {
    const activeSkus = useProductConfigStore.getState().getActiveSKUs('project-zphone-2026');
    expect(activeSkus.some((sku) => sku.status === 'suppressed')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npx vitest run tests/productConfigStore.test.ts
```

Expected: fails because `useProductConfigStore` does not exist.

- [ ] **Step 3: Implement store**

Create `stores/useProductConfigStore.ts`:

```ts
import { create } from 'zustand';
import {
  mockProjectPrograms,
  mockSeries,
  mockSKUs,
  mockStructures,
  mockVariationAxes,
} from '../data/mockProductConfig';
import {
  ProductSeries,
  ProductStructure,
  ProjectProgram,
  SKU,
  VariationAxis,
} from '../domain/productTypes';

interface ProductConfigState {
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

const initialState = {
  projects: mockProjectPrograms,
  series: mockSeries,
  structures: mockStructures,
  variationAxes: mockVariationAxes,
  skus: mockSKUs,
  activeProjectId: mockProjectPrograms[0]?.id ?? '',
};

const buildCandidateCode = (
  series: ProductSeries,
  structure: ProductStructure,
  optionCodes: string[],
) => [series.code, structure.code, ...optionCodes].join('-');

const cartesian = <T>(groups: T[][]): T[][] =>
  groups.reduce<T[][]>(
    (acc, group) => acc.flatMap((prefix) => group.map((item) => [...prefix, item])),
    [[]],
  );

export const useProductConfigStore = create<ProductConfigState>((set, get) => ({
  ...initialState,

  reset: () => set({ ...initialState }),

  setActiveProject: (projectId) => {
    set({ activeProjectId: projectId });
  },

  activateSKU: (skuId) => {
    set((state) => ({
      skus: state.skus.map((sku) =>
        sku.id === skuId && sku.status === 'candidate'
          ? { ...sku, status: 'active' }
          : sku,
      ),
    }));
  },

  freezeSKU: (skuId) => {
    set((state) => ({
      skus: state.skus.map((sku) =>
        sku.id === skuId && sku.status !== 'suppressed'
          ? { ...sku, status: 'frozen', frozenAt: new Date().toISOString() }
          : sku,
      ),
    }));
  },

  suppressSKU: (skuId) => {
    set((state) => ({
      skus: state.skus.map((sku) =>
        sku.id === skuId && sku.status !== 'frozen'
          ? { ...sku, status: 'suppressed' }
          : sku,
      ),
    }));
  },

  generateCandidateSKUs: (projectId) => {
    const state = get();
    const structures = state.structures.filter((structure) => structure.projectId === projectId);
    const axes = state.variationAxes.filter((axis) => axis.projectId === projectId);
    const optionGroups = axes.map((axis) => axis.options);
    const combinations = cartesian(optionGroups);

    return structures.flatMap((structure) => {
      const series = state.series.find((item) => item.id === structure.seriesId);
      if (!series) return [];

      return combinations.map((options) => ({
        id: `candidate-${structure.id}-${options.map((option) => option.id).join('-')}`,
        projectId,
        seriesId: structure.seriesId,
        structureId: structure.id,
        code: buildCandidateCode(series, structure, options.map((option) => option.code)),
        status: 'candidate' as const,
        optionIds: options.map((option) => option.id),
        generatedByRule: true,
      }));
    });
  },

  getSKUsByStructure: (structureId) => get().skus.filter((sku) => sku.structureId === structureId),

  getActiveSKUs: (projectId) =>
    get().skus.filter(
      (sku) =>
        sku.projectId === projectId &&
        (sku.status === 'active' || sku.status === 'frozen'),
    ),
}));
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
npx vitest run tests/productConfigStore.test.ts
```

Expected: tests pass.

- [ ] **Step 5: Run full verification**

Run:

```bash
npx vitest run
npm run build
```

Expected: all tests pass and build passes.

- [ ] **Step 6: Commit**

```bash
git add stores/useProductConfigStore.ts tests/productConfigStore.test.ts
git commit -m "feat: add product configuration store"
```

---

## Task 4: Product Matrix Center Page

**Files:**

- Create: `pages/ProductMatrixCenter.tsx`
- Modify: `App.tsx`
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Create the page**

Create `pages/ProductMatrixCenter.tsx`:

```tsx
import React from 'react';
import { Box, CheckCircle2, Layers3, PackageCheck, PauseCircle, Snowflake } from 'lucide-react';
import { useProductConfigStore } from '../stores/useProductConfigStore';
import { SKUStatus } from '../domain/productTypes';

const statusStyles: Record<SKUStatus, string> = {
  candidate: 'bg-slate-100 text-slate-700 border-slate-200',
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  frozen: 'bg-blue-100 text-blue-700 border-blue-200',
  suppressed: 'bg-rose-100 text-rose-700 border-rose-200',
};

export const ProductMatrixCenter: React.FC = () => {
  const {
    activeProjectId,
    projects,
    series,
    structures,
    variationAxes,
    skus,
    activateSKU,
    freezeSKU,
    suppressSKU,
  } = useProductConfigStore();

  const project = projects.find((item) => item.id === activeProjectId);
  const projectSeries = series.filter((item) => item.projectId === activeProjectId);
  const projectStructures = structures.filter((item) => item.projectId === activeProjectId);
  const projectAxes = variationAxes.filter((item) => item.projectId === activeProjectId);
  const projectSkus = skus.filter((item) => item.projectId === activeProjectId);

  return (
    <div className="flex-1 overflow-auto bg-slate-50 p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 mb-2">
          <Layers3 className="w-4 h-4" />
          Product Matrix Center
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{project?.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage project series, structures, variation axes, and candidate/active/frozen SKUs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800">Series</h2>
            <Box className="w-4 h-4 text-blue-600" />
          </div>
          <div className="space-y-2">
            {projectSeries.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-slate-800">{item.code}</span>
                  {item.isPrimary && <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">PRIMARY</span>}
                </div>
                <p className="text-sm text-slate-500 mt-1">{item.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800">Structures</h2>
            <PackageCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="space-y-2">
            {projectStructures.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <span className="font-mono text-sm font-bold text-slate-800">{item.code}</span>
                <p className="text-sm text-slate-500 mt-1">{item.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-800">Variation Axes</h2>
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="space-y-3">
            {projectAxes.map((axis) => (
              <div key={axis.id}>
                <div className="text-xs font-bold text-slate-500 uppercase mb-1">{axis.name}</div>
                <div className="flex flex-wrap gap-1">
                  {axis.options.map((option) => (
                    <span key={option.id} className="text-xs border border-slate-200 bg-slate-50 rounded-full px-2 py-0.5 font-mono">
                      {option.code}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-800">SKU Matrix</h2>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Structure</th>
              <th className="px-4 py-3">Options</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projectSkus.map((sku) => {
              const structure = structures.find((item) => item.id === sku.structureId);
              const optionLabels = sku.optionIds
                .map((optionId) => projectAxes.flatMap((axis) => axis.options).find((option) => option.id === optionId)?.code)
                .filter(Boolean)
                .join(' / ');

              return (
                <tr key={sku.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">{sku.code}</td>
                  <td className="px-4 py-3 text-slate-600">{structure?.code}</td>
                  <td className="px-4 py-3 text-slate-600">{optionLabels}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold uppercase ${statusStyles[sku.status]}`}>
                      {sku.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => activateSKU(sku.id)}
                        disabled={sku.status !== 'candidate'}
                        className="px-2 py-1 rounded border border-emerald-200 text-emerald-700 disabled:opacity-30"
                      >
                        Activate
                      </button>
                      <button
                        onClick={() => freezeSKU(sku.id)}
                        disabled={sku.status === 'suppressed' || sku.status === 'frozen'}
                        className="px-2 py-1 rounded border border-blue-200 text-blue-700 disabled:opacity-30"
                      >
                        <Snowflake className="w-3 h-3 inline mr-1" />
                        Freeze
                      </button>
                      <button
                        onClick={() => suppressSKU(sku.id)}
                        disabled={sku.status === 'frozen'}
                        className="px-2 py-1 rounded border border-rose-200 text-rose-700 disabled:opacity-30"
                      >
                        <PauseCircle className="w-3 h-3 inline mr-1" />
                        Suppress
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Add route in `App.tsx`**

Add import:

```ts
import { ProductMatrixCenter } from './pages/ProductMatrixCenter';
```

Add switch case:

```tsx
case 'product-matrix':
  return <ProductMatrixCenter />;
```

- [ ] **Step 3: Add sidebar nav item**

In `components/Sidebar.tsx`, import an icon if needed:

```ts
import { Grid3X3 } from 'lucide-react';
```

Add nav item near Dashboard/BOM:

```ts
{ id: 'product-matrix', icon: Grid3X3, label: 'Product Matrix', requiredPerm: Permission.VIEW_BOM },
```

- [ ] **Step 4: Run full verification**

Run:

```bash
npx vitest run
npm run build
```

Expected:

- Existing tests pass.
- Build passes.
- Dashboard route still compiles.
- BOM Editor route still compiles.
- Product Matrix route compiles.

- [ ] **Step 5: Commit**

```bash
git add pages/ProductMatrixCenter.tsx App.tsx components/Sidebar.tsx
git commit -m "feat: add product matrix center"
```

---

## Task 5: EBOM Architecture Domain Types

**Files:**

- Create: `domain/ebomArchitectureTypes.ts`
- Create: `data/mockEBOMArchitecture.ts`

- [ ] **Step 1: Add EBOM architecture types**

Create `domain/ebomArchitectureTypes.ts`:

```ts
export type EBOMBaseScope = 'platform' | 'series' | 'structure';

export interface EBOMBase {
  id: string;
  projectId: string;
  scope: EBOMBaseScope;
  seriesId?: string;
  structureId?: string;
  parentBaseId?: string;
  rootItemId: string;
  revision: string;
  status: 'draft' | 'review' | 'released';
}

export type InheritanceState = 'inherited' | 'overridden' | 'local' | 'locked';

export interface EBOMItem {
  id: string;
  baseId: string;
  parentItemId?: string;
  partNumber: string;
  name: string;
  quantity: number;
  unit: string;
  revision: string;
  designMasterPartId?: string;
  sourceItemId?: string;
  sourceBaseId?: string;
  inheritanceState: InheritanceState;
  lockedFields?: Array<keyof EBOMItem>;
}
```

- [ ] **Step 2: Add minimal mock data**

Create `data/mockEBOMArchitecture.ts` with:

- one platform base
- one primary series base inheriting platform base
- two structure bases inheriting series base
- at least one inherited item
- at least one overridden item
- at least one locked field

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add domain/ebomArchitectureTypes.ts data/mockEBOMArchitecture.ts
git commit -m "feat: add ebom architecture domain model"
```

---

## Task 6: EBOM Inheritance Resolver

**Files:**

- Create: `utils/ebomInheritance.ts`
- Test: `tests/ebomInheritance.test.ts`

- [ ] **Step 1: Write resolver tests**

Test cases:

- Structure base inherits from series base.
- Series base inherits from platform base.
- Local item appears in resolved structure base.
- Overridden item replaces source item.
- Locked field preserves local value.

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npx vitest run tests/ebomInheritance.test.ts
```

Expected: fails because resolver does not exist.

- [ ] **Step 3: Implement pure resolver**

Create utility functions:

```ts
export function getInheritanceChain(baseId: string, bases: EBOMBase[]): EBOMBase[];
export function resolveEBOMBase(baseId: string, bases: EBOMBase[], items: EBOMItem[]): EBOMItem[];
export function getOverrideSummary(baseId: string, bases: EBOMBase[], items: EBOMItem[]): OverrideSummary;
```

Implementation constraints:

- No React imports.
- No Zustand imports.
- No mutation of input arrays.
- Resolve by `sourceItemId` when present.
- Preserve local item IDs.

- [ ] **Step 4: Run resolver tests**

Run:

```bash
npx vitest run tests/ebomInheritance.test.ts
```

Expected: tests pass.

- [ ] **Step 5: Run full verification**

Run:

```bash
npx vitest run
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 6: Commit**

```bash
git add utils/ebomInheritance.ts tests/ebomInheritance.test.ts
git commit -m "feat: resolve ebom inheritance"
```

---

## Task 7: MBOM Delta Domain And Store

**Files:**

- Create: `domain/mbomTypes.ts`
- Create: `data/mockMBOMDeltas.ts`
- Create: `stores/useMBOMDeltaStore.ts`
- Test: `tests/mbomDeltaStore.test.ts`

- [ ] **Step 1: Add MBOM types**

Create `domain/mbomTypes.ts`:

```ts
export type MBOMDeltaType =
  | 'add'
  | 'remove'
  | 'replace'
  | 'quantity-change'
  | 'manufacturing-only-material'
  | 'packaging-label-regional';

export interface MBOMDeltaPack {
  id: string;
  projectId: string;
  skuId: string;
  baseStructureId: string;
  name: string;
  status: 'draft' | 'released';
  deltaItemIds: string[];
}

export interface MBOMDeltaItem {
  id: string;
  packId: string;
  type: MBOMDeltaType;
  targetPartNumber?: string;
  newPartNumber?: string;
  quantity?: number;
  reason: string;
}

export interface ReleasedMBOM {
  id: string;
  projectId: string;
  skuId: string;
  sourceBaseId: string;
  sourceDeltaPackIds: string[];
  releasedAt: string;
  revision: string;
}
```

- [ ] **Step 2: Add mock delta data**

Create `data/mockMBOMDeltas.ts` with:

- one SKU delta pack
- one `manufacturing-only-material` item
- one `packaging-label-regional` item
- one `quantity-change` item

- [ ] **Step 3: Write failing store tests**

Test cases:

- `getDeltaPacksBySKU` returns packs for selected SKU.
- `getDeltaItemsBySKU` returns all delta items for selected SKU.
- `groupDeltaItemsByType` groups by exact delta type.

- [ ] **Step 4: Implement store**

Create `stores/useMBOMDeltaStore.ts` with:

```ts
getDeltaPacksBySKU(skuId: string): MBOMDeltaPack[];
getDeltaItemsBySKU(skuId: string): MBOMDeltaItem[];
groupDeltaItemsByType(skuId: string): Partial<Record<MBOMDeltaType, MBOMDeltaItem[]>>;
```

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run tests/mbomDeltaStore.test.ts
npx vitest run
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add domain/mbomTypes.ts data/mockMBOMDeltas.ts stores/useMBOMDeltaStore.ts tests/mbomDeltaStore.test.ts
git commit -m "feat: add sku-first mbom delta store"
```

---

## Task 8: Tooling Subject Domain And Store

**Files:**

- Create: `domain/toolingTypes.ts`
- Create: `data/mockTooling.ts`
- Create: `stores/useToolingStore.ts`
- Test: `tests/toolingStore.test.ts`

- [ ] **Step 1: Add tooling types**

Create `domain/toolingTypes.ts`:

```ts
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
```

- [ ] **Step 2: Add mock tooling data**

Create `data/mockTooling.ts` with:

- at least two design master parts
- one design master part mapping to multiple concrete part numbers
- at least two tooling records
- all required milestone keys: `drawingRelease`, `dfm`, `quotation`, `kickoff`, `t1`

- [ ] **Step 3: Write tests**

Test cases:

- Get tooling by design master part.
- Update milestone status.
- Calculate lead time from Kickoff to T1.
- Return `null` or `undefined` lead time if Kickoff or T1 is missing.

- [ ] **Step 4: Implement store**

Create `stores/useToolingStore.ts`:

```ts
getToolingByDesignMasterPart(designMasterPartId: string): Tooling[];
updateMilestone(toolingId: string, milestoneKey: ToolingMilestoneKey, updates: Partial<ToolingMilestone>): void;
getLeadTimeDays(toolingId: string): number | null;
```

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run tests/toolingStore.test.ts
npx vitest run
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add domain/toolingTypes.ts data/mockTooling.ts stores/useToolingStore.ts tests/toolingStore.test.ts
git commit -m "feat: add tooling subject store"
```

---

## Task 9: Read-Only Phase 1 Workflow Pages

**Files:**

- Create: `pages/EBOMArchitectureWorkspace.tsx`
- Create: `pages/MBOMDeltaConsole.tsx`
- Create: `pages/ToolingHub.tsx`
- Modify: `App.tsx`
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add EBOM Architecture Workspace**

Minimum page behavior:

- Select EBOM base.
- Show inheritance chain.
- Show resolved items.
- Badge items by `inherited`, `overridden`, `local`, `locked`.
- Do not edit BOM tree yet.

- [ ] **Step 2: Add MBOM Delta Console**

Minimum page behavior:

- SKU-first selector.
- Show selected SKU context.
- Show delta packs by SKU.
- Group delta items by type.
- Include placeholder full MBOM preview section, but do not implement full preview yet.

- [ ] **Step 3: Add Tooling Hub**

Minimum page behavior:

- List design master parts.
- Show concrete part numbers for selected design master part.
- Show tooling records.
- Show milestone status.
- Show derived L/T as Kickoff to T1.

- [ ] **Step 4: Wire routes and sidebar**

Add route IDs:

- `ebom-architecture`
- `mbom-delta`
- `tooling`

Recommended labels:

- `EBOM Architecture`
- `MBOM Delta`
- `Tooling Hub`

- [ ] **Step 5: Verify**

Run:

```bash
npx vitest run
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add pages/EBOMArchitectureWorkspace.tsx pages/MBOMDeltaConsole.tsx pages/ToolingHub.tsx App.tsx components/Sidebar.tsx
git commit -m "feat: add phase 1 workflow pages"
```

---

## Task 10: Legacy BOM Adapter

**Files:**

- Create: `utils/legacyBomAdapter.ts`
- Test: `tests/legacyBomAdapter.test.ts`

- [ ] **Step 1: Write adapter tests**

Test cases:

- Converts a flat resolved `EBOMItem[]` into a nested `BOMNode`.
- Preserves quantity, unit, part number, revision, and name.
- Encodes inheritance metadata into `customAttributes`.
- Throws or returns a safe fallback if root item is missing.

- [ ] **Step 2: Implement adapter**

Create:

```ts
import { EBOMItem } from '../domain/ebomArchitectureTypes';
import { BOMNode, ComponentType, LifecycleState } from '../types';

export function toLegacyBOMNode(resolvedItems: EBOMItem[], rootItemId: string): BOMNode {
  // implementation
}
```

Rules:

- Adapter is read-only.
- Do not write back to EBOM stores.
- Default `ComponentType` can be `Assembly` for nodes with children and `Part` for leaves.
- Default lifecycle can be `LifecycleState.Draft`.
- `customAttributes.inheritanceState` should carry inheritance metadata.

- [ ] **Step 3: Verify**

Run:

```bash
npx vitest run tests/legacyBomAdapter.test.ts
npx vitest run
npm run build
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add utils/legacyBomAdapter.ts tests/legacyBomAdapter.test.ts
git commit -m "feat: add ebom legacy adapter"
```

---

## Smallest Safe First Implementation Slice

Implement only Tasks 1-4 first.

This creates:

- product configuration domain types
- product configuration mock data
- product configuration store
- Product Matrix Center page
- route and navigation integration

It does not touch:

- current BOM editor behavior
- current BOM store
- existing BOM mock data
- existing formula engine
- existing CSV import/export
- existing compare logic

## First Slice Acceptance Criteria

- Existing Dashboard opens and compiles.
- Existing BOM Editor opens and compiles.
- New Product Matrix page opens and compiles.
- Product Matrix displays project, series, structures, variation axes, and SKUs.
- Candidate SKU can be activated.
- Active or candidate SKU can be frozen unless suppressed.
- Non-frozen SKU can be suppressed.
- Suppressed SKU does not appear in active SKU selectors.
- `npx vitest run` passes.
- `npm run build` passes.

## Compatibility Strategy

Short term:

- `useBOMStore` remains the owner of legacy BOM state.
- `useProductConfigStore`, `useEBOMArchitectureStore`, `useMBOMDeltaStore`, and `useToolingStore` own new phase 1 state.
- `AppContext` remains a compatibility facade for old pages.
- New pages should import new stores directly.

Medium term:

- `legacyBomAdapter.ts` projects resolved EBOM architecture data into `BOMNode`.
- Existing `BOMTable`, `BOMMatrix`, and `BOMFlatView` can be reused for read-only architecture previews.

Long term:

- Replace legacy BOM editor write paths with EBOM-aware editing.
- Replace current variant-tag matrix with SKU matrix behavior.
- Replace current MBOM auxiliary filter with Base + Delta preview and released MBOM workflows.

## Technical Risks

- `Project` in `types.ts` conflicts with the new project/program concept. Use `ProjectProgram` in phase 1 to avoid breaking existing imports.
- Current `BOMNode` mixes item master, BOM usage, procurement, MBOM auxiliary data, UI expansion state, attachments, and history. Extending it further will make inheritance logic fragile.
- Current compare logic uses part number as identity. EBOM inheritance and MBOM delta impact need stable usage item IDs and source item IDs.
- Current MBOM view is not a true MBOM model. Do not treat `isAuxiliary` as a migration foundation.
- Current matrix view uses variant tags, not valid SKU objects. It should not be incrementally patched into a SKU strategy page.
- Derived L/T must consistently use Kickoff to T1. Avoid storing L/T as an independent editable field unless explicitly needed later.

## Migration Risks

- Old and new mock data can diverge semantically. Align names and high-level project codes, but avoid hard coupling in the first slice.
- Adapter may hide inheritance semantics if it flattens too aggressively. Preserve metadata in `customAttributes` for transitional views.
- Users may confuse legacy `BOM Editor` with new `EBOM Architecture`. Sidebar labels should make the distinction explicit.
- Freezing a SKU is not the same as freezing a Released MBOM. Keep `SKU.status = frozen` separate from `ReleasedMBOM`.
- Tooling must link to `DesignMasterPart`, not directly to concrete part numbers, or shared tooling/color variant logic will be lost.

## Verification Commands

Use these after every task:

```bash
npx vitest run
npm run build
```

Expected:

- All tests pass.
- Build passes.
- Existing bundle-size warning may remain and is not a blocker for this plan.

## Suggested Commit Sequence

1. `feat: add product configuration domain types`
2. `feat: add product configuration mock data`
3. `feat: add product configuration store`
4. `feat: add product matrix center`
5. `feat: add ebom architecture domain model`
6. `feat: resolve ebom inheritance`
7. `feat: add sku-first mbom delta store`
8. `feat: add tooling subject store`
9. `feat: add phase 1 workflow pages`
10. `feat: add ebom legacy adapter`

