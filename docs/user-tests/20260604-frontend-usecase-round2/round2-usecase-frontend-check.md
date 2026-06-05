# zBOM Frontend Use-Case Round 2

Date: 2026-06-04

Scope: only frontend UI paths were used for this pass. No source-code inspection or direct store manipulation was used during path execution.

Local target: `http://127.0.0.1:3000/`

Evidence:

- Structured result file: `docs/user-tests/20260604-frontend-usecase-round2/results.json`
- Screenshots: `docs/user-tests/20260604-frontend-usecase-round2/screenshots/`

## Brainstormed Use-Case Standards

The following use cases are the reference standard for this and later frontend regression passes.

### Admin

#### UC-A1 Admin dashboard governance review

- Goal: understand project state, cost, risk, readiness, and recent ECO activity from the Dashboard.
- Path: login/switch to Admin -> Dashboard.
- Expected: all KPI and cost data visible; charts stable; recent ECO table visible; no unrelated QA overlay blocking content.
- Fail if: cost or charts are missing, identity is inconsistent, visible controls are non-functional, or page chrome blocks content.

#### UC-A2 Admin BOM workspace entry

- Goal: enter BOM Editor and verify Admin can access operational controls.
- Path: Admin -> BOM Editor -> switch Tree/Matrix/Flat, view EBOM/MBOM, open AI/Add/import/export-style controls.
- Expected: Add/import/export/snapshot/AI controls are discoverable and functional or clearly marked unavailable.
- Fail if: primary actions are placeholders, icon-only controls are unclear, or major buttons do nothing.

#### UC-A3 Admin add BOM item

- Goal: create or begin creating a new BOM item.
- Path: Admin -> BOM Editor -> Add.
- Expected: a real add-item form opens with parent/item/quantity fields, validation, save/cancel.
- Fail if: modal is only simulated or has no usable creation flow.

### Engineer

#### UC-E1 Engineer pending ECO technical review

- Goal: review an ECO's reason, impact, and workflow history.
- Path: Engineer -> Change Orders -> select pending ECO.
- Expected: reason, impacted parts, revision change, workflow history visible; create/change action works if shown; approval actions follow permission.
- Fail if: create button is shown but inert, or approval/create rights are unclear.

#### UC-E2 Engineer EBOM architecture draft edit entry

- Goal: inspect inherited EBOM and start an allowed draft edit.
- Path: Engineer -> EBOM Architecture -> select editable base/item -> edit.
- Expected: edit form opens; draft actions reflect Engineer authority; publish/reset are clear and guarded.
- Fail if: edit state is confusing, changes have no confirmation, or permission boundary is unclear.

### Sourcing

#### UC-S1 Sourcing supplier risk triage

- Goal: find a supplier, filter risk, and inspect supplier details.
- Path: Sourcing -> Supply Chain -> search/filter -> expand supplier.
- Expected: supplier search filters rows; status/risk filter works; expanded supplier shows linked parts and risk context.
- Fail if: search input does not affect the table, risk insight lacks source/timestamp, or action buttons are inert.

#### UC-S2 Sourcing commercial part maintenance

- Goal: search a part and maintain commercial fields.
- Path: Sourcing -> Part Library -> search part -> open part detail -> edit cost, lead time, supplier, MOQ, SPQ, pricing tiers.
- Expected: commercial fields are editable for Sourcing; metadata-only fields can remain restricted.
- Fail if: Sourcing can see commercial data but cannot maintain commercial data.

#### UC-S3 Sourcing procurement flat BOM review

- Goal: review procurement quantities, MOQ/SPQ, spend, and excess inventory.
- Path: Sourcing -> BOM Editor -> Flat.
- Expected: procurement metrics visible and scannable; export/report path available or clearly marked.
- Fail if: core procurement totals are missing or columns are unreadable.

### Viewer

#### UC-V1 Viewer read-only dashboard

- Goal: inspect project health without seeing protected cost data.
- Path: Viewer -> Dashboard.
- Expected: cost and analytics hidden; non-cost risk/readiness and ECO summary still useful.
- Fail if: protected cost leaks or the page becomes too empty to use.

#### UC-V2 Viewer read-only BOM review

- Goal: navigate BOM structure without mutating or seeing protected cost.
- Path: Viewer -> BOM Editor -> Tree/Matrix/Flat.
- Expected: Add/import/edit disabled; cost protected; read-only navigation still works.
- Fail if: mutation actions are enabled or cost leaks.

#### UC-V3 Viewer Product Matrix read-only review

- Goal: inspect SKU matrix without lifecycle mutation.
- Path: Viewer -> Product Matrix -> SKU Matrix.
- Expected: lifecycle buttons hidden or disabled; read-only status visible.
- Fail if: Activate/Freeze/Suppress/Select workflow controls are enabled.

#### UC-V4 Viewer EBOM Architecture read-only review

- Goal: inspect EBOM inheritance without changing draft state.
- Path: Viewer -> EBOM Architecture.
- Expected: edit/local item/draft controls hidden or disabled.
- Fail if: Edit/Add Local Item/Apply Override-style controls are enabled.

### Cross-Role

#### UC-C1 Narrow viewport usability

- Goal: use the app in a 390 x 844 narrow viewport.
- Path: open Dashboard in narrow viewport.
- Expected: sidebar collapses or becomes a drawer; main content remains readable.
- Fail if: sidebar consumes the screen and content is clipped.

#### UC-C2 QA feedback overlay availability

