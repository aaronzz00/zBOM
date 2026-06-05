# zBOM Role Use-Case Hardening Sub-Agent Modification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not implement multiple agents' file scopes in the same pass unless the coordinator explicitly merges scopes.

**Goal:** Convert the two frontend audit rounds into a role-correct, user-testable frontend: Viewer is truly read-only, Sourcing can complete commercial work, Engineer can perform technical review/edit paths, Admin has real management entry points, and normal role testing is not polluted by demo/QA chrome.

**Primary Evidence Inputs:**

- `docs/user-tests/20260604-role-frontend-audit/role-frontend-audit.md`
- `docs/user-tests/20260604-role-frontend-audit/screenshots/`
- `docs/user-tests/20260604-frontend-usecase-round2/round2-usecase-frontend-check.md`
- `docs/user-tests/20260604-frontend-usecase-round2/results.json`
- `docs/user-tests/20260604-frontend-usecase-round2/screenshots/`

**Tech Stack:** React 18, TypeScript, Vite, Zustand, Vitest, Testing Library, Recharts, lucide-react, @tanstack/react-virtual.

---

## Scope

In scope:

- Role and permission model hardening.
- Frontend-only working paths for the tested modules.
- Minimal, deterministic UI flows for visible placeholder actions.
- Responsive shell improvements for narrow viewport use.
- QA/demo chrome gating.
- Accessibility fixes for critical icon-only controls and hover-only menus.
- Regression tests that encode the round-2 use-case standards.

Out of scope:

- Backend/API authorization.
- Persistent database writes.
- Real ERP integration.
- Real live news/AI sourcing.
- Full mobile product redesign.
- Full WCAG certification.

## Current Failure Summary

From the first two rounds:

- Viewer sees commercial cost in Part Library.
- Viewer can mutate Product Matrix lifecycle state.
- Viewer can access EBOM Architecture edit/local item controls.
- Sourcing can view commercial data but cannot edit commercial fields.
- Header identity does not follow selected role.
- Demo role switcher and FeedbackOverlay are always visible.
- Admin BOM Add Item is simulated only.
- ECO `+`, Supply Chain `Risk Report` / `Supplier Audit`, Compare `Export Report`, Part Library `Create Part`, Settings, ERP Connect are visible dead ends.
- Supply Chain search is not wired.
- Narrow viewport clips the app because the sidebar is fixed at desktop width.
- Icon-only controls and hover-only column menu are weak for accessibility and touch/keyboard use.

---

## Sub-Agent Operating Model

### Coordinator Rules

- [x] Start with `git status --short` and identify unrelated dirty files. Do not revert user changes.
- [x] Each implementation agent writes or updates focused failing tests before code changes where practical.
- [x] Each agent owns only the files listed in its scope.
- [x] Each agent reports:
  - changed files
  - tests run
  - remaining gaps
  - screenshots if UI changed
- [x] Integration coordinator runs cross-agent checks only after all wave agents have merged.

### Shared Acceptance Commands

Use focused commands during each agent pass:

```bash
npx vitest run tests/authStore.test.ts tests/AppNavigation.test.tsx
npx vitest run tests/ProductMatrixCenter.test.tsx tests/PhaseOneWorkflowPages.test.tsx
npx vitest run tests/BOMTable.test.tsx tests/ProductMatrixCenter.test.tsx tests/PhaseOneWorkflowPages.test.tsx
npm run build
```

Use browser-only manual confirmation against:

```text
http://127.0.0.1:3000/
```

Full regression target before final handoff:

```bash
npx vitest run
npm run build
```

---

## Wave 0: Test Standardization Agent

**Agent name:** `qa-usecase-spec-agent`

**Purpose:** Turn the round-2 use cases into executable regression targets before broad implementation begins.

**Owned files:**

