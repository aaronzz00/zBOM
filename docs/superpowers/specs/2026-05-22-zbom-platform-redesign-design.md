# zBOM Platform Redesign Design

Date: 2026-05-22

## 1. Background

The current `zBOM` repository is a runnable frontend prototype centered around a single-project BOM workspace. It already demonstrates:

- BOM editing
- BOM compare
- part library
- supply chain views
- ECO management
- role-based visibility
- AI-assisted analysis

However, the target usage has moved beyond a single-project BOM editor. The next-stage system needs to support:

1. Multiple projects with both `Engineering BOM` and `Manufacturing BOM`
2. A core project containing:
   - 2 product series with common architecture
   - 2 structures under each series
   - multiple variations under each structure
   - hundreds of final SKUs
3. MBOM management centered on fast difference retrieval against a base model
4. Tooling management for development-phase critical items, including:
   - drawing release timing
   - DFM status
   - quotation status
   - tooling kickoff plan
   - lead time
   - T1 timing
   - cavity count

This document captures the outcome of the brainstorming session and defines the recommended target direction for the next system phase.

## 2. Key Design Conclusions

### 2.1 Overall strategy

The system should evolve from a single-project BOM editor into a **multi-project product configuration and manufacturing difference management platform**.

The recommended redesign path is:

- do not keep extending the current single-BOM model with more fields
- rebuild the core domain model first
- then progressively rebuild key workflows and pages on top of that new model

### 2.2 Product structure model

The core project should use a **double-layer inheritance architecture**.

Recommended hierarchy:

`Project Platform Base -> Series Base -> Structure Base -> Variation / SKU Delta`

Rationale:

- the real project evolves by focusing first on one primary series
- that primary series becomes the foundation for expansion into the second series
- a pure structure-only model would duplicate cross-series common logic
- a pure series-only model would blur structure-specific changes
- double-layer inheritance matches the actual engineering expansion path

### 2.3 EBOM strategy

EBOM should be maintained primarily as a **base-and-inheritance model** rather than as full SKU-specific BOMs.

Recommended behavior:

- maintain reusable base EBOM at series and structure levels
- allow lower-level objects to inherit by default
- allow locked objects or locked fields to opt out of automatic inheritance
- allow inherited items to be overridden explicitly

Inheritance policy:

- default mode: auto inherit
- exceptions: lock and require manual review

### 2.4 MBOM strategy

MBOM should be managed primarily through **typed delta packs** relative to a base model.

Daily truth:

`Base + Delta`

Not recommended:

- maintaining a full MBOM as the primary editable truth for every SKU

Recommended delta types:

- add
- remove
- replace
- quantity change
- manufacturing-only material
- packaging / label / regional item

For release and audit needs, the system should also support **frozen full MBOM outputs** for selected key SKUs.

### 2.5 SKU strategy

SKU management should follow a **hybrid rule-driven model**.

Recommended behavior:

- generate candidate SKU skeletons from variation rules
- then manually enable, freeze, or suppress actual valid SKUs
- not every theoretical combination must become an active SKU

This avoids exploding maintenance costs while preserving full matrix visibility.

### 2.6 Tooling strategy

Tooling should be represented as an **independent domain object**, but in the near term it should still serve the BOM-centric workflow rather than becoming a separate full project-management system.

Recommended direction:

- independent `Tooling` object
- independent `Tooling Subject` / `Design Master Part`
- keep the design open so tooling can later be integrated with external project-management tools

### 2.7 Tooling ownership model

A direct one-tooling-to-one-part-number model is not sufficient, because:

- multiple distinct part numbers may share one tooling set
- color-derived part variants often do not need separate tooling management

Therefore the recommended design adds a stable intermediate object:

- `Design Master Part`
- also described in discussion as `Tooling Subject`

This object sits between structure-level design and concrete EBOM usage items. Tooling should be attached primarily to this object.

## 3. Target Domain Model

The redesigned system should introduce the following core entities:

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

### 3.1 Entity intent

#### Project

Container for one managed product program.

#### Series

Represents a family of products sharing common architecture.

#### Structure

Represents a structural base under a series. This is one of the primary base layers for both EBOM and MBOM.