- Goal: avoid QA tooling in production-like role testing.
- Path: any role/page.
- Expected: feedback overlay hidden unless QA/dev mode is enabled.
- Fail if: floating overlay is always visible and blocks content.

## Frontend Execution Results

| Use case | Screenshot | Result |
| --- | --- | --- |
| UC-A1 Admin dashboard review | `01-uc-a1-admin-dashboard.png` | Partial pass. Dashboard KPIs/cost/charts/ECO table are visible. Header identity is hard-coded to Alex Chen and QA feedback overlay is always visible. |
| UC-A2 Admin BOM workspace entry | `02-uc-a2-admin-bom.png` | Partial pass. BOM Editor opens, EBOM/MBOM and Tree/Matrix/Flat controls are visible. Several icon-only controls need clearer labels. |
| UC-A3 Admin add item modal | `03-uc-a3-admin-add-modal.png` | Fail. Add opens `Add Item (Simulated)` with placeholder text, not a usable create flow. |
| UC-E1 Engineer pending ECO review | `04-uc-e1-engineer-eco-detail.png` | Partial pass. Engineer can inspect pending ECO reason, impact, and workflow history. The `+` create button is visible but no completed create path was found. |
| UC-E2 Engineer EBOM draft edit entry | `05-uc-e2-engineer-ebom-edit.png` | Pass for entry. Engineer can access EBOM edit controls and form. Needs later save/publish confirmation testing once mutation flow is hardened. |
| UC-S1 Sourcing supplier search no-match | `06-uc-s1-sourcing-supplier-search.png` | Fail. Searching `zzzz-no-supplier` still leaves all supplier rows visible, so Supply Chain search is not wired. |
| UC-S2 Sourcing part commercial edit attempt | `07-uc-s2-sourcing-part-panel.png` | Fail. Sourcing can see cost/supplier/commercial fields but gets `You do not have permission to edit part metadata`, so commercial maintenance cannot be completed. |
| UC-S3 Sourcing BOM flat procurement view | `08-uc-s3-sourcing-flat.png` | Pass. Flat view exposes standard cost, procurement spend, excess inventory, MOQ/SPQ, required/buy quantity, and spend. |
| UC-V1 Viewer dashboard read-only | `09-uc-v1-viewer-dashboard.png` | Pass with chrome issue. Cost is restricted and cost analytics are hidden. Header identity and QA overlay remain inconsistent/noisy. |
| UC-V2 Viewer BOM read-only controls | `10-uc-v2-viewer-bom.png` | Pass. Add is disabled and cost is not visible in the BOM table. Read-only navigation remains available. |
| UC-V3 Viewer Product Matrix mutation guard | `11-uc-v3-viewer-product-matrix.png` | Fail. Viewer still has enabled `Select for Workflow`, `Activate`, `Freeze`, and `Suppress` buttons. |
| UC-V4 Viewer EBOM mutation guard | `12-uc-v4-viewer-ebom.png` | Fail. Viewer still has enabled `Edit` and `Add Local Item` controls. |
| UC-C1 Narrow viewport dashboard | `13-uc-c1-mobile-dashboard.png` | Fail. Fixed sidebar consumes most of the 390px viewport and clips the dashboard. |
| UC-C2 Feedback overlay | all screenshots | Fail. `开启 UI 标注模式` appears on every page/role and can cover content. |

## Consolidated Round-2 Findings

1. Role use-case standards and current permission behavior are not yet aligned.
2. Viewer read-only behavior is good in Dashboard/BOM, but fails in Product Matrix and EBOM Architecture.
3. Sourcing's core commercial maintenance path is blocked despite commercial permissions.
4. Admin's add-item path is still a placeholder, so BOM creation is not testable end-to-end from the UI.
5. Supply Chain search is visibly present but not functional.
6. Engineer can review ECO and enter EBOM draft edit, but create/change completion still needs a real path.
7. Narrow viewport remains unusable.
8. QA feedback overlay should not be part of normal role testing.
9. Header user identity remains inconsistent with the selected role.

## Next Test Reference Standards

These standards should be converted into automated UI tests after the next implementation pass:

1. Viewer must not see cost in Dashboard, BOM, Part Library, Compare, Supply Chain drilldowns, or EBOM preview.
2. Viewer must not have enabled mutation controls in Product Matrix or EBOM Architecture.
3. Sourcing must be able to edit commercial fields but not necessarily engineering metadata.
4. Supply Chain search must reduce rows and show an empty state for no match.
5. Admin Add Item must expose a real form and either save or return a clear validation error.
6. Engineer ECO `+` must open a create/request flow or be hidden.
7. Product Matrix lifecycle buttons must require lifecycle-management permission.
8. EBOM Architecture draft controls must require EBOM-edit permission.
9. Header identity must match the selected/current user.
10. Feedback overlay must be hidden unless QA/dev mode is enabled.
11. At 390px width, sidebar must collapse and Dashboard content must be readable without horizontal clipping.

## Suggested Modification Order

1. Permission hardening for Viewer/Product Matrix/EBOM and Sourcing commercial edit.
2. Hide or gate demo/QA chrome: role switcher and feedback overlay.
3. Complete visible placeholder actions: Admin Add Item, ECO create, Supply Chain search.
4. Bind Header identity to current user.
5. Add responsive shell layout for narrow viewport.
6. Convert this document into regression tests.

## Verification Notes

- Frontend local server was used at `http://127.0.0.1:3000/`.
- 13 screenshots were captured.
- 13 structured case results were saved to `results.json`.
- No backend/API behavior was verified in this round.
- No full unit test or build pass was run in this round because the requested scope was frontend-only path checking.