- Create: `tests/RoleUseCases.test.tsx`
- Modify: `tests/authStore.test.ts`
- Modify: `tests/AppNavigation.test.tsx`
- Read: `docs/user-tests/20260604-frontend-usecase-round2/round2-usecase-frontend-check.md`
- Read: `stores/useAuthStore.ts`
- Read: `App.tsx`

**Tasks:**

- [x] Add tests asserting Viewer cannot see Part Library cost values.
- [x] Add tests asserting Viewer cannot trigger Product Matrix lifecycle mutation controls.
- [x] Add tests asserting Viewer cannot access EBOM Architecture edit/local item controls.
- [x] Add tests asserting Sourcing can access commercial edit inputs in Part Library.
- [x] Add tests asserting Header identity reflects `currentUser`.
- [x] Add tests asserting Supply Chain search filters rows and has an empty state.
- [x] Add tests asserting FeedbackOverlay is hidden when QA mode is disabled.
- [x] Mark narrow viewport as manual/browser regression, not JSDOM-only.

**Expected initial state:** Some tests fail.

**Acceptance:**

- Failing tests map directly to UC-V1, UC-V2, UC-V3, UC-V4, UC-S1, UC-S2, UC-C2.
- Tests avoid relying on brittle visual class names.
- Tests use accessible roles/text where possible.

**Handoff notes for next agents:**

- If a test cannot be made stable in JSDOM, move it to manual checklist inside the final QA agent's browser script.

---

## Wave 1: RBAC Foundation Agent

**Agent name:** `rbac-foundation-agent`

**Purpose:** Make role and permission semantics expressive enough for the audited use cases.

**Owned files:**

- Modify: `types.ts`
- Modify: `stores/useAuthStore.ts`
- Modify: `context/AuthContext.tsx` only if compatibility surface needs typing changes
- Modify: `components/Header.tsx`
- Modify: `components/Sidebar.tsx`
- Modify: `components/FeedbackOverlay.tsx`
- Modify: `App.tsx`
- Tests: `tests/authStore.test.ts`, `tests/AppNavigation.test.tsx`, `tests/RoleUseCases.test.tsx`

**Permission design:**

- Add `VIEW_COMMERCIAL_FIELDS`.
- Add `EDIT_COMMERCIAL_FIELDS`.
- Add `MANAGE_SKU_LIFECYCLE`.
- Add `EDIT_EBOM_ARCHITECTURE`.
- Add `MANAGE_TOOLING`.
- Add `VIEW_DEMO_ROLE_SWITCHER`.
- Optionally keep existing `VIEW_COST` / `EDIT_COST` as aliases or map them to commercial field behavior if simpler.

**Proposed role matrix:**

- `ADMIN`: all permissions.
- `ENG_LEAD`: dashboard, BOM, ECO, BOM structure/metadata edit, create ECO, EBOM architecture edit, SKU workflow select if needed, no commercial edit/view unless explicitly required.
- `SOURCING`: dashboard, BOM, supply chain, commercial view/edit, supplier risk, AVL management, compare/flat procurement review, no engineering metadata edit.
- `VIEWER`: dashboard, BOM, ECO, Phase 1 read-only modules, no commercial view, no mutation permissions.

**Tasks:**

- [x] Extend `Permission` enum.
- [x] Update `ROLE_PERMISSIONS`.
- [x] Add helper intent methods if useful, such as `canViewCommercial`, `canEditCommercial`, but keep API small.
- [x] Bind `Header` to `currentUser` instead of hard-coded Alex Chen.
- [x] Hide role switcher unless `VIEW_DEMO_ROLE_SWITCHER` is true or a dev flag is enabled.
- [x] Hide `FeedbackOverlay` unless a QA/dev flag is enabled.
- [x] Preserve current demo usability in development by choosing explicit, documented defaults.

**Acceptance:**

- Header changes when switching Admin/Engineer/Sourcing/Viewer.
- Viewer lacks commercial, SKU lifecycle, and EBOM edit permissions.
- Sourcing has commercial edit permissions.
- Role switcher/feedback overlay are no longer present in normal role-testing mode.
- Existing route visibility expectations are still intentional.