#### VariationAxis

Represents a variation dimension, such as:

- appearance
- software
- region
- packaging
- custom business dimension

#### SKU

Represents an actual or candidate commercial/manufacturing configuration derived from variation axes and structure.

#### EBOMBase

Represents base engineering BOM data at series or structure scope.

#### EBOMItem

Represents an engineering BOM usage item inside an EBOM base tree.

#### MBOMDeltaPack

Represents a package of manufacturing differences relative to a base model.

#### MBOMDeltaItem

Represents one typed manufacturing difference entry.

#### ReleasedMBOM

Represents a frozen, auditable MBOM snapshot for a selected SKU.

#### DesignMasterPart

Represents the stable design-mother object used to manage:

- shared tooling
- common-mold logic
- non-tooling-tracked derived items
- mapping between design intent and multiple concrete part numbers

#### Tooling

Represents one managed tooling object with planning and execution milestones.

## 4. Recommended System Modules

The next-stage system should add or reshape the following modules.

### 4.1 Product Matrix Center

New top-level module.

Purpose:

- manage project / series / structure / variation / SKU relationships
- display the product matrix
- distinguish generated candidates from active SKUs
- support initial generation plus manual activation or freezing

### 4.2 EBOM Architecture Workspace

Upgrade of the current BOM editing area.

Purpose:

- maintain series-level and structure-level base EBOM
- visualize inheritance source and override state
- manage locked versus auto-inherited nodes
- link engineering items to `DesignMasterPart`

### 4.3 MBOM Delta Console

New core operational module.

Purpose:

- use SKU as the default entry point
- show all differences relative to the selected base model
- group and filter differences by type
- support quick expansion into a full MBOM preview

### 4.4 Tooling Hub

New dedicated module.

Purpose:

- manage tooling objects and their milestone status
- track schedule versus actual completion
- show impact range across structures, design subjects, and SKUs

### 4.5 Release and Change Control

New release-focused control module.

Purpose:

- freeze `ReleasedMBOM`
- track source base and delta composition
- assess impact of base changes on released versions
- support future ECO and external process integration

## 5. Core Workflow Design

### 5.1 Project initialization

Recommended startup flow:

1. Create a project
2. Create the two series
3. Mark one series as the primary working series
4. Create two structures under the primary series
5. Define variation axes
6. Establish series-level and structure-level EBOM bases

The initial goal is to establish the inheritance skeleton, not to populate all SKU variants immediately.

### 5.2 Primary series deepening

The early program focus should stay on one primary series.

Engineering side should:

- mature the series-level base
- mature two structure-level bases
- identify critical `DesignMasterPart` subjects
- attach tooling subjects where needed

Manufacturing side should:

- establish initial structure-level manufacturing differences
- define packaging / regional / label rules as delta
- avoid generating full MBOM for every SKU too early

### 5.3 SKU generation and convergence

Recommended SKU flow:

1. System generates candidate SKUs from variation combinations
2. User marks valid SKUs as active
3. User adds special delta only where needed
4. Key SKUs can be expanded and frozen as `ReleasedMBOM`

### 5.4 Expansion to the second series

Second-series buildout should be expansion-based, not rebuilt from scratch.

Recommended flow:

1. Copy reusable series logic from the primary series
2. copy structure skeletons
3. retain reusable base
4. create new overrides only where series differentiation is real
5. review `DesignMasterPart` reuse and split points
6. regenerate candidate SKU matrix for the second series

### 5.5 MBOM daily operation

Default operational path should be:

1. User selects a SKU
2. System identifies the related base structure
3. System shows all delta relative to that base
4. User filters by delta type
5. User expands to full MBOM only when needed

### 5.6 Tooling daily operation

Recommended path:

1. Select a `DesignMasterPart`
2. Open associated tooling record(s)
3. Track:
   - drawing release
   - DFM
   - quotation
   - kickoff
   - lead time
   - T1
4. Review affected structures, engineering items, and SKU scope

### 5.7 Release and impact control

When a base or delta changes, the system should not simply show a change. It should also calculate impact.

Recommended impact outputs:

- affected structures
- affected SKUs
- affected released MBOMs
- objects requiring manual confirmation because they are locked

