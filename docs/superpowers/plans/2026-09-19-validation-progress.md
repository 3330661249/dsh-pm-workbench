# Validation chain delivery — 2026-09-19

## Delivered locally

- Isolated branch: codex/validation-chain-20260919. Starting current PRD source preserved at b15e87a; original checkout untouched.
- Installed the verified 17-file package in the existing Harness profile. Original installed package backup: .tmp/validation-acceptance/installed-backup. Existing projects and ripple plugin preserved.
- Five-stage UI: material → decisions → PRD → validation → engineering handoff. DOCX paragraphs/tables, editable plans, Demo/core capability/POC, version bindings, failure/partial/pass/hold, return to requirements, durable run history and ZIP export.
- Runtime verified at 127.0.0.1:3080. Synthetic project: 完整链路验收 · 合成访谈.

## Actual acceptance evidence

- Imported a synthetic DOCX using the same parser as the browser. Real Harness model extracted requirements; synthetic operator decisions published a baseline; create-prd produced a real PRD and DOCX.
- First PRD request stopped streaming and timed out; explicit retry succeeded. Failure was not converted to a fabricated result.
- Clicked the controlled Demo in Chrome; saved a partial verdict and followed the return-to-requirements button. Mock data remains explicitly labelled.
- First real executor runs exposed role confusion and historical PRD evidence contamination. Saved both as failed, separated execution context, tightened prompt to actual text processing, revised plans and reran.
- Second capability run: three real model cases (normal evidence, missing evidence, duplicate source), all supplied citations matched the input verbatim and result meanings were inspected.
- Second POC run: fresh source text plus two candidate quotations; the model correctly identified one exact match and one unsupported quotation. No historical PRD material used as evidence.
- Saved scope-limited synthetic engineering pass notes, retaining the first failed run and its conclusion. These are agent-operated engineering tests, not confirmation from a real product user.
- Used the actual UI to prepare and download the handoff ZIP. Native save dialog defaulted to Desktop. Verified the resulting ZIP, nested DOCX XML, configuration, run 2 binding and run 1 failure history.

## Verification and open engineering item

- Final typecheck: passed.
- Product/demo/contract suite: 43 files, 606 tests passed.
- Build and static package verification: passed. Archive contents independently compared with the 17 package files; installed bytes match.
- Retained-release integration test: 1 passed, 97 intentionally unselected; includes real package, reopen and cleanup checks.
- Extended standalone relocation test: 4 passed, 1 failed after 262 seconds, at the copied repository's nested full test suite. Copied typecheck passed. Wrapper hides child test output and deletes the temporary clone; exact nested failing test remains undiagnosed. Do not claim full-suite or portable-release certification. This does not erase the observed local runtime acceptance; distribute as a local pilot only.

## Deliberate limits

- Demo is a controlled mock template, not an arbitrary custom application generator.
- POC is a text input → actual model → structured result template within Harness. The exported JSON is a record, not a standalone executable app or import mechanism.
- No audio transcription, PDF import, external business APIs, production deployment, real-user or safety/performance validation was added.
- Manual PRD review, scope confirmation and business acceptance remain user responsibilities. Test passes apply only to the selected scenarios.
