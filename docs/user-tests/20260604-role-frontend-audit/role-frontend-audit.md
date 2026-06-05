# zBOM Frontend Role-Based Audit

Date: 2026-06-04

Audit target: current Vite/React frontend at `http://127.0.0.1:3000/`

Evidence folder: `docs/user-tests/20260604-role-frontend-audit/screenshots/`

## Role Paths Checked

1. Admin: dashboard, BOM editor, product matrix.
2. Viewer: dashboard, BOM editor, part library, product matrix, EBOM architecture.
3. Sourcing: supply chain, part library, ERP connect.
4. Engineer: change orders, product matrix.
5. Narrow viewport: dashboard at 390 x 844.

## Screenshot Evidence

- `01-admin-dashboard.png`
- `02-admin-bom-editor.png`
- `03-admin-product-matrix.png`
- `04-viewer-dashboard.png`
- `05-viewer-bom-editor.png`
- `06-sourcing-supply-chain.png`
- `07-sourcing-part-library.png`
- `08-engineer-change-orders.png`
- `09-engineer-product-matrix.png`
- `10-mobile-dashboard.png`

## Findings

### P0 - Permission And Role Experience

1. Viewer can see commercial cost in Part Library.
   - Evidence: `viewer-part-library` DOM text includes `Cost`, `$35.000`, `$18.000`, etc.
   - Impact: Dashboard and BOM table correctly hide/lock cost, but Part Library leaks the same type of data.
   - Fix: gate Part Library cost columns and commercial fields with `Permission.VIEW_COST`; show locked/hidden values for Viewer and Engineer if they lack cost permission.

2. Viewer can use Product Matrix lifecycle actions.
   - Evidence: Viewer Product Matrix exposes enabled `Select for Workflow`, `Freeze`, `Suppress`, and some `Activate` buttons.
   - Impact: read-only users can alter SKU workflow/lifecycle state.
   - Fix: add dedicated permissions such as `MANAGE_SKU_LIFECYCLE` and `SELECT_WORKFLOW_SKU`; disable or hide actions for Viewer.

3. Viewer can access EBOM Architecture editing controls.
   - Evidence: Viewer EBOM Architecture exposes enabled row `Edit` buttons and `Add Local Item`.
   - Impact: read-only users can start editing architecture drafts when the selected base is not released.
   - Fix: gate `Edit`, `Add Local Item`, `Apply Override`, `Lock/Unlock`, `Revert`, `Publish`, and `Reset Draft` by role, not only by base status.

4. Sourcing role cannot edit commercial fields in Part Library.
   - Evidence: Sourcing has `EDIT_COST` and `MANAGE_AVL`, but Part Library uses only `EDIT_BOM_METADATA` for editability.
   - Impact: the commercial role can view cost but cannot maintain cost, supplier, MOQ/SPQ, or pricing tiers.
   - Fix: split edit gates by section: metadata, commercial, inventory, supplier/AVL.

5. Header identity does not follow the simulated role.
   - Evidence: sidebar says Viewer/Sourcing/Engineer, but header remains `Alex Chen / Sr. Product Engineer / AC`.
   - Impact: role testing is confusing and screenshots contradict the active user.
   - Fix: bind `Header` to `useAuthStore.currentUser`; map role-specific title/avatar, or remove hard-coded identity.

6. Demo role switcher is always visible.
   - Evidence: every role sees `Simulate Role`.
   - Impact: useful for demos, unsafe/confusing for realistic user testing.
   - Fix: gate with a demo flag such as `VITE_ENABLE_ROLE_SWITCHER`, or move it to a dev-only QA panel.

### P1 - Functional Completeness

7. Several primary buttons are visible but not functional.
   - Examples: `ERP Connect` routes to WIP; Settings has no action; ECO `+` has no create flow; Supply Chain `Risk Report` and `Supplier Audit` have no implemented behavior; Compare `Export Report` has no handler; Part Library `Create Part` is not wired.
   - Impact: users hit dead ends during realistic walkthroughs.
   - Fix: either implement minimum flows, disable with "coming soon" affordance, or remove from role navigation until usable.

8. Header search is visually prominent but not wired.
   - Evidence: header input has placeholder `Search parts, mpn...` with no state or submit behavior.
   - Impact: users expect global search across BOM, MPN, supplier, and ECO, but nothing happens.
   - Fix: implement scoped global search or mark as unavailable; add keyboard behavior and result state.

9. Supply Chain table search is also not wired.
   - Evidence: search input is rendered without controlled state/filter logic.
   - Impact: procurement users cannot search suppliers in a table meant for operational use.
   - Fix: add supplier name/country/category/status search and empty-state feedback.

10. AI insight copy implies live news without source or timestamp.
    - Evidence: Supply Chain card says `Based on recent news...`.
    - Impact: users may treat mock content as current intelligence.
    - Fix: label mock insight as simulated, or attach source/timestamp/confidence once real data exists.

### P1 - Layout And Responsive Display

11. Narrow viewport is not usable.
    - Evidence: `10-mobile-dashboard.png`; the 256px sidebar consumes most of the 390px viewport and the main dashboard is clipped.
    - Impact: small laptops, tablets, split-screen use, and mobile cannot operate the app.
    - Fix: implement responsive sidebar collapse/drawer, compact header, and table overflow strategy.

