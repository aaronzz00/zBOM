# EBOM/MBOM Manual Trial Script

## Purpose

Observe whether a user can move from Product Matrix SKU selection through EBOM review, EBOM edit/publish, MBOM delta inspection, and SKU comparison without coaching. Capture points where labels, inherited data, change-package behavior, or decision ownership are unclear.

## Setup

- Use the current local app build with Product Matrix, EBOM Architecture, and MBOM Delta available.
- Start from the Product Matrix view.
- Ask the participant to think aloud while completing each task.
- The observer should avoid explaining terms unless the participant is blocked for more than two minutes.
- Record the selected SKU names and any blocker, but do not paste real external row data into notes.

## Data Note

The app trial data is synthetic and safe to reference in this script. If observers use optional Feishu confirmation data, keep it local-only under ignored paths such as `.agent/real-data/` and do not paste actual Feishu rows into this document or shared notes.

When optional Feishu data is used, `Audio Frame` and `Hearing Frame` represent model flags for comparison. They are confirmation context only, not source data to copy into the script.

## Manual Tasks

1. In Product Matrix, pick an active Standard SKU and state why it appears active.
2. Open EBOM Architecture for that SKU and identify one inherited row, one overridden row, one local row, and one locked row.
3. Edit the quantity of an inherited EBOM item, publish the change package, and verify the draft state clears after publishing.
4. Switch to MBOM Delta for the same SKU and inspect the available delta packs.
5. Read the composed MBOM preview and identify which rows appear to come from the base MBOM versus delta rows.
6. Switch to a Pro SKU and compare the EBOM differences against the Standard SKU.
7. Compare the Pro SKU MBOM view against the Standard SKU MBOM view and name the most important difference.
8. Record any confusing terminology, missing decision points, or places where the user expected a different action.

## Observer Notes

- Participant:
- Date:
- Build or branch:
- Standard SKU selected:
- Pro SKU selected:
- Completed tasks:
- Blockers or hesitations:
- Confusing terminology:
- Missing decision points:
- EBOM inheritance/edit/publish notes:
- MBOM delta/preview notes:
- Follow-up questions:
