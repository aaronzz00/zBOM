# zBOM Core Usability Integration Plan

Date: 2026-06-06

## Current Assessment

The previous production-integration session moved the system beyond a pure frontend mock:

- `repositories/core` now provides a localStorage-backed durable core repository.
- `BOM Editor`, `Part Library`, and `Tooling Hub` have partial repository integration.
- Non-core modules are grouped as `Development Preview`.
- Core production flow tests and build pass.

However, the current implementation is still not ready for confident daily use because the user-facing workflow is incomplete:

1. `Active Project` is visible in the header but cannot be changed.
2. Part-to-tooling links are visible but not editable from normal user workflows.
3. `Tooling Hub` exposes too much detail at once and should be simplified to a Part Library-like list/detail pattern.
4. The three core modules are technically connected through `coreRepository`, but the product-level data flow is still incomplete and sometimes relies on whole-state `replaceLegacy*` compatibility writes.

## Desired Short-Term Outcome

Create an internal-use-ready core workspace where users can:

- Switch the active project from the header.
- See `BOM Editor`, `Part Library`, and `Tooling Hub` update to the same active project context.
- Add/link parts across BOM and Part Library.
- Edit tooling links between design-master parts and concrete Part Library parts.
- Use a simplified Tooling Hub surface without being overwhelmed by milestone form fields.
- Keep all non-core modules visibly outside the production-core test scope.

## P0 Tasks

- [x] Implement real `Active Project` state in the core workspace.
- [x] Add an actual Header project selector.
- [x] Make `BOM Editor`, `Part Library`, and `Tooling Hub` read from the same active project context.
- [x] Add tests proving project switching changes the header and core module context.

## P1 Tasks

- [x] Add editable tooling links:
  - map concrete Part Library parts to design-master parts
  - remove mappings
  - show save/status feedback
  - preserve audit trail
- [x] Add cross-module navigation:
  - Tooling Hub -> Part Library selected part
  - Part Library -> Tooling Hub selected tooling context
  - Tooling Hub shows BOM usage count for linked concrete parts
- [x] Simplify `Tooling Hub`:
  - list/table first
  - detail panel second
  - milestones collapsed by default
  - editing through explicit controls

## P2 Tasks

- [ ] Reduce `replaceLegacy*` writes after P0/P1 are stable.
- [ ] Add a complete granular use-case QA folder under `docs/user-tests/`.
- [ ] Update `README.md` and `docs/testing-guide.md` after implementation.
- [ ] Add BOM-node focused navigation from Part Library usage entries into a filtered/highlighted BOM Editor context.

## Execution Status

Completed in this wave:

- Active Project is now switchable from the header and scopes the core repository projection.
- The seed workspace contains a second project so project switching can be verified against visibly different BOM/tooling data.
- Tooling links can be edited from Part Library through design-master to concrete-part mappings.
- Tooling Hub now uses a simpler list-first layout with details, links, and milestones in explicit tabs.
- Cross-module navigation is bidirectional for the core tooling loop:
  - Tooling Hub linked part -> Part Library filtered part
  - Part Library tooling link -> Tooling Hub selected detail panel

Sub-agent note:

- Planned sub-agent split was attempted, but both available sub-agent streams disconnected before completion. Implementation and verification were completed in the main coordinator thread to avoid blocking the delivery.

Validation completed:

```bash
./node_modules/.bin/vitest run tests/CoreProductionFlows.test.tsx tests/AppNavigation.test.tsx tests/PhaseOneWorkflowPages.test.tsx --reporter=verbose
./node_modules/.bin/vitest run --reporter=verbose
npm run build
```

Latest results:

- Focused core/use-case tests: 32 passed.
- Full test suite: 153 passed.
- Production build: passed.

## Sub-Agent Split

- Main coordinator:
  - owns active project context, repository changes, final integration, and verification.
- `tooling-hub-ui-worker`:
  - owns `pages/ToolingHub.tsx` and Tooling Hub UI tests.
- `core-context-explorer`:
  - provides read-only findings on current project/context/data-flow gaps.

## Acceptance Gates

Run before handoff:

```bash
./node_modules/.bin/vitest run tests/CoreProductionFlows.test.tsx tests/AppNavigation.test.tsx --reporter=verbose
./node_modules/.bin/vitest run --reporter=verbose
npm run build
```

Manual/browser QA after implementation should cover:

- Switch active project.
- Add a library part to BOM.
- Open the part in Part Library and inspect usage.
- Edit tooling links for the part.
- Open Tooling Hub and confirm the same link appears.
- Update a tooling milestone from the simplified detail panel.