**Risks:**

- If hiding role switcher makes manual role testing difficult, add a single dev-only enable flag with a clear default.

---

## Wave 2A: Viewer Privacy and Read-Only Guard Agent

**Agent name:** `viewer-guard-agent`

**Purpose:** Ensure Viewer cannot see protected data or perform mutations.

**Owned files:**

- Modify: `pages/PartLibrary.tsx`
- Modify: `pages/ProductMatrixCenter.tsx`
- Modify: `pages/EBOMArchitectureWorkspace.tsx`
- Modify: `pages/BOMCompare.tsx` if cost appears there
- Modify: `components/BOMTable.tsx` only for shared cost-lock affordances
- Tests: `tests/RoleUseCases.test.tsx`, `tests/ProductMatrixCenter.test.tsx`, `tests/PhaseOneWorkflowPages.test.tsx`, `tests/BOMTable.test.tsx`

**Tasks:**

- [x] Gate Part Library cost column and commercial panel values by `VIEW_COMMERCIAL_FIELDS` / `VIEW_COST`.
- [x] For Viewer, show locked or omitted commercial cells consistently.
- [x] Gate Product Matrix `Select for Workflow`, `Activate`, `Freeze`, and `Suppress` by `MANAGE_SKU_LIFECYCLE` or more precise permissions.
- [x] Gate EBOM Architecture row `Edit`, `Add Local Item`, `Apply Override`, `Lock/Unlock`, `Revert`, `Publish`, and `Reset Draft` by `EDIT_EBOM_ARCHITECTURE`.
- [x] Add visible read-only notes only where they help users understand why actions are unavailable.
- [x] Keep Viewer navigation to read-only module views unless product owner decides to hide them.

**Acceptance:**

- UC-V1, UC-V2, UC-V3, UC-V4 pass.
- Viewer sees no dollar values in Part Library.
- Viewer has no enabled lifecycle or EBOM edit controls.
- Admin and Engineer/Sourcing controls still work according to role.

---

## Wave 2B: Sourcing Commercial Workflow Agent

**Agent name:** `sourcing-workflow-agent`

**Purpose:** Make the procurement role's core commercial maintenance path work from the frontend.

**Owned files:**

- Modify: `pages/PartLibrary.tsx`
- Modify: `pages/SupplyChain.tsx`
- Modify: `stores/useBOMStore.ts` only if existing update functions need minor extension
- Tests: `tests/RoleUseCases.test.tsx`, create/modify `tests/PartLibrary.test.tsx`, create/modify `tests/SupplyChain.test.tsx`

**Tasks:**

- [x] Split Part Library edit sections:
  - engineering metadata fields use `EDIT_BOM_METADATA`
  - commercial/supply fields use `EDIT_COMMERCIAL_FIELDS`
  - supplier/AVL fields use `MANAGE_AVL` or `EDIT_COMMERCIAL_FIELDS`
- [x] Allow Sourcing to edit cost, lead time, supplier, MOQ, SPQ, pricing tiers, stock/min stock if selected as commercial-owned.
- [x] Keep Sourcing blocked from engineering metadata if that is the desired policy.
- [x] Implement Supply Chain search state for supplier name, country, region, category, and status text.
- [x] Add no-match empty state.
- [x] Add a mock-source label to the AI disruption insight, such as `Simulated insight` with static timestamp.
- [x] Decide whether `Risk Report` / `Supplier Audit` should open a deterministic mock modal or be disabled with explanation.

**Acceptance:**

- UC-S1 and UC-S2 pass.
- Sourcing can complete commercial edits and save local state.
- Searching `zzzz-no-supplier` shows no supplier rows plus a clear empty state.
- Supply Chain insight no longer implies live current news.

## Execution Status - 2026-06-04 Round 1

Completed in the first implementation pass:

