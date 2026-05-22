# Prompt For Next Session

Use the following prompt to start the next session.

```text
Please do implementation planning only for this repository. Do not start broad code changes yet.

Context documents:
- /Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/README.md
- /Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/docs/superpowers/specs/2026-05-22-zbom-platform-redesign-design.md
- /Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/docs/superpowers/specs/2026-05-22-zbom-session-handoff.md

What is already decided:
- zBOM should evolve from a single-project BOM editor into a multi-project product configuration and manufacturing difference management platform
- EBOM should use double-layer inheritance:
  Project Platform Base -> Series Base -> Structure Base -> Variation / SKU Delta
- MBOM should be managed primarily as Base + Delta, with frozen Released MBOM for key SKUs
- MBOM difference retrieval should be SKU-first
- SKU strategy should be hybrid: rule-generated candidate SKUs plus manual activation/freeze
- Tooling should be an independent object but still BOM-oriented in phase 1
- A DesignMasterPart / ToolingSubject layer should exist between structure-level design and concrete EBOM items
- Tooling milestones that must be modeled:
  Drawing Release, DFM, Quotation, Kickoff, L/T, T1
- L/T is defined as Kickoff -> T1

What I want from this new session:
1. analyze the current codebase against the redesign documents
2. produce a concrete implementation plan for phase 1
3. break the plan into:
   - domain types
   - stores
   - mock data migration
   - page/module changes
   - compatibility strategy for current pages
4. identify the smallest safe first implementation slice
5. highlight technical risks and migration risks

Please keep the work in planning mode and provide a structured implementation plan rather than jumping into large code edits.
```

## Short Prompt Version

If a shorter prompt is preferred, use this:

```text
Read these three files first:
- /Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/README.md
- /Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/docs/superpowers/specs/2026-05-22-zbom-platform-redesign-design.md
- /Users/zz-orka/zOS/10_PROJECTS/PJ-2026-07_zBOM/docs/superpowers/specs/2026-05-22-zbom-session-handoff.md

Then do implementation planning only for phase 1 of the zBOM platform redesign. Do not start broad code changes. I want a concrete plan for types, stores, mock data, pages, migration strategy, and the smallest safe first implementation slice.
```
