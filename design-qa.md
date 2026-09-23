# Review workspace design QA — 2026-09-19

final result: passed

## Comparison evidence

- Source visual truth: `/Users/knight/.codex/generated_images/01a04375-ffaa-71e0-a148-de41de484e83/exec-b2ad9f03-4173-408c-83be-d4281bc098fa.png`.
- Live implementation: `http://127.0.0.1:3080/`, installed workbench client; synthetic project `完整链路验收 · 合成访谈`, step 2, first requirement selected, no unsaved changes.
- Implementation capture: `.tmp/review-redesign-20260919/desktop-final.png`.
- Source and final desktop capture: 1672 × 941 pixels; browser viewport 1672 × 941 CSS pixels. No resampling; effective screenshot density 1.
- Responsive evidence: `.tmp/review-redesign-20260919/mobile-final.png`, 390 × 844 pixels/CSS viewport; `.tmp/review-redesign-20260919/mobile-scrolled.png` records the earlier scroll test. Viewport override restored to the user's 1512 × 783 window after checking.
- Source and rendered captures were opened in the same comparison input. Full view made the header, table columns, evidence, decisions and footer readable; separate cropped comparisons were unnecessary.
- Exact generated mock wording is illustrative. The live page intentionally preserves stored project titles, verbatim quotes, source metadata, complete rationale and human reasons. It does not invent the mock's speaker attribution or abbreviate evidence as if it were a direct quote.

## Comparison history and fixes

1. **P1 — old fragmented layout.** Three columns, detached project menu and a narrow bottom action region did not match the approved design. Replaced with one frame, integrated header, two content columns and a reserved full-width footer.
2. **P2 — initial implementation too small and sparse.** `desktop-v1.png` had 15 px requirement titles and excessive space below the list. Increased title/body sizing, improved table proportions and allowed rows to fill the available panel. Compared `desktop-v2.png` against the source again.
3. **P2 — mobile primary action was narrower than its panel.** The footer grid inherited content-sized tracks. Added an explicit `minmax(0,1fr)` track. `mobile-final.png` confirms a 340 px button inside the 372 px footer, with 16 px padding on each side.
4. **P3 — invalid full-source font shorthand.** Split font family, size and line-height into valid declarations before final capture.

No actionable P0/P1/P2 findings remain for this scoped redesign.

## Required fidelity surfaces

- **Typography:** native SF/PingFang fallbacks, 32 px main heading, 19 px requirement titles, 21 px evidence quote at the target desktop width. Compact metadata stays secondary. Responsive sizing reduces density without removing decisions.
- **Spacing/layout:** 32 px outer margin, single graphite frame, 72 px header. Desktop columns measured 953.15 / 652.85 px. Footer spans the 1606 px content width and ends at y=908, inside the 941 px viewport. No unrelated project sidebar competes with the workspace.
- **Colors:** neutral grays only; active controls use near-white on dark gray. Only the current step has a filled number and underline. No purple tokens were introduced.
- **Assets:** existing live ripple canvas and its original background remain untouched. No synthetic image reconstruction, decorative replacement artwork or new dependency was added. Native disclosure marker and textual close control are intentional functional equivalents to the mock's chevron/close artwork.
- **Copy/content:** actual stored content retained. AI suggestion now comes from the original generated requirement; human priority remains separate. Longer real rationale/evidence can scroll in the inspector. This is an intentional content-driven difference from the shorter mock.

## Interaction and regression checks

- Selected a different requirement and verified the inspector followed it.
- Changed synthetic requirement priority from P0 to P1 locally: AI suggestion remained P0; primary action changed to “保存修改”. Discarded that unsaved test edit through the existing confirmation dialog, restoring P0. No project write or model request was performed.
- Opened full source: the visible source panel contained the 263-character synthetic interview. Opened requirement details: title, description, pain point and ordering controls were present.
- Project switcher opened within viewport, then closed without changing project.
- Five stage navigation inspected at 1280 × 800: one active step, no horizontal document or surface overflow, surfaces within viewport.
- At 390 × 844: one content scroll area, all controls reachable by scrolling, footer bottom y=835; no horizontal overflow. At restored 1512 × 783: footer bottom y=750.
- Browser console error query returned no captured errors during final checks.
- 615 product/demo/contract tests passed; typecheck passed; build passed; static package verification passed (17 files, no runtime dependencies).
- Installed `lib/client.js` matched the built client. Installed `lib/index.js` matched the unchanged built host. Client backup: `.tmp/review-redesign-20260919/client-before.js`.

## Scope and residual gaps

- This is a UI redesign of the shared frame and requirement review workspace, not a new analysis/PRD/validation implementation. Backend, store and persistence were not changed.
- Model generation and saved project mutations were intentionally not exercised in the live browser. Existing automated state-machine and contract tests cover the retained save/confirmation paths.
- P3 follow-up only: if the user prefers the mock's shorter visible evidence, offer a separately labeled summary; never silently rewrite a quotation.

## Implementation checklist

- [x] Approved two-column design implemented in existing plugin.
- [x] Original editing, source access and confirmation guards retained.
- [x] Desktop/mobile rendering and main UI interactions checked.
- [x] Client installed with backup; backend unchanged.
- [x] Viewport restored and live workspace left open.
