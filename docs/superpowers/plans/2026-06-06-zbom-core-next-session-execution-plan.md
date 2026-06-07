# zBOM Core Next Session Execution Plan

Date: 2026-06-06

Baseline commit: `7fb6901 Integrate production core BOM tooling workflows`

## New Session Goal

Continue improving the three production-core modules:

- `BOM Editor`
- `Part Library`
- `Tooling Hub`

The next session should not expand into other modules. The goal is to make these three modules closer to actual production use by completing user workflow loops, improving data consistency, and tightening frontend operation details.

## Current Baseline

The current system already has:

- Active Project switching from the header.
- Shared core repository context across the three core modules.
- Editable tooling links from `Part Library`.
- A simplified `Tooling Hub` layout with list-first display and a detail panel.
- Cross-module navigation:
  - `Tooling Hub -> Part Library`
  - `Part Library -> Tooling Hub`

Current validation results:

- Full test suite: 153 passed.
- Production build: passed.

## Wave 1: Complete The Three-Module Workflow Loop

Priority: Highest

### 1. Part Library -> BOM Editor

In the `Usage` tab of `Part Library`, add an `Open in BOM Editor` action for each BOM usage row.

After navigation, `BOM Editor` should:

- Open the BOM for the current active project.
- Highlight the target BOM node.
- Optionally expand the parent path.
- Optionally populate the BOM search field with the part number.

Expected user outcome:

- A user inspecting a library part can immediately find where it is used in the BOM.

### 2. BOM Editor -> Part Library

Add an `Open in Part Library` action from the BOM node detail area or row action area.

For a BOM node linked to a library part:

- Navigate to `Part Library`.
- Filter or search directly to the linked part.

For a local-only BOM node:

- Show a clear message:

```text
This BOM item is not linked to a library part yet.
```

Expected user outcome:

- A user reviewing the BOM can immediately inspect the master library record behind a BOM row.

### 3. BOM Editor -> Tooling Hub

For BOM concrete parts that have tooling links, add an `Open Tooling` action.

After navigation, `Tooling Hub` should:

- Open the related tooling detail panel.
- Prefer the `links` tab.
- If one part maps to multiple tooling records, focus or filter the related records.

Expected user outcome:

- A user reviewing a BOM item can immediately inspect its tooling status and linked design master.

## Wave 2: Data Consistency And Refresh

Priority: High

### 1. Add Lightweight Navigation Context

Unify navigation handoff through explicit sessionStorage keys.

Suggested keys:

```text
zbom.bomEditor.partNumber
zbom.bomEditor.nodeId
zbom.partLibrary.search
zbom.toolingHub.toolingId
zbom.toolingHub.designMasterPartId
zbom.toolingHub.tab
```

Guidance:

- Keep this small and explicit.
- Avoid ad hoc key names scattered across modules.
- Remove consumed keys after navigation has applied them.

### 2. Add Store Refresh Mechanisms

Ensure changes made in one core module can be reflected in the others.

Required behavior:

- After `Part Library` edits a tooling link, `Tooling Hub` reads the latest mapping.
- After `BOM Editor` changes BOM/library usage, `Part Library` usage data can refresh.
- After Active Project changes, all three modules stay scoped to the same project.

Implementation guidance:

- Prefer clear `loadFromRepository()` or `refreshFromRepository()` methods.
- Avoid large store rewrites in this wave.

### 3. Add Small Repository Query APIs

Keep existing `replaceLegacy*` compatibility bridge for now, but add narrower APIs for the new workflows.

Suggested APIs:

```ts
getBOMNodeByPartNumber(partNumber: string)
getBOMUsagesForPart(partId: string)
getToolingByConcretePart(partId: string)
getDesignMastersForPart(partId: string)
```

Acceptance:

- APIs respect the active project.
- APIs are covered by `tests/coreRepository.test.ts`.
- Existing behavior remains compatible.

## Wave 3: Production-Level Frontend Details

Priority: Medium

### 1. BOM Editor