12. Global UI feedback overlay is always visible and can cover content.
    - Evidence: all screenshots show bottom-right `开启 UI 标注模式`.
    - Impact: it covers page content and makes production-like screenshots/test sessions noisy.
    - Fix: make feedback overlay dev/QA-only; allow hiding by environment flag or role.

13. Chart layout is fragile in tests and screenshots.
    - Evidence: focused Vitest run logs Recharts warnings: chart width/height `0` or `-1`; initial Dashboard screenshot caught chart animation in a partial state.
    - Impact: charts may render blank or unstable in tests, constrained panels, or slow devices.
    - Fix: add stable min dimensions/aspect wrappers and test-safe ResizeObserver behavior.

14. Page density and table overflow need clearer behavior.
    - Evidence: BOM Editor and Product Matrix rely on horizontal overflow; many controls are icon-only.
    - Impact: users can miss cost columns, hidden table fields, or action meanings.
    - Fix: add visible table overflow affordances, persistent column controls, and role-aware default columns.

### P2 - Accessibility And Interaction Clarity

15. Icon-only buttons often have no accessible name.
    - Evidence: DOM collection found many buttons with empty visible text and no `aria-label`.
    - Impact: screen-reader and keyboard users cannot identify actions; new users rely on guessing.
    - Fix: add `aria-label` and tooltips for icon-only actions in header, BOM toolbar, tables, and row actions.

16. Column chooser is hover-only.
    - Evidence: BOM column menu opens via `group-hover`.
    - Impact: keyboard and touch users cannot reliably open it.
    - Fix: use explicit popover state, click trigger, Escape close, and focus management.

17. Status relies heavily on color and tiny badges.
    - Evidence: many status chips use small text and color as primary signal.
    - Impact: scanning is difficult for color-blind users or dense operational review.
    - Fix: keep text labels, add icon/shape cues where useful, and check contrast.

## What Works Well

1. Admin dashboard gives a strong project overview and cost/risk/readiness hierarchy.
2. Viewer Dashboard and BOM table mostly respect cost hiding and edit disabling.
3. Sidebar permission filtering works at a coarse page level.
4. BOM Editor supports meaningful EBOM/MBOM, tree/matrix/flat views.
5. Product Matrix, EBOM Architecture, and MBOM Delta form a useful phase-1 workflow story, but need role hardening.

## Next Modification Plan

### Phase 1 - Role Hardening

1. Add missing permissions:
   - `VIEW_COMMERCIAL_FIELDS`
   - `EDIT_COMMERCIAL_FIELDS`
   - `MANAGE_SKU_LIFECYCLE`
   - `EDIT_EBOM_ARCHITECTURE`
   - `MANAGE_TOOLING`
   - `VIEW_DEMO_ROLE_SWITCHER`
2. Bind `Header` identity to `currentUser`.
3. Hide/gate demo role switcher behind an env flag.
4. Apply cost visibility consistently in Dashboard, BOM, Compare, Part Library, Supply Chain drilldowns, and EBOM legacy preview.
5. Add role guards to Product Matrix and EBOM Architecture actions.
6. Add tests that assert Viewer cannot see costs or enabled mutation actions.

### Phase 2 - Workflow Completion

1. Decide for each dead-end action: implement, disable, or remove.
2. Implement minimum ECO creation flow or hide the `+` button.
3. Implement Part Library create/edit by section-level permissions.
4. Wire Supply Chain search and report/audit buttons to at least deterministic mock outputs.
5. Replace ERP Connect WIP route with a disabled nav item or a real connector status page.
6. Add state-change confirmation and success/error feedback for SKU lifecycle actions.

### Phase 3 - Responsive And Visual Reliability

1. Add responsive sidebar drawer/collapse at narrow widths.
2. Make header reflow instead of clipping project/user/search content.
3. Add chart min-height/min-width wrappers and test-friendly ResizeObserver mocks.
4. Add table overflow indicators and role-specific default columns.
5. Gate `FeedbackOverlay` to QA/dev or add a global hide preference.

### Phase 4 - Accessibility Pass

1. Add accessible names and tooltips to icon-only actions.
2. Replace hover-only menus with click/focus popovers.
3. Check focus order through sidebar, toolbar, tables, modals, and slideovers.
4. Add form error text and validation for numeric fields.
5. Add accessibility-focused tests for keyboard access and hidden/disabled states.

## Verification Performed

1. Browser audit completed against local dev server at `http://127.0.0.1:3000/`.
2. `npm run build` passed.
   - Warning: main JS chunk is `885.53 kB`, above the 500 kB warning threshold.
3. Focused role/navigation tests passed:
   - `./node_modules/.bin/vitest run tests/authStore.test.ts tests/AppNavigation.test.tsx --reporter=verbose`
   - 2 files passed, 6 tests passed.
   - Warning: Recharts reported zero/negative chart container dimensions in test output.
4. Full `npx vitest run` was attempted but ended without usable output in this session, so it should be rerun before merging code changes.

## Audit Limits

1. This pass used mock/local frontend state only; no backend persistence or API authorization was verified.
2. Accessibility findings are based on DOM/screenshot inspection, not a full WCAG audit.
3. AI/Gemini calls were not invoked; only the visible AI entry points and mock insight copy were reviewed.
