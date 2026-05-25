# zBOM EBOM/MBOM User-Testable Workflow Handoff

Date: 2026-05-25

## Purpose

This handoff captures the completed EBOM/MBOM user-testable workflow implementation, verification evidence, local-only Feishu real-data sampling status, and recommended next steps.

Use this together with:

- `docs/superpowers/plans/2026-05-24-zbom-ebom-mbom-user-testable-workflow.md`
- `docs/user-tests/2026-05-24-ebom-mbom-trial-script.md`
- `docs/superpowers/specs/2026-05-24-zbom-editable-ebom-architecture-handoff.md`

## Current Repository State

Primary checkout:

```text
/Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM
```

Current branch:

```text
main
```

Current HEAD before this handoff:

```text
f09332b docs: refine ebom mbom trial notes
```

Working tree status before this handoff:

```text
Only unrelated untracked directories remain:
?? .superpowers/
?? graphify-out/
```

Important local-only data note:

```text
.agent/real-data/* is ignored by git and contains local Feishu sampling artifacts.
Do not commit those files.
Do not copy real Feishu row values into source, tests, committed docs, or commit messages.
```

## Completed Scope

The implementation plan in `docs/superpowers/plans/2026-05-24-zbom-ebom-mbom-user-testable-workflow.md` is complete.

Completed tasks:

1. Added shared workflow SKU context to the Product Config store.
2. Expanded synthetic EBOM/MBOM trial seed data.
3. Added pure MBOM composition utility and composed-row domain types.
4. Exposed composed MBOM preview selector from the MBOM delta store.
5. Added Product Matrix UI control to select the shared workflow SKU.
6. Scoped EBOM Architecture Workspace to the selected workflow SKU context.
7. Replaced MBOM full-preview placeholder with a composed base-plus-delta preview table.
8. Added cross-page user-test path coverage.
9. Added manual EBOM/MBOM user trial script.
10. Confirmed optional real Feishu data remains local-only under ignored paths.
11. Completed final verification.

## User-Testable Workflow Now Supported

Representative user path:

```text
Product Matrix -> select workflow SKU
EBOM Architecture -> inspect selected SKU context and matching structure EBOM base
EBOM Architecture -> edit inherited item and publish change package
MBOM Delta -> inspect same SKU delta packs
MBOM Delta -> inspect composed base-plus-delta MBOM preview
```

The cross-page test covers:

```text
Product Matrix SKU selection -> Pro EBOM context -> EBOM draft publish -> MBOM preview with same SKU and published quantity
```

## Key Implementation Notes

### Shared Product Workflow Context

Updated:

```text
domain/productTypes.ts
stores/useProductConfigStore.ts
pages/ProductMatrixCenter.tsx
tests/productConfigStore.test.ts
tests/ProductMatrixCenter.test.tsx
```

Behavior:

- `selectedWorkflowSKUId` tracks the SKU under review.
- `selectWorkflowSKU(skuId)` ignores unknown SKU IDs.
- `getSelectedWorkflowSKUContext()` resolves SKU, project, series, and structure.
- If the selected SKU is outside the active project, the selector falls back to the first SKU in the active project.
- Product Matrix rows now include `Select for Workflow` and a compact `Selected` badge.

### Synthetic Trial Data

Updated:

```text
data/mockProductConfig.ts
data/mockEBOMArchitecture.ts
data/mockMBOMDeltas.ts
tests/productConfigStore.test.ts
tests/mbomDeltaStore.test.ts
tests/ebomArchitectureStore.test.ts
```

Behavior:

- Synthetic SKU data now covers active, candidate, suppressed, and frozen statuses across multiple structures.
- Added an active Pro SKU for MBOM preview testing.
- Added Standard EBOM packaging label and chassis screw targets.
- Added MBOM delta coverage for:
  - `add`
  - `remove`
  - `replace`
  - `quantity-change`
  - `manufacturing-only-material`
  - `packaging-label-regional`
- Existing inheritance fixtures were preserved.

### MBOM Composition

Added/updated:

```text
domain/mbomTypes.ts
utils/mbomComposition.ts
stores/useMBOMDeltaStore.ts
tests/mbomComposition.test.ts
tests/mbomDeltaStore.test.ts
```

Behavior:

- `composeMBOMPreview(baseItems, deltaItems)` is pure and deterministic.
- Base EBOM rows become composed rows with `source: "base"`.
- Delta rows use source markers:
  - `delta-add`
  - `delta-remove`
  - `delta-replace`
  - `quantity-change`
  - `manufacturing-only`
  - `packaging-label-regional`
