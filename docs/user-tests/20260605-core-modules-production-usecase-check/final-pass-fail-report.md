# Core Modules Production Use-Case Check

Date: 2026-06-05

## Scope

Production core:

- BOM Editor
- Part Library
- Tooling Hub

Development Preview:

- Dashboard
- Product Matrix
- EBOM Architecture
- MBOM Delta
- Change Orders / ECO
- Compare Revisions
- Supply Chain
- Settings
- ERP Connect

## Result Summary

- P0: 0 open
- P1: 0 open
- P2: 0 open
- Passed or covered by automated/browser regression: 31 checks

## Evidence

- Structured results: `docs/user-tests/20260605-core-modules-production-usecase-check/results.json`
- Wave 0 discovery: `docs/user-tests/20260605-core-modules-production-wave0/wave0-discovery-and-wave1-plan.md`
- Automated tests:
  - `tests/coreRepository.test.ts`
  - `tests/CoreProductionFlows.test.tsx`
  - `tests/AppNavigation.test.tsx`
  - `tests/RoleUseCases.test.tsx`
- Browser QA:
  - `browser-qa.json`
  - `screenshots/desktop-bom-editor.png`
  - `screenshots/desktop-part-library.png`
  - `screenshots/desktop-tooling-hub.png`
  - `screenshots/desktop-bom-add-flow.png`
  - `screenshots/desktop-part-library-search-sort.png`
  - `screenshots/desktop-tooling-to-part-library.png`
  - `screenshots/narrow-bom-editor.png`
  - `screenshots/narrow-part-library.png`
  - `screenshots/narrow-tooling-hub.png`
  - `screenshots/narrow-bom-add-flow.png`
  - `screenshots/narrow-part-library-search-sort.png`
  - `screenshots/narrow-tooling-to-part-library.png`
- Latest verification:
  - `./node_modules/.bin/vitest run --reporter=verbose`: 20 test files, 150 tests passed
  - `npm run build`: passed
  - `npm run test:core-browser`: passed

## Key Passes

- BOM Editor can add an existing Part Library part to BOM.
- BOM Editor can still add local/custom BOM items.
- BOM duplicate usage under the same parent is blocked with a clear message.
- BOM delete/remove action has confirmation.
- BOM CSV import uses a validation preview and explicit commit step, covered by `tests/CoreProductionFlows.test.tsx`.
- BOM snapshots can be reloaded into the active BOM tree and are covered by `tests/bomStore.test.ts`.
- Part Library duplicate part number creation is blocked.
- Part Library commercial edits remain role-gated.
- Part Library supports supplier search, lifecycle/stock filters, sorting, AVL status, Where Used, Tooling linkage, and audit inspection.
- Part Library exposes Tooling linkage for concrete parts mapped through design master.
- Tooling Hub supports design-master creation, tooling record creation, and milestone status/date/owner/notes/blocker edits.
- Tooling Hub can navigate from mapped concrete parts into filtered Part Library context.
- Tooling milestone updates persist through the shared core repository flow.
- Non-core modules are visibly marked as Development Preview.

## Recommendation

Future refinements can focus on replacing the browser-local durable repository with a remote backend or SQLite service. The core data model, durable repository, role policy, snapshot reload, audit surfaces, browser QA evidence, and primary cross-module relationships are now in place.