- [x] Added executable role use-case regression coverage in `tests/RoleUseCases.test.tsx`.
- [x] Extended the permission model with commercial, SKU lifecycle, EBOM architecture, tooling, and demo-role-switcher permissions.
- [x] Bound the header identity to `currentUser` instead of the hard-coded user.
- [x] Hid the demo role switcher and feedback overlay by default behind explicit Vite flags.
- [x] Blocked Viewer from seeing Part Library commercial cost values.
- [x] Allowed Sourcing to edit commercial/supply fields in Part Library while keeping engineering metadata separately gated.
- [x] Disabled Product Matrix lifecycle/select-for-workflow controls for roles without `MANAGE_SKU_LIFECYCLE`.
- [x] Disabled EBOM Architecture mutation controls for roles without `EDIT_EBOM_ARCHITECTURE`.
- [x] Implemented Supply Chain supplier search and no-match empty state.
- [x] Added role reset isolation to existing Product Matrix and Phase 1 workflow tests.

Verified:

- `./node_modules/.bin/vitest run tests/RoleUseCases.test.tsx --reporter=verbose`
- `./node_modules/.bin/vitest run tests/authStore.test.ts tests/AppNavigation.test.tsx tests/ProductMatrixCenter.test.tsx tests/PhaseOneWorkflowPages.test.tsx --reporter=verbose`
- `./node_modules/.bin/vitest run --reporter=verbose`
- `pnpm build`
- Browser smoke on `http://localhost:3000/`: Product Matrix, Part Library, Supply Chain, and EBOM Architecture load; default QA/demo chrome is hidden; Supply Chain search shows `No suppliers found`; browser console has no errors.

Remaining for next pass:

- [x] Add deterministic mock actions or disabled explanations for Admin dead-end buttons: BOM Add Item, ECO add, Risk Report, Supplier Audit, Compare export, Part Library create, Settings, ERP Connect.
- [x] Add visible `Simulated insight` source/timestamp treatment for Supply Chain AI disruption card.
- [x] Harden responsive shell behavior for narrow viewport/sidebar initial pass.
- [x] Improve icon-only controls and hover-only menus for accessibility and touch/keyboard use initial pass.
- [x] Decide and implement Viewer cost masking in any secondary surfaces outside Part Library, such as compare/export views if applicable.

## Execution Status - 2026-06-04 Round 2

Completed in the second implementation pass:

- [x] Turned BOM Add into a real local add-item form wired to `addBOMNode`, with parent, part number, name, type, quantity, unit, and cost fields.
- [x] Added a deterministic ECO draft action from the Change Orders create button.
- [x] Added deterministic previews for Supply Chain `Risk Report` and `Supplier Audit`.
- [x] Added a visible `Simulated insight` badge and static timestamp to the Supply Chain insight card.
- [x] Turned Compare `Export Report` into a visible report summary and masked protected commercial values for Viewer.
- [x] Added a real Part Library create-part modal wired to `addLibraryPart`.
- [x] Routed Settings and ERP Connect to actionable setup/checklist pages instead of dead navigation.
- [x] Added a shared `FeatureDialog` for deterministic frontend-only previews.
- [x] Made the sidebar compact below desktop width and tightened header overflow behavior.
- [x] Made BOM table Columns explicit with `aria-expanded` / `aria-controls`.
- [x] Added an accessible `Add Item` name to the BOM toolbar action.

Verified:

- `./node_modules/.bin/vitest run tests/RoleUseCases.test.tsx tests/BOMTable.test.tsx --reporter=verbose`
- `./node_modules/.bin/vitest run --reporter=verbose`
- `pnpm build`
- Browser click-path smoke on `http://localhost:3000/`: Settings, ERP Connect, Supply Chain simulated insight, Risk Report preview, Compare export preview, BOM Add modal, and Part Library create modal are reachable; browser console has no errors.

Non-blocking follow-up:

- Recharts still emits jsdom-only width/height warnings in tests.
- Vite still reports the main bundle is over 500 kB after minification; consider route/component code splitting later.
- Responsive shell has an implementation pass, but still needs a dedicated 390px visual screenshot QA pass.