- Unknown target parts produce warning rows instead of crashing.
- Later deltas can still target the original EBOM part after a replace/packaging delta changes the displayed part number.
- Warning rows are excluded from target matching so repeated missing-target deltas remain independent.

### EBOM Architecture Workspace Context

Updated:

```text
pages/EBOMArchitectureWorkspace.tsx
tests/PhaseOneWorkflowPages.test.tsx
```

Behavior:

- The page reads `getSelectedWorkflowSKUContext()`.
- After EBOM load, the page selects the matching structure EBOM base for the selected workflow SKU.
- Manual EBOM base dropdown selection is not overwritten after initial SKU sync unless the selected workflow SKU changes.
- Context strip shows project, series, structure, SKU/status, and EBOM base ID.

### MBOM Delta Console Preview

Updated:

```text
pages/MBOMDeltaConsole.tsx
tests/PhaseOneWorkflowPages.test.tsx
```

Behavior:

- SKU dropdown writes through `selectWorkflowSKU()`.
- MBOM page uses the shared selected SKU context.
- EBOM store is loaded if needed.
- Matching structure EBOM base is resolved with `resolveEBOMBase()`.
- `getComposedMBOMPreview({ skuId, baseItems })` drives the composed preview table.
- Delta packs remain visible if EBOM preview resolution fails.
- The old placeholder text was removed.

Preview table columns:

```text
Part Number
Name
Qty
Source
Target Part
Reason / Warning
```

User-facing source labels:

```text
base
delta add
delta remove
delta replace
quantity change
manufacturing only
packaging/label/regional
```

### Manual Trial Script

Added:

```text
docs/user-tests/2026-05-24-ebom-mbom-trial-script.md
```

The script covers:

- Standard SKU selection.
- EBOM inherited / overridden / local / locked states.
- EBOM quantity edit and publish.
- MBOM delta pack inspection.
- Composed MBOM preview review.
- Pro SKU comparison.
- Observer notes for expected behavior, actual behavior, blockers, confusing or missing terminology, and follow-up questions.

## Real Feishu Data Sampling Status

User-provided source:

```text
https://orka.feishu.cn/wiki/OxoCw7rfZi4FTTk42vZc7lXhntd?table=tblYVia8cz3ge6s5&view=vew7timWwM
```

Resolved locally:

```text
title: [Whisper]BOM Management
obj_type: bitable
obj_token: LtPabgvvqaxHvvs31qdcDJljnYg
wiki node: OxoCw7rfZi4FTTk42vZc7lXhntd
table id: tblYVia8cz3ge6s5
view id: vew7timWwM
```

Local ignored files created under `.agent/real-data/`:

```text
README.md
commands.md
field-map.md
fields.json
manual-test-notes.md
sample-records.json
sample-records-flags-offset20.json
sample-records-identifiers.json
sample-summary.json
sample-summary-offset20.json
sample-summary-combined.json
wiki-node.json
```

Safety checks completed:

```bash
git check-ignore .agent/real-data/wiki-node.json .agent/real-data/fields.json .agent/real-data/sample-records.json .agent/real-data/sample-summary-combined.json .agent/real-data/field-map.md .agent/real-data/manual-test-notes.md
```

Result:

```text
All checked .agent/real-data files are ignored.
```

Repository status after local real-data sampling:

```text
?? .superpowers/
?? graphify-out/
```

No `.agent/real-data/*` files appear in git status.

### Field Findings

Relevant fields in the Feishu Base include:

```text
Audio Frame                 checkbox
Hearing Frame               checkbox
Part No.                    text
BOM Part ID                 text
ICT Part Number (DVT)       text
ICT Part Number (PVT)       text
Part Name (English)         text
Part Name (Chinese)         text
Qty.                        number
Unit                        select
Part Type                   select
Module                      select
Parent Component            link
Supplier                    select
```

Model flag interpretation:

```text
Audio Frame = one model usage flag
Hearing Frame = one model usage flag
Checked = item is used in that model
Unchecked = item is not used in that model
```

### Sample Summary

Local summary source:

```text
.agent/real-data/sample-summary-combined.json
```

Observed target view sample:

```text
sample size: 23 rows
has more after second page: false
Audio Frame checked: 22 / 23
Hearing Frame checked: 22 / 23
both checked: 22 / 23
Audio-only: 0 / 23
Hearing-only: 0 / 23
neither checked: 1 / 23
```

Important implications:

