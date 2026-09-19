# DSH PM Workbench

Private, unofficial `@knight/dsh-pm-workbench@0.1.0` package for Harness `0.1.0-rc.6`.

## AI PM Skill suite

The package bundles eight DeepSeek Harness Skills. Start the complete text-first
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

The visual workbench panel accepts pasted text, `.txt`, and `.md` material.
Built-in synthetic material remains available for safe testing. Other text is
classified as authorized real material and cannot be imported until the user
explicitly confirms that it may be processed by the model provider currently
selected in Harness. Stage 3C sends the selected material through a fresh,
task-owned analysis agent. The child exposes only structured result capture;
every returned quote must match the frozen source exactly or the analysis is
rejected. Provider and model identifiers are retained with the analysis.

Source import, evidence review, human requirement revision, priority
confirmation and immutable baselines are implemented in the panel. PRD drafting
uses the bundled `create-prd` Skill from `phuryn/pm-skills` and the model currently
selected in Harness. Only confirmed baseline requirements and their evidence
are sent for drafting, not the complete original transcript. The model proposes
flows, acceptance criteria, exception paths and a POC/release plan; human scope,
priority and ordering remain authoritative. Unknown facts are listed as open
questions; suggested details are not confirmed business commitments. Internal
IDs and hashes are kept in the traceability appendix. A failed or invalid model
result is rejected instead of silently returning the old template. The drafting
agent selects an advertised compact reasoning option when the current route
supports one, leaving the global model selection and other conversations unchanged. “重新生成”
creates a new revision of the current saved baseline; old PRDs remain history. The selected, hash-verified PRD can be downloaded
as an editable Word (`.docx`) document locally through the single “下载PRD” button.
Word export preserves renderer headings, lists, literal source text and traceability
without uploading to a cloud service or changing the confirmed baseline.
Audio, DOCX/PDF material import, and multi-interview aggregation are not part of
this release. The deterministic renderer remains available for fixtures and historical data;
the installed visual panel uses the model drafter.
Supporting browsers show a save dialog starting on the Desktop; cancelling
does not trigger a fallback download. Other browsers use their normal download
location. The plugin does not change global browser download settings.

Product data persists in the Harness profile by design. Package removal does
not erase that profile data. Delete/remove is not secure erasure. Use real
material only when the organization and participants permit the selected model
provider to process it; remove direct identifiers when possible.

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