---

## Wave 2C: Admin and ECO Flow Completion Agent

**Agent name:** `admin-eco-flow-agent`

**Purpose:** Replace visible placeholders with minimum usable frontend flows or remove/disable them clearly.

**Owned files:**

- Modify: `pages/BOMEditor.tsx`
- Modify: `pages/ECOManager.tsx`
- Modify: `pages/BOMCompare.tsx`
- Modify: `components/Sidebar.tsx` if ERP Connect is disabled/hidden
- Tests: create/modify `tests/BOMEditor.test.tsx`, create/modify `tests/ECOManager.test.tsx`, modify `tests/RoleUseCases.test.tsx`

**Tasks:**

- [x] Replace `Add Item (Simulated)` with a minimal add-item form:
  - parent selection or current selected node
  - part number
  - name/description
  - quantity
  - unit
  - type
  - save/cancel
  - validation errors
- [x] Make the form call existing `addBOMNode` or an established store action.
- [x] Decide ECO `+` policy:
  - implement minimal create ECO form, or
  - hide/disable with clear unavailable state.
- [x] Make Compare `Export Report` either produce a deterministic CSV/JSON/text download or be disabled with explanation.
- [x] Treat ERP Connect and Settings consistently:
  - hide from normal nav, or
  - route to a usable status/coming-soon page with no false promise.
- [x] Add success/error feedback for completed local actions.

**Acceptance:**

- UC-A3 passes.
- UC-E1 no longer exposes a confusing inert create button.
- Visible buttons either perform a user-visible action or are clearly unavailable.

---

## Wave 3A: Shell, Responsive Layout, and Chart Stability Agent

**Agent name:** `responsive-shell-agent`

**Purpose:** Make the app usable in narrow viewport and reduce chart/layout instability.

**Owned files:**

- Modify: `components/Sidebar.tsx`
- Modify: `components/Header.tsx`
- Modify: `pages/Dashboard.tsx`
- Modify: `pages/SupplyChain.tsx`
- Modify: `index.css` if global layout utilities are needed
- Tests: existing tests plus browser/manual checklist

**Tasks:**

- [x] Add responsive sidebar behavior:
  - desktop: existing fixed sidebar
  - narrow: collapsed rail or drawer with menu button
- [x] Ensure main content is not clipped at 390px width.
- [x] Make Header compact/reflow instead of hard clipping project, search, and user identity.
- [x] Add stable `min-h` / `min-w` wrappers around Recharts containers.
- [x] Add test-safe ResizeObserver setup if chart tests still warn.
- [x] Preserve dense desktop operational layout.

**Acceptance:**

- UC-C1 passes by screenshot.
- Recharts zero/negative width warnings are reduced or eliminated in focused tests.
- Desktop screenshots remain visually stable.

---

## Wave 3B: Accessibility and Interaction Clarity Agent

**Agent name:** `a11y-interaction-agent`

**Purpose:** Improve operability and clarity of existing controls without redesigning whole pages.

**Owned files:**

- Modify: `components/BOMTable.tsx`
- Modify: `pages/BOMEditor.tsx`
- Modify: `pages/PartLibrary.tsx`
- Modify: `pages/SupplyChain.tsx`
- Modify: `pages/ProductMatrixCenter.tsx`
- Modify: `pages/EBOMArchitectureWorkspace.tsx`
- Tests: `tests/BOMTable.test.tsx`, `tests/RoleUseCases.test.tsx`

**Tasks:**

- [x] Add `aria-label` to icon-only buttons:
  - Header bell/search-related controls if actionable
  - BOM snapshot/import/export/Where Used
  - Part Library list/grid/edit controls
  - Supply Chain row/action controls
- [x] Replace BOM `Columns` hover-only menu with click/focus popover state.
- [x] Ensure Escape closes popovers/modals.
- [x] Add focus-visible styles where missing.
- [x] Add simple labels/tooltips for unfamiliar icon-only actions.
- [x] Ensure disabled controls communicate why they are disabled.