- The target view currently looks more useful for common/shared item validation than for Audio-only vs Hearing-only difference validation.
- No Audio-only or Hearing-only rows were found in the sampled target view.
- One row has neither model flag checked; this needs product/data interpretation.
- `Part No.` was empty in the first 20 sampled rows.
- Further confirmation is needed to decide whether canonical item identity should come from `BOM Part ID`, `ICT Part Number (DVT)`, `ICT Part Number (PVT)`, or another field.

### Network / CLI Notes

The first attempt failed because the sandbox could not access the local keychain. Running `lark-cli` with elevated permissions fixed keychain access.

Some Feishu API reads intermittently failed with:

```text
connection reset by peer
```

Successful reads:

```text
Wiki node resolution
Field structure
First 20-row projected sample
Offset 20 model-flag sample
```

Failed repeated read:

```text
Candidate identifier field sample with broader projections
```

The local file `.agent/real-data/commands.md` contains safe read commands for retrying when the network is stable.

## Commits

Plan and implementation commits in this batch:

```text
031587d docs: add ebom mbom user test workflow plan
4635791 feat: add shared workflow sku context
2b60e75 test: expand ebom mbom trial seed data
c5bf65e feat: compose mbom preview rows
16972a9 fix: preserve original mbom delta targets
a151542 fix: keep mbom warning rows independent
a152c4f feat: expose composed mbom preview selector
a6712c1 feat: select workflow sku from product matrix
dd89916 test: align ebom store seed expectations
ca2bc19 feat: scope ebom workspace to selected sku
393c397 feat: preview composed mbom by selected sku
350805e fix: update mbom preview header copy
8f9d399 test: cover ebom mbom user test path
850e20f docs: add ebom mbom trial script
f09332b docs: refine ebom mbom trial notes
```

## Verification Completed

Focused verification:

```bash
npx vitest run tests/productConfigStore.test.ts tests/mbomComposition.test.ts tests/mbomDeltaStore.test.ts tests/ProductMatrixCenter.test.tsx tests/PhaseOneWorkflowPages.test.tsx tests/AppNavigation.test.tsx
```

Result:

```text
6 test files passed
49 tests passed
```

Full test suite:

```bash
npx vitest run
```

Result:

```text
17 test files passed
117 tests passed
```

Production build:

```bash
npm run build
```

Result:

```text
passed
```

Known non-blocking warnings:

```text
Vitest emits Node localStorage experimental warnings in jsdom-related tests.
tests/AppNavigation.test.tsx emits existing Recharts chart-size warnings under jsdom.
npm run build emits a Vite chunk-size warning for the main JS bundle.
npm run build emits a Node DEP0205 module.register deprecation warning.
```

## Recommended Next Steps

### 1. Run Manual Trial With Current App

Use:

```text
docs/user-tests/2026-05-24-ebom-mbom-trial-script.md
```

Start with synthetic app data and use real Feishu data as local-only comparison context.

Recommended first real-data interpretation:

```text
Treat the current target view as common/shared model-item validation because sampled rows do not contain Audio-only or Hearing-only differences.
```

### 2. Clarify Feishu Data Semantics Before Code Changes

Before changing domain logic, answer:

- Is the target view intentionally scoped to common/shared items?
- What does the neither-checked row mean?
  - suppressed item?
  - candidate item?
  - out-of-scope item?
  - data-quality exception?
- Which field is the canonical part identifier?
  - `BOM Part ID`
  - `ICT Part Number (DVT)`
  - `ICT Part Number (PVT)`
  - `Part No.`
  - another field?
- Do `Audio Frame` and `Hearing Frame` map to SKU, Structure, or a separate model dimension?
- Which fields distinguish engineering EBOM items from manufacturing-only MBOM materials?

### 3. Retry Identifier Sampling

When Feishu network access is stable, retry the commands in:

```text
.agent/real-data/commands.md
```

Suggested next read should project:

```text
Audio Frame
Hearing Frame
BOM Part ID
ICT Part Number (DVT)
ICT Part Number (PVT)
Part No.
Part Name (English)
Qty.
Part Type
Module
```

Keep output under:

```text
.agent/real-data/
```

Do not commit it.

### 4. Defer Release/Backend/Tooling Work

Continue to defer:

- Release and Change Control.
- `useReleaseStore`.
- Frozen ReleasedMBOM snapshot workflow.
- Tooling risk dashboard expansion.
- Backend persistence.
- ERP, approval workflow, or external integrations.

Those areas should not start until the EBOM/MBOM real-user workflow and data semantics are understood.

