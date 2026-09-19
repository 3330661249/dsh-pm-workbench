# Approved review workspace implementation plan

**Goal:** Implement the single approved monochrome requirements-review design in the existing Harness plugin without changing its domain workflow.

**Architecture:** Retain WorkbenchStore, commands, confirmations and evidence identity. Recompose ReviewWorkspace into a comparison list, an evidence/decision inspector and a reserved action footer. Restyle the existing shared shell rather than add a separate application.

**Tech stack:** Existing React, TypeScript and inline CSS strings; no new dependencies or raster assets. Reuse the installed ripple background.

**Spec:** Approved ImageGen visual `exec-b2ad9f03-4173-408c-83be-d4281bc098fa.png`, generated 2026-09-19 in this task. Project entry and five-step navigation share the header; only the current step is highlighted; two-column review; visible footer.

## Constraints

- Change only client presentation and its tests; no backend, store, model, data or confirmation-contract changes.
- Real stored titles, quotes, reason and provider metadata override illustrative copy in the mockup.
- Keep editing title/pain point/description/order, all source evidence, human priority and inclusion decisions, save/review/confirm gating.
- AI suggestion always refers to the original model suggestion, not the human override.
- No model calls, new material upload, publishing or production-data edits for verification.

## Tasks

1. Extend existing client tests to expose AI/human display contamination and pin requirement switching and confirmation gating; run them red. Recompose RequirementsPane using existing handlers and markers; run them green.
2. Replace the old three-column CSS and sidebar-offset shell with the approved integrated header, two-column content and grid-reserved footer. Preserve the other four stages and existing dialogs. Verify real DOM geometry before and after.
3. Run typecheck, product/demo/contract tests, build and package static validation. Confirm installed host bundle unchanged; back up and replace only client bundle, then restart the identified local Harness process.
4. Compare browser capture with the approved image at the same viewport. Check requirement selection, evidence/details disclosure, priority edits and discard without saving, step navigation, project menu, narrow viewport and keyboard focus. Revert temporary UI state. Record design QA and leave the real page open.

## Review focus

- Long project names and 5 navigation steps fit without pushing close/status controls off-screen.
- Long requirement titles and real source quotes wrap; empty evidence is explicit.
- Unsaved/uncertain/confirmed states preserve the original save and confirmation protections.
- Footer remains visible without covering the inspector or list on short and narrow screens.
- Materials, PRD, validation and handoff remain navigable under the shared shell.