**Acceptance:**

- Keyboard users can open and close the BOM column chooser.
- Icon-only controls have accessible names.
- No new visual clutter in dense desktop layouts.

---

## Wave 4: Integration QA and Browser Use-Case Agent

**Agent name:** `frontend-regression-agent`

**Purpose:** Re-run the role use cases and capture final proof after implementation.

**Owned files:**

- Create: `docs/user-tests/20260604-role-usecase-hardening-final/`
- Modify: `docs/user-tests/20260604-frontend-usecase-round2/round2-usecase-frontend-check.md` only if app behavior intentionally changes and references need update.
- Tests: all affected tests

**Tasks:**

- [x] Run `npx vitest run`.
- [x] Run project build (`pnpm build`; project-equivalent build command).
- [x] Start local dev server.
- [x] Re-run these browser use cases:
  - UC-A1
  - UC-A2
  - UC-A3
  - UC-E1
  - UC-E2
  - UC-S1
  - UC-S2
  - UC-S3
  - UC-V1
  - UC-V2
  - UC-V3
  - UC-V4
  - UC-C1
  - UC-C2
- [x] Save screenshots in final evidence folder.
- [x] Produce a final pass/fail report with residual issues.
- [x] Stop local dev server before handoff.

**Acceptance:**

- All P0 role/security use cases pass.
- Any remaining P1/P2 gaps are explicitly documented with owner and reason.
- Build passes.
- Tests pass or failures are clearly triaged.

## Execution Status - 2026-06-05 Final Pass

Completed in the final hardening pass:

- [x] Closed the remaining Wave 3A and Wave 3B implementation gaps: responsive dashboard/supply-chain shells, chart container stability, icon-only button names, keyboard Escape behavior, and disabled-control reasons.
- [x] Added page-level lazy loading and manual Vite chunks to keep the main entry bundle small and remove the previous 500 kB build warning.
- [x] Eliminated Recharts jsdom width/height warnings through stable ResizeObserver and layout test mocks plus chart initial dimensions.
- [x] Re-ran full automated regression coverage: 18 test files and 131 tests passed.
- [x] Re-ran the project build with no Vite 500 kB warning and no Recharts circular chunk warning.
- [x] Re-ran browser role/use-case smoke checks and saved final screenshots under `docs/user-tests/20260604-role-usecase-hardening-final/`.
- [x] Stopped the local development server before handoff.

Residual note:

- [x] No blocking issue remains. The in-app Browser tool blocked a synthetic `data:` 390px viewport harness, so narrow viewport evidence is covered by responsive shell regression tests and direct browser smoke instead of a saved synthetic 390px screenshot.

---

## Suggested Execution Order

1. `qa-usecase-spec-agent`
2. `rbac-foundation-agent`
3. Parallel after Wave 1:
   - `viewer-guard-agent`
   - `sourcing-workflow-agent`
   - `admin-eco-flow-agent`
4. Parallel after Wave 2:
   - `responsive-shell-agent`
   - `a11y-interaction-agent`
5. `frontend-regression-agent`

Do not run `viewer-guard-agent`, `sourcing-workflow-agent`, or `admin-eco-flow-agent` before the RBAC foundation is merged, because their permission checks depend on the same enum and role matrix.

---

## File Ownership Matrix

