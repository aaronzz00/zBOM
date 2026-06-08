# zBOM Production Readiness Review

Date: 2026-06-07

## Scope

This review treats the current system as a candidate for production deployment and checks three angles:

1. Production readiness of the current codebase and runtime model.
2. Expanded role tests based on realistic Admin, Engineer, Sourcing, Viewer, and cross-role workflows.
3. Product gap analysis against mature BOM / PLM systems such as OpenBOM, Arena, Autodesk Fusion Manage, and Duro.

## Execution Plan And Status

| Step | Status | Output |
| --- | --- | --- |
| Map repository, modules, stores, repository layer, and tests | Done | React/Vite frontend prototype with core repository, Zustand stores, mock/development preview modules |
| Review production risks | Done | P0/P1/P2 issue list below |
| Expand role scenario coverage and execute validation | Done | Scenario matrix and test results below |
| Compare mature BOM systems | Done | Product gap list below |
| Produce prioritized remediation plan | Done | 0 to 90 day plan below |

## Validation Evidence

| Command | Result | Notes |
| --- | --- | --- |
| `npm run build` | Pass | Vite build completed; largest vendor chunk is below the 500 kB warning threshold. |
| `./node_modules/.bin/vitest run --reporter=verbose` | Pass | Current-workspace result after discovery fix: 24 files / 175 tests passed. React `act(...)` warnings remain in configuration and component tests. |
| `npm run test:core-browser` | Pass | Chrome headless QA passed for 10 desktop/narrow checks after aligning the Tooling Hub path with the real Details -> links flow and fixing the narrow detail drawer. |
| `curl -I http://127.0.0.1:3001/` | Pass | Browser QA target server responded with HTTP 200. |

Note: browser QA refreshes screenshot evidence in `docs/user-tests/20260605-core-modules-production-usecase-check/screenshots/`.

## Production Readiness Finding

Current zBOM is not production-ready. It is a useful front-end product and workflow prototype, but production deployment would require real backend identity, server-side authorization, durable multi-user storage, formal revision/change controls, external integrations, and release-grade E2E tests.

## Priority Issues

### P0 - Must Fix Before Production

1. No real backend, database, login system, or ERP writeback exists.
   - Evidence: `README.md` states the system has no real remote backend, database service, login system, or ERP writeback.
   - Impact: no multi-user source of truth, no production security boundary, no reliable recovery, no enterprise integration.
   - Required action: introduce backend API, database, authenticated sessions, tenant/workspace model, migrations, backup/restore, and environment separation.

2. Authorization can be bypassed because the API facade always acts as ADMIN.
   - Evidence: `services/ApiInterface.ts` hard-codes `getActor()` to `{ role: 'ADMIN' }` and all mutations call repository methods through that actor.
   - Impact: role-based UI tests can pass while API-level calls mutate BOM, parts, and tooling as admin.
   - Required action: remove `MockApiClient` from production paths; derive actor from authenticated server session; add negative permission tests against service/API boundaries.

3. Legacy repository replacement paths bypass granular policy and lifecycle controls.
   - Evidence: `replaceLegacyBOMTree`, `replaceLegacyLibraryParts`, and `replaceLegacyTooling` write directly and record audit events without permission checks. Store methods call these for common mutations.
   - Impact: fine-grained `createBOMNode`, `updatePart`, and `updateToolingMilestone` policies are not consistently enforced. Released BOM ECO gating is UI/store behavior, not a repository or server invariant.
   - Required action: remove unrestricted bulk replacement from user flows, or wrap it in strict service commands with role checks, lifecycle gates, diff validation, and audit.

4. Sensitive BOM and commercial data are stored client-side and can be wiped locally.
   - Evidence: core repository and configuration rely on `localStorage`; Settings reset calls `localStorage.clear()`.
   - Impact: browser data loss, no server recovery, no concurrent edits, no controlled retention, no regulated audit trail.
   - Required action: move durable data to a database; use client cache only as a cache; implement recovery, locking/version conflict handling, and audit log persistence.

5. AI integration still exposes provider credentials and BOM context from the browser if enabled.
   - Evidence: the current stage removed Vite build-time key injection and replaced the Gemini-specific client with Settings-managed OpenAI-compatible configuration, but the key is still stored in browser `localStorage` and requests are sent directly from the client.
   - Impact: if enabled in production, proprietary BOM, cost, supplier, and design data can leave the tenant boundary; browser-stored provider keys are not acceptable for enterprise use.
   - Required action: proxy AI through a backend, redact/classify payloads, add tenant policy and consent controls, never ship or store provider keys in clients.

### P1 - Blocking For Serious Customer Pilot

