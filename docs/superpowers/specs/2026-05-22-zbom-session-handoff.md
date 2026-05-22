# zBOM Session Handoff

Date: 2026-05-22

## Purpose

This document is the handoff note for starting a new session without losing the key business context and technical conclusions already established.

Use this document together with:

- [README.md](/Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/README.md)
- [2026-05-22-zbom-platform-redesign-design.md](/Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/docs/superpowers/specs/2026-05-22-zbom-platform-redesign-design.md)

## What Was Already Done

### Repository status review completed

The current repository was inspected and confirmed to be:

- a runnable frontend prototype
- based on `React + Vite + Zustand + Zod + Recharts`
- currently centered around a single-project BOM workflow
- using mock data for BOM, library, supplier, and ECO content
- not yet connected to a real backend

### Documentation already rewritten

The old generic README was replaced with a system-oriented project introduction that explains:

- current system status
- implemented modules
- actual architectural boundaries
- what is still mock / prototype level

### Validation already completed

The following were verified in this session:

- `npx vitest run` passed
- `npm run build` passed

Observed note:

- build emits a bundle-size warning, but build still succeeds

## Confirmed Business Conclusions

The following points were already discussed and confirmed with the user.

### 1. Target system direction

The system should evolve from a single-project BOM editor into a:

**multi-project product configuration and manufacturing difference management platform**

### 2. EBOM architecture

Confirmed direction:

- use **double-layer inheritance**
- recommended hierarchy:

`Project Platform Base -> Series Base -> Structure Base -> Variation / SKU Delta`

Why:

- work starts by deepening one primary series
- later expands from that series into the second series

### 3. MBOM architecture

Confirmed direction:

- MBOM management should be centered on **material-level differences**
- system should support:
  - typed difference packs
  - fast difference retrieval against a base model
  - frozen full MBOM for key SKUs

Confirmed delta-management model:

- daily truth: `Base + Delta`
- key SKU release truth: `Released MBOM`

### 4. SKU strategy

Confirmed direction:

- hybrid SKU strategy
- generate candidate SKU skeletons from rules
- manually enable, freeze, or suppress actual valid SKUs

### 5. Inheritance strategy

Confirmed direction:

- mixed inheritance behavior
- default auto-inherit
- critical objects or fields can be locked and require manual sync / confirmation

### 6. Tooling strategy

Confirmed direction:

- tooling should be an independent object
- but first phase should still keep it BOM-oriented, not a full standalone tooling PM system
- future upgrade path may connect to external project-management software

### 7. Tooling ownership model

Confirmed direction:

- direct one-tooling-to-one-part-number mapping is not sufficient
- shared tooling and color-derived parts require an intermediate stable object

Confirmed object:

- `Design Master Part`
- also discussed as `Tooling Subject`

This object should sit between structural design and concrete EBOM items.

### 8. Tooling tracking model

Confirmed direction:

Tooling must track both:

- plan
- current state

Confirmed required milestone scope:

- `Drawing Release`
- `DFM`
- `Quotation`
- `Kickoff`
- `L/T`
- `T1`

Confirmed `L/T` definition:

- `Kickoff -> T1`

Recommended tracking pattern already agreed:

- planned date
- current status
- actual completion date

### 9. MBOM main retrieval entry

Confirmed direction:

- default difference retrieval should be **SKU-first**

Meaning:

- user first selects a SKU
- system shows all differences relative to its base model

## Confirmed System Modules

The following module direction was already accepted as the next-stage system shape:

1. `Product Matrix Center`
2. `EBOM Architecture Workspace`
3. `MBOM Delta Console`
4. `Tooling Hub`
5. `Release and Change Control`

## Confirmed First-Phase Priority

The agreed implementation priority is:

1. rebuild domain model
2. build product matrix center
3. build EBOM inheritance workspace
4. build MBOM delta console
5. build tooling base management

Explicitly not first priority:

- ERP integration
- complex approval workflow
- over-polishing UI
- full tooling PM system
- advanced reporting

## Recommended New Core Objects

These should be treated as the future phase-1 domain backbone:

- `Project`
- `Series`
- `Structure`
- `VariationAxis`
- `SKU`
- `EBOMBase`
- `EBOMItem`
- `MBOMDeltaPack`
- `MBOMDeltaItem`
- `ReleasedMBOM`
- `DesignMasterPart`
- `Tooling`

## Current Repository Reality

Important for the next session:

- current store structure is still centered around `useBOMStore`
- current UI is still shaped around one active project and one BOM tree
- current pages do not yet model:
  - multi-project management
  - series / structure hierarchy
  - variation axes
  - SKU generation
  - typed MBOM delta packs
  - tooling subjects

## Suggested Repository Change Direction

The next session should assume the current repository needs structural refactor, not just field extension.

Expected hotspots:

- `types.ts`
- `stores/`
- `data/`
- `pages/BOMEditor.tsx`
- new page creation for:
  - `ProductMatrixCenter`
  - `MBOMDeltaConsole`
  - `ToolingHub`

Current modules that can stay transitional in phase 1:

- `Dashboard`
- `SupplyChain`
- `ECOManager`

## Suggested Next Session Goal

Recommended goal for the next session:

**Do implementation planning only. Do not start broad code changes immediately.**

That planning session should:

1. convert the redesign conclusions into a structured implementation plan
2. break work into stores, types, mock data, and page-level tasks
3. identify first minimal vertical slice
4. define migration strategy from current `useBOMStore` to multi-store model

## Minimal Vertical Slice Recommendation

If the next session wants a recommended first implementation slice, use this:

1. add new domain types for `Project`, `Series`, `Structure`, `VariationAxis`, `SKU`
2. create `ProductMatrixCenter`
3. add minimal mock data for one project, one primary series, two structures
4. keep current BOM editor running in compatibility mode
5. only after that start building EBOM inheritance logic

## Key Rule For The Next Session

Do not treat this as a UI enhancement task.

Treat it as:

**domain-model redesign first, workflow redesign second, UI adaptation third**