## 6. Tooling Management Model

### 6.1 Why tooling needs milestone modeling

The tooling workflow needs to track both:

- plan
- actual status

It is not enough to use a single stage field.

The user specifically needs visibility into:

- drawing release timing
- kickoff timing
- lead time
- T1 timing
- DFM done state
- quotation done state

### 6.2 Recommended tooling milestone structure

For first phase, tooling should track these core milestones:

- `Drawing Release`
- `DFM`
- `Quotation`
- `Kickoff`
- `L/T`
- `T1`

`L/T` is explicitly defined as:

`Kickoff -> T1`

### 6.3 Recommended tooling data pattern

Each major milestone should support:

- planned date
- current status
- actual completion date

Recommended logic:

- keep milestone statuses independent
- derive an `overallStatus` for dashboard and filtering use
- do not use `overallStatus` as the only source of truth

## 7. Four-Line Control Model

The future system will manage four parallel but connected lines:

- `Inheritance`
- `Delta`
- `Released`
- `Tooling`

Recommended control rule:

- `Base defines`
- `Delta modifies`
- `Release freezes`
- `Tooling gates`

### 7.1 Inheritance

Defines the default structure.

### 7.2 Delta

Defines the deviation from the default inherited structure.

### 7.3 Released

Represents a frozen snapshot and must not drift with future inheritance changes.

### 7.4 Tooling

Does not redefine BOM content directly, but affects readiness and risk.

### 7.5 Distortion to avoid

The system should explicitly prevent:

1. editing full SKU BOM outside delta logic
2. letting released versions drift with later base changes
3. separating tooling status from affected design and SKU scope

## 8. First-Phase Prioritization

### 8.1 Must-do first

Recommended first-phase sequence:

1. rebuild domain model
2. add product matrix center
3. add EBOM inheritance workspace
4. add MBOM delta console
5. add tooling base management

### 8.2 Do not prioritize early

The following should be intentionally postponed:

- complex approval workflow
- ERP integration
- external system integration
- visual polish-first work
- full tooling project-management transformation
- advanced reporting center

## 9. First-Phase Implementation Packages

### Package 1: domain model and store refactor

Introduce new domain types and split store responsibilities.

Recommended future store split:

- `useProjectStore`
- `useConfigurationStore`
- `useEBOMStore`
- `useMBOMStore`
- `useToolingStore`
- `useReleaseStore`

### Package 2: product matrix center

Create a new page that allows:

- project / series / structure navigation
- variation axis viewing
- candidate SKU generation
- active SKU activation and freezing

### Package 3: EBOM inheritance workspace

Upgrade the BOM editor into a base-management workspace focused on:

- series base
- structure base
- inheritance expansion
- overrides
- lock state

### Package 4: MBOM delta console and tooling base management

Add:

- delta entry and filtering
- SKU-first difference retrieval
- full MBOM preview expansion
- tooling subject and tooling management

## 10. Minimum First-Phase Data Fields

This is the minimum field set recommended for phase 1.

### 10.1 Project

- `id`
- `code`
- `name`
- `status`
- `primarySeriesId`
- `owner`
- `description`

### 10.2 Series

- `id`
- `projectId`
- `code`
- `name`
- `status`
- `sequence`
- `notes`

### 10.3 Structure

- `id`
- `projectId`
- `seriesId`
- `code`
- `name`
- `status`
- `baseStructureId`
- `notes`

### 10.4 VariationAxis

- `id`
- `projectId`
- `key`
- `name`
- `type`
- `values`
- `active`

Suggested initial `type` values:

- `appearance`
- `software`
- `region`
- `packaging`
- `custom`

### 10.5 SKU

- `id`
- `projectId`
- `seriesId`
- `structureId`
- `skuCode`
- `status`
- `axisSelections`
- `isGenerated`
- `enabled`
- `releasedMbomId`

### 10.6 EBOMBase

- `id`
- `projectId`
- `scopeType`
- `scopeId`
- `parentEbomBaseId`
- `revision`
- `syncMode`
- `status`
- `rootNodeId`

Suggested initial `scopeType`:

- `series`
- `structure`

Suggested initial `syncMode`:

- `auto`
- `locked`
- `manual-review`

### 10.7 EBOMItem

- `id`
- `ebomBaseId`
- `parentItemId`
- `partNumber`
- `name`
- `description`
- `revision`
- `quantity`
- `unit`
- `itemType`
- `inheritanceState`
- `designMasterPartId`

Suggested initial `inheritanceState`:

- `inherited`
- `overridden`
- `local`
- `locked`

### 10.8 DesignMasterPart

- `id`
- `projectId`
- `seriesId`
- `structureId`
- `code`
- `name`
- `category`
- `status`
- `toolingStrategy`
- `notes`

Suggested initial `toolingStrategy`:

- `managed`
- `inherit-only`
- `no-tooling-tracking`

### 10.9 Tooling

- `id`
- `projectId`
- `subjectId`
- `toolingCode`
- `toolingType`
- `supplierId`
- `owner`
- `status`
- `drawingStatus`
- `drawingReleasePlanDate`
- `drawingReleasedAt`
- `dfmStatus`
- `dfmDoneAt`
- `quotationStatus`
- `quotationDoneAt`
- `kickoffStatus`
- `kickoffPlanDate`
- `kickoffAt`
- `ltPlannedDays` or `ltPlannedWeeks`
- `t1Status`
- `t1PlanDate`
- `t1At`
- `cavityCount`
- `targetSopDate`
- `notes`

### 10.10 MBOMDeltaPack

- `id`
- `projectId`
- `baseScopeType`
- `baseScopeId`
- `targetScopeType`
- `targetScopeId`
- `name`
- `status`
- `description`

Suggested initial `baseScopeType`:

- `structure`
- `sku`

Suggested initial `targetScopeType`:

- `variation`
- `sku`

### 10.11 MBOMDeltaItem

- `id`
- `deltaPackId`
- `changeType`
- `targetPartNumber`
- `replacementPartNumber`
- `oldQuantity`
- `newQuantity`
- `reason`
- `effectiveAxes`

Suggested initial `changeType`:

- `add`
- `remove`
- `replace`
- `qty-change`
- `mfg-only`
- `pack-region`

### 10.12 ReleasedMBOM

- `id`
- `projectId`
- `skuId`
- `sourceEbomBaseId`
- `sourceDeltaPackIds`
- `revision`
- `status`
- `frozenAt`
- `frozenBy`

## 11. Default UX Recommendations

### 11.1 MBOM difference console

Default entry point should be **SKU-first**.

Recommended behavior:

- select SKU
- automatically resolve related base structure
- show all differences relative to base
- group by difference type
- allow one-click full MBOM expansion

### 11.2 Tooling hub home

Recommended homepage elements:

- project / series / structure / subject filters
- risk summary cards
- milestone-aware tooling table
- right-side detail drawer

Core priority:

- plan versus actual visibility
- impact visibility
- at-risk prioritization

## 12. Recommendation for the Current Repository

The current repository should not try to directly stretch the existing single-store and single-tree BOM model into the new system.

Recommended repository-level direction:

1. refactor domain types first
2. split store responsibilities
3. reorganize mock data to project / series / structure / SKU shape
4. add `ProductMatrixCenter`
5. reshape current `BOMEditor` into `EBOM Architecture Workspace`
6. add `MBOMDeltaConsole`
7. add `ToolingHub`

The current modules below can remain in placeholder or transitional form during phase 1:

- `Dashboard`
- `SupplyChain`
- `ECOManager`

They should be adapted after the core product configuration model stabilizes.

## 13. Final Recommendation

The correct next step for zBOM is not incremental feature stacking on the current single-project BOM editor. The correct next step is a controlled platform redesign with:

- double-layer inheritance for EBOM
- typed delta management for MBOM
- hybrid SKU generation plus manual convergence
- independent tooling objects
- a stable intermediate `DesignMasterPart / Tooling Subject`
- frozen released MBOM output for key SKUs

This approach best matches the target operational reality:

- one primary series deepened first
- second series expanded from the first
- many derived SKUs
- MBOM value concentrated in fast difference retrieval
- tooling value concentrated in milestone planning and execution tracking

This design is also the safest bridge from the current prototype into a future production-grade platform.