Improve operational clarity:

- Highlight a target node after cross-module navigation.
- Show clear states:
  - linked library part
  - local-only item
  - tooling-linked item
- In CSV import preview, show:
  - rows matched to existing Part Library records
  - rows that will become local-only BOM items
  - duplicate or conflicting part numbers

### 2. Part Library

Improve create/edit validation and context visibility.

Validation:

- Duplicate part number.
- MPN conflict warning.
- Missing supplier warning.
- Numeric validation for cost, stock, lead time, MOQ, and SPQ.

Usage tab:

- Show BOM path.
- Show parent.
- Show quantity.
- Show active project context.

Tooling tab:

- Show design master code.
- Show tooling status.
- Show owner.
- Show next milestone.

### 3. Tooling Hub

Keep the simplified UI, but add production filters.

Filters:

- Status.
- Owner.
- Design master.
- Linked part number.

Links tab:

- Show linked part lifecycle.
- Show BOM usage path.
- Show whether the part is currently used in the active BOM.

Milestones tab:

- Keep milestones behind explicit tab entry.
- Do not return to always-visible dense milestone editing.

## Sub-Agent Driven Development Plan

Use these roles in the new session if sub-agents are available.

### Coordinator

Responsibilities:

- Own the overall integration.
- Own repository contract decisions.
- Keep scope limited to the three core modules.
- Run final tests and build.
- Update plan and git status.

### BOM Worker

Responsibilities:

- Implement `BOM Editor` highlighting.
- Implement `BOM Editor` navigation context.
- Add `Open in Part Library`.
- Add `Open Tooling`.
- Add BOM-node use-case tests.

### Part Library Worker

Responsibilities:

- Implement `Usage -> BOM Editor` navigation.
- Improve `Usage` tab data.
- Improve `Tooling` tab data.
- Add validation for create/edit flows.

### Tooling Worker

Responsibilities:

- Implement incoming navigation context for selected tooling/design master/link tab.
- Add simple filters.
- Improve links tab with lifecycle and BOM usage detail.

### QA Worker

Responsibilities:

- Add use-case-driven tests.
- Validate active project scoping.
- Run regression tests.
- Update testing notes if needed.

## Required Tests

### App Navigation Tests

Update `tests/AppNavigation.test.tsx` with:

- `Part Library usage -> BOM Editor highlighted node`
- `BOM Editor node -> Part Library filtered part`
- `BOM Editor tooling-linked node -> Tooling Hub detail`

### Core Production Flow Tests

Update `tests/CoreProductionFlows.test.tsx` with:

- Creating or editing a tooling link is reflected across all three modules.
- Active Project switching does not leak BOM/tooling/library context across projects.
- Local-only BOM items show clear Part Library and Tooling behavior.

### Core Repository Tests

Update `tests/coreRepository.test.ts` with:

- New small query APIs.
- Active project scoping.
- Multiple tooling records for one concrete part.
- No tooling result for unmapped/local-only parts.

## Acceptance Commands

Run these before handoff:

```bash
./node_modules/.bin/vitest run tests/CoreProductionFlows.test.tsx tests/AppNavigation.test.tsx tests/PhaseOneWorkflowPages.test.tsx --reporter=verbose
./node_modules/.bin/vitest run --reporter=verbose
npm run build
```

## New Session Starter Prompt

Use this prompt to start the next development session:

```text
From commit 7fb6901, continue focusing only on the three production-core modules: BOM Editor, Part Library, and Tooling Hub.

Follow Wave 1 -> Wave 2 -> Wave 3.

First complete the three-module frontend workflow loop:
1. Part Library usage -> BOM Editor highlighted node.
2. BOM Editor -> Part Library filtered part.
3. BOM Editor -> Tooling Hub detail or related tooling focus.

Then add lightweight navigation context, refresh hooks, small repository query APIs, and production-level UI details.

Add use-case-driven tests, run focused tests, run the full test suite, run build, update the plan document, and report git status.
```