1. Browser QA needs ongoing maintenance as product flows evolve.
   - Evidence: this stage fixed the stale Tooling Hub path and narrow detail drawer; `npm run test:core-browser` now passes.
   - Impact: without fail artifacts and path ownership, future UI changes can silently stale the QA script.
   - Required action: keep the browser flow aligned with real user paths and add a JSON failure artifact on timeout.

2. Test discovery must remain scoped to the active workspace.
   - Evidence: this stage changed Vitest discovery to `tests/**/*.test.{ts,tsx}` and excludes `.worktrees/**`, `dist/**`, and `node_modules/**`.
   - Impact: if loosened again, stale or unrelated worktree tests can inflate coverage counts.
   - Required action: keep this constraint and report root-project test counts only.

3. Production-core status is inconsistent.
   - Evidence: Sidebar lists BOM Compare in Production Core, but `App.tsx` wraps `compare` in `DevelopmentPreviewFrame`.
   - Impact: product scope is unclear to users and reviewers.
   - Required action: decide whether Compare is production core; either remove the preview banner and harden it, or move it back to development preview in navigation/docs.

4. ECO / change management is not formal enough.
   - Evidence: ECOs are local mock records; approve/reject mutate local state; sandbox publish writes directly to master then marks ECO pending.
   - Impact: no real approval routing, affected item versioning, reviewer decisions, sign-off dashboard, or immutable release package.
   - Required action: implement ECR/ECO lifecycle with affected items, proposed revisions, reviewers, approval policy, closed states, and server-side enforcement.

5. Attachments are demo blob URLs, not managed files.
   - Evidence: `addAttachment` uses `URL.createObjectURL(file)` and stores metadata in the local BOM tree.
   - Impact: attachments disappear across sessions/devices and cannot serve as drawing/CAD/spec revision records.
   - Required action: add object storage, file metadata, virus scan, document revision, access control, and signed download URLs.

6. Test suite has React `act(...)` warnings.
   - Impact: some tests assert against intermediate component state and may become flaky under React timing changes.
   - Required action: wrap interactions in user-level async flows, prefer `userEvent`, and wait for observable UI state.

### P2 - Important Hardening

1. Validation is incomplete for some update paths, especially bulk replacement and commercial field updates.
2. Settings can reset all local data with a generic confirm dialog, with no export/backup or typed confirmation.
3. Supply chain risk, supplier audit, report export, ERP setup, and market intelligence remain deterministic previews.
4. No SSO, MFA, tenant roles, team sharing, notification, or task routing exists.
5. No accessibility regression suite or WCAG-grade audit exists, beyond selected component accessibility checks.

## Expanded Role Scenario Tests

| Scenario | Real workflow | Result | Issues found |
| --- | --- | --- | --- |
| Admin release readiness | Review project, BOM, parts, tooling, compare, settings | Partial pass | Build and component tests pass; compare production status is inconsistent; settings can wipe all local data. |
| Admin BOM operation | Add existing library part, create local item, import CSV, snapshot | Pass in component tests | Browser QA did not complete full core flow; bulk replace paths bypass stricter policy. |
| Engineer change flow | Released node edit triggers ECO sandbox; product matrix to EBOM to MBOM path | Pass in component tests | ECO sandbox is not a real server-side change order; repository does not enforce released lifecycle gates globally. |
| Engineer phase transition | Move project through EVT/DVT/PVT checklist | Partial pass | UI checks permissions, but repository `updateProjectPhase` has no permission guard. |
| Sourcing commercial maintenance | Search supplier/part, edit cost/MOQ/SPQ/lead time, inspect BOM flat view | Pass in component tests | Sourcing path is still local and not tied to live supplier, inventory, RFQ, PO, or ERP workflows. |
| Sourcing supply chain triage | Search supplier, view risk, create report/audit preview | Pass as deterministic preview | No real supplier risk feed, audit execution, or report export workflow. |
| Viewer read-only review | Navigate BOM, Part Library, Compare, Dashboard; verify cost masking and disabled mutations | Pass in component tests | API facade can still mutate as ADMIN; read-only is not enforceable outside UI. |
| Cross-role browser smoke | Desktop and narrow viewport through BOM, Part Library, Tooling, Dashboard | Pass | Fixed stale Tooling Hub QA path and narrow detail drawer overlap. |

## Mature BOM / PLM Benchmark

Public product materials reviewed:

- OpenBOM: cloud-native product data platform connecting CAD, BOM, PDM, PLM, ECO, procurement, inventory, suppliers, and ERP workflows in one collaborative workspace: https://www.openbom.com/
- OpenBOM change management: change history, item/BOM revisions, change requests/orders, role-based approvals, sign-off dashboard: https://www.openbom.com/change-management
- OpenBOM integrations: CAD, PDM, PLM, ERP, CRM, content management, cloud storage, Fusion, Xero, Zoho Inventory, Priority ERP, Microsoft Dynamics 365 Business Central: https://www.openbom.com/integrations
- Arena Item and BOM Management: revision-controlled items/BOMs, engineering changes linked to items/BOMs/documents, AML/AVL, supply chain and quality context: https://www.arenasolutions.com/solutions/item-bom-management/
- Arena Engineering Change Management: ECR/ECO automated approvals with internal and external team collaboration: https://www.arenasolutions.com/solutions/engineering-change-management/
- Autodesk Fusion Manage: collaborative BOM/property editing, change/release management, task tracking, secure cloud storage: https://www.autodesk.com/products/fusion-360/fusion-manage
- Duro API and PLM materials: role-based access control, components and BOM assembly structures, custom change workflows, integrations, reporting, AI-assisted sourcing and revision compare: https://docs.durohub.com/ and https://durolabs.co/product-lifecycle-management/

## Product Gaps Needing Urgent Improvement

1. Digital thread and source of truth.
   - Gap: zBOM has local frontend state; mature systems connect parts, BOMs, revisions, files, suppliers, changes, procurement, and ERP in a shared cloud workspace.
   - Urgency: highest.

2. Formal revision and change control.
   - Gap: zBOM has snapshots and local ECO previews; mature systems have immutable item/BOM revisions, change requests, change orders, reviewer stages, sign-off dashboards, and auditable approvals.
   - Urgency: highest.

3. CAD/PDM/ERP/procurement integration.
   - Gap: zBOM has setup/checklist pages and CSV import/export; mature systems extract from CAD, manage files/drawings, and synchronize with ERP/inventory/purchasing systems.
   - Urgency: highest.

4. Role-based security and tenant governance.
   - Gap: zBOM role control is mostly UI/local repository policy; mature systems support organization/library access controls, SSO/MFA-style enterprise security, and auditable external collaboration.
   - Urgency: highest.

5. Supplier, AML/AVL, compliance, and sourcing intelligence.
   - Gap: zBOM displays mock suppliers and commercial fields; mature systems tie AML/AVL, compliant available parts, supplier risk, cost/availability, RFQ/PO, and alternatives into the product record.
   - Urgency: high.

6. Document and file revision management.
   - Gap: zBOM attachments are demo blob URLs; mature systems link drawings, CAD, specs, and documents to item/BOM/change records.
   - Urgency: high.

7. Collaboration, tasking, and notifications.
   - Gap: zBOM has no real comments, assigned tasks, alerts, reviewer queues, or supplier collaboration spaces.
   - Urgency: high.

8. Reporting and analytics.
   - Gap: zBOM has deterministic report previews; mature systems generate change reports, analytics, audit-ready records, and operational dashboards.
   - Urgency: medium-high.

## Recommended Execution Plan

### 0 to 30 Days: Make The Prototype Honest And Testable

1. Keep Vitest discovery scoped to `tests/**` and excluded from `.worktrees/**` so current workspace counts stay truthful.
2. Repair `npm run test:core-browser` and make the browser QA fail-fast with a JSON failure artifact.
3. Resolve production-core labels, especially BOM Compare.
4. Add negative authorization tests proving Viewer/Sourcing cannot mutate via service/repository APIs.
5. Complete AI hardening by moving provider keys from browser `localStorage` to a backend secret store and server-side proxy.
6. Mark every non-real external workflow as preview in one consistent product vocabulary.

### 30 to 60 Days: Build Production Foundations

1. Add backend API, database, auth/session model, and server-side role enforcement.
2. Replace bulk repository replacement paths with explicit domain commands.
3. Add immutable item/BOM revision records and real audit persistence.
4. Implement formal ECO lifecycle: draft, submit, review, approve/reject, close, with affected items and proposed revisions.
5. Move attachments to managed storage with versioned metadata.

### 60 to 90 Days: Become Competitive With Lightweight BOM/PLM

1. Add CAD import adapter strategy and file/drawing relationships.
2. Add ERP/procurement integration design: items, BOMs, suppliers, RFQ, PO, inventory.
3. Add AML/AVL governance, compliance flags, lifecycle/EOL status, and alternatives.
4. Add collaboration: comments, tasks, reviewer queues, notifications.
5. Add operational reporting: revision diff reports, change reports, cost/risk dashboards, export controls by role.

## Final Assessment

The current system is valuable as a high-fidelity product prototype and workflow validation tool. It should not be deployed as a production BOM management system yet. The biggest risks are not UI completeness; they are missing production data architecture, authorization, formal change control, integrations, and trustworthy end-to-end tests.