| File | Primary agent | Secondary agent |
| --- | --- | --- |
| `types.ts` | `rbac-foundation-agent` | none |
| `stores/useAuthStore.ts` | `rbac-foundation-agent` | `qa-usecase-spec-agent` |
| `components/Header.tsx` | `rbac-foundation-agent` | `responsive-shell-agent` |
| `components/Sidebar.tsx` | `rbac-foundation-agent` | `responsive-shell-agent`, `admin-eco-flow-agent` |
| `components/FeedbackOverlay.tsx` | `rbac-foundation-agent` | none |
| `pages/PartLibrary.tsx` | `sourcing-workflow-agent` | `viewer-guard-agent`, `a11y-interaction-agent` |
| `pages/ProductMatrixCenter.tsx` | `viewer-guard-agent` | `a11y-interaction-agent` |
| `pages/EBOMArchitectureWorkspace.tsx` | `viewer-guard-agent` | `a11y-interaction-agent` |
| `pages/SupplyChain.tsx` | `sourcing-workflow-agent` | `responsive-shell-agent`, `a11y-interaction-agent` |
| `pages/BOMEditor.tsx` | `admin-eco-flow-agent` | `a11y-interaction-agent` |
| `pages/ECOManager.tsx` | `admin-eco-flow-agent` | none |
| `pages/BOMCompare.tsx` | `admin-eco-flow-agent` | `viewer-guard-agent` |
| `components/BOMTable.tsx` | `a11y-interaction-agent` | `viewer-guard-agent` |
| `tests/RoleUseCases.test.tsx` | `qa-usecase-spec-agent` | all implementation agents |

If two agents need the same file, the coordinator should serialize those changes or split the file into smaller components first.

---

## Ready-to-Launch Agent Prompts

### Prompt: QA Use-Case Spec Agent

Use the two audit reports as source of truth. Create or update frontend regression tests that encode UC-V1/V2/V3/V4, UC-S1/S2, UC-A3, and UC-C2. Do not fix implementation. Report which tests fail and which files they cover.

### Prompt: RBAC Foundation Agent

Add the missing permissions and update the role matrix, Header identity binding, role switcher gating, and FeedbackOverlay gating. Keep existing navigation intent intact. Make focused role tests pass.

### Prompt: Viewer Guard Agent

Using the new permissions, make Viewer read-only in Product Matrix and EBOM Architecture and hide protected commercial data in Part Library and other visible tables. Add or update tests proving Viewer cannot mutate or see protected costs.

### Prompt: Sourcing Workflow Agent

Make the Sourcing role's commercial maintenance path work. Split Part Library edit permissions by field group and wire Supply Chain search with an empty state. Keep engineering metadata protected from Sourcing unless already allowed by the role matrix.

### Prompt: Admin/ECO Flow Agent

Replace visible placeholders with minimum usable frontend behavior or clear disabled states: BOM Add Item, ECO create, Compare export, ERP/Settings/Report/Audit entry points. Preserve mock/in-memory boundaries.

### Prompt: Responsive Shell Agent

Make the app usable at 390px width without clipping main content. Keep desktop density intact. Stabilize chart containers to reduce Recharts width/height warnings.

### Prompt: Accessibility Interaction Agent

Add accessible names and keyboard/touch operability to critical icon-only controls, especially BOM toolbar/table actions and the Columns menu. Avoid broad redesign.

### Prompt: Frontend Regression Agent

Run the completed app through the round-2 use cases using only the frontend. Save screenshots and a final pass/fail report. Run `npx vitest run` and `npm run build`, then stop the dev server.

---

## Final Handoff Criteria

The implementation batch is complete only when:

- [x] UC-A3, UC-S1, UC-S2, UC-V3, UC-V4, UC-C1, and UC-C2 no longer fail.
- [x] Viewer has no enabled mutation controls in Product Matrix or EBOM Architecture.
- [x] Viewer sees no protected cost in Part Library.
- [x] Sourcing can edit commercial fields.
- [x] Supply Chain search works.
- [x] Header identity matches the selected/current role.
- [x] Feedback overlay is hidden outside QA/dev mode.
- [x] Admin Add Item is a real frontend flow or clearly disabled by product decision.
- [x] Narrow viewport has a usable shell. Covered by responsive shell regression tests and direct browser smoke; the in-app Browser tool blocked the synthetic 390px `data:` screenshot harness.
- [x] Focused and full regression tests pass or have documented, accepted non-blocking warnings.
