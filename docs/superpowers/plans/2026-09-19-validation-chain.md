# Validation Chain Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; independent bounded implementation tasks may run in parallel.

**Goal:** Deliver the authorized interview-to-PRD-to-validation-to-handoff chain inside the existing Harness plugin.

**Architecture:** Keep the existing project aggregate and read its immutable PRD/baseline. A separate validated storage domain and RPC own validation tasks and controlled executors; the existing UI receives two stages.

**Tech Stack:** TypeScript, React 18, Zod 4, Cordis/Harness rc.6, Vitest, esbuild.

**Spec:** ../specs/2026-09-19-validation-chain-design.md

## Global Constraints
- Preserve current PRD integration, user records, black/white/gray style and ripple background.
- No arbitrary generated code execution, external business integrations or public deployment.
- Real model runs use the existing tool-restricted CordisAnalysisSubagentPort.
- Exact PRD and plan bindings; saved history and explicit human verdicts.
- The user authorized execution and ordinary design decisions; no further design approval pause.

## Review Focus
- A changed PRD or changed plan cannot silently reuse an old confirmation.
- Retried RPCs cannot duplicate real model calls.
- Cancelled/failed work must not be counted as passed or exported as approved.
- Malformed DOCX, excess decompression and XML entities must fail clearly.
- Partial-scope validation must not be represented as whole-product readiness.

### Task 1: Validation domain, service and executors
Files: new src/validation/{model,service,runner}.ts and integration/harness-rc6/validation-domain.ts; integrate product-host.ts. Own focused tests/product/validation.test.ts.
Consumes: ProjectRepository.get and AnalysisSubagentPort. Produces ValidationClient-compatible execute input/output on /dsh-pm-validation-v1.
- [x] Add meaningful tests for version binding, duplicate execution, mode outputs and judgment/export transitions, observe failures.
- [x] Implement strict types, durable per-task state and bounded model executor. Reuse immutable baseline and real runner patterns.
- [x] Run focused tests and type checks, report exact API to UI task.

### Task 2: Word import
Files: client/workbench/docx-input.ts, material-input.ts, MaterialPane.tsx; tests/product/material-input.test.ts.
Consumes: browser File. Produces the same verified MaterialDraft as existing text import, with extracted UTF-8 text.
- [x] Test DOCX paragraphs/table text, empty/encrypted/oversized content and unsupported formats.
- [x] Implement bounded ZIP/OOXML parsing without macros, execution or remote resources.
- [x] Verify existing TXT/MD flows plus DOCX cases.

### Task 3: A-layout validation UI and handoff
Files: client/workbench/ValidationPane.tsx, validation-client.ts, validation-styles.ts, WorkbenchView.tsx, client/index.tsx.
Consumes: Task 1 shared schemas; source project and selected PRD. Produces plan editing/confirmation, three executors, history, judgment, return-to-review and export UI.
- [x] Build task list and plan editor with operation feedback, selection guards and no browser data persistence.
- [x] Add controlled Demo controls, live POC input/result and capability cases. Distinguish mock Demo from real processing.
- [x] Add handoff summary/download and retain prior stages/PRD export.
- [x] Verify critical states using existing React tests and browser walkthrough.

### Task 4: Integration, package and real acceptance
Files: build.mjs graph allowlists, package verification, README/release notes, scripts/validation-chain-smoke.mjs.
- [x] Update exact build/package inventories to include intentional new files only.
- [x] Run project typecheck, test suite, build/package checks; address relevant failures.
- [x] Install backed-up local package, restart only identified Harness process, verify original theme.
- [x] Run a synthetic interview through actual model and all validation branches, inspect persisted results/download artifacts.
- [x] Independent bounded review for important correctness gaps, fix and verify. Record limitations honestly.
