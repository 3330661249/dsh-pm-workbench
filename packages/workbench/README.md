# DSH PM Workbench

Private, unofficial `@knight/dsh-pm-workbench@0.1.0` package for Harness `0.1.0-rc.6`.

## AI PM Skill suite

The package bundles seven DeepSeek Harness Skills. Start the complete text-first
workflow in any Harness conversation with `/interview-to-prd`, followed by an
interview transcript or research notes. The orchestrator loads the focused
Skills for evidence intake, synthesis, requirement framing, priority review,
PRD drafting, and adversarial review. It stops at three human decision gates:
evidence confirmation, requirement/priority confirmation, and PRD publication
confirmation.

The current Skill workflow handles readable text. Audio transcription and
prototype generation are not part of this release. Content submitted in a
Harness conversation is processed by the model provider configured for that
session; do not submit customer data unless that processing is authorized.

## Stage 3A Product panel

The Product workflow is materials → requirements → priority review → PRD. Its
Host owns the project aggregate and strict Connection RPC on
`/dsh-pm-workbench-product-v1`; its Client contributes an additive launcher and
overlay. The six endpoints are `health`, `projects.list`, `projects.get`,
`sources.get`, `artifacts.getMarkdown`, and `projects.command`. Zod 4.4.3 is
bundled into both outputs; React and the observed public Harness runtime imports
remain external. There are no runtime dependencies in the package manifest.

The visual workbench panel still accepts only synthetic material. Stage 3B can
send that synthetic material to the model currently selected in Harness through
a fresh, task-owned analysis agent. The child exposes only structured result
capture; every returned quote must match the frozen source exactly or the
analysis is rejected. Provider and model identifiers are retained with the
analysis. The panel does not yet accept real interview/customer data. Synthetic source import, evidence
review, human requirement revision, priority confirmation, immutable baselines,
and deterministic Markdown are implemented in source. Real text analysis is
currently available through `/interview-to-prd` in a Harness conversation.

Product data persists in the Harness profile by design. Package removal does
not erase that profile data. Delete/remove is not secure erasure. Use only
synthetic, non-identifying material.

## Evidence boundary

Task 11 verifies the static Product code graphs, nine package members and a
retained archive bound to a clean source commit. No Task 11 result proves a real
install, Harness UI behavior, persistence across a Harness restart, or removal
and re-add recovery. Task 12 must consume and validate the same retained tgz for
those observations; it must never repack it. Stage 2 and the Task 3 storage gate
are historical evidence for their own artifacts, not this Product package.

The repository's separate standalone Demo is an in-memory fixture tool and is
excluded from this package. This package is private, unofficial, UNLICENSED,
and not published.
