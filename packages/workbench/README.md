# DSH PM Workbench

MIT-licensed, unofficial preview `@knight/dsh-pm-workbench@0.1.0` package for Harness `0.1.0-rc.6`.

## AI PM Skill suite

The package bundles eight DeepSeek Harness Skills. Start the complete text-first
workflow in any Harness conversation with `/interview-to-prd`, followed by an
interview transcript or research notes. The orchestrator loads the focused
Skills for evidence intake, synthesis, requirement framing, priority review,
PRD drafting, and adversarial review. It stops at three human decision gates:
evidence confirmation, requirement/priority confirmation, and PRD publication
confirmation.

The current Skill workflow handles readable text. Audio transcription is not
part of this release. The visual panel now includes a controlled Demo and POC
validation center. Content submitted in a
Harness conversation is processed by the model provider configured for that
session; do not submit customer data unless that processing is authorized.

## Workbench panel

The Product workflow is materials → requirements → priority review → PRD →
validation → engineering handoff. Its
Host owns the project aggregate and strict Connection RPC on
`/dsh-pm-workbench-product-v1`; its Client contributes an additive launcher and
overlay. The six endpoints are `health`, `projects.list`, `projects.get`,
`sources.get`, `artifacts.getMarkdown`, and `projects.command`. Zod 4.4.3 is
bundled into both outputs; React and the observed public Harness runtime imports
remain external. There are no runtime dependencies in the package manifest.

The visual workbench panel accepts pasted text, `.txt`, `.md`, and `.docx` material.
Word paragraphs and table text are extracted locally for preview; images,
headers, footers and embedded attachments are not imported. Encrypted or
malformed archives are rejected. The archive is limited to 10 MB and its
document XML to 2 MB, with the existing text limits applied after extraction.
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
Audio, PDF material import, and multi-interview aggregation are not part of
this release. The deterministic renderer remains available for fixtures and historical data;
the installed visual panel uses the model drafter.
Supporting browsers show a save dialog starting on the Desktop; cancelling
does not trigger a fallback download. Other browsers use their normal download
location. The plugin does not change global browser download settings.

Product data persists in the Harness profile by design. Package removal does
not erase that profile data. Delete/remove is not secure erasure. Use real
material only when the organization and participants permit the selected model
provider to process it; remove direct identifiers when possible.

## Validation center and handoff

The fourth stage uses the selected immutable PRD and a selected subset of its
confirmed requirements. Create a task in one of three modes:

- **Interactive Demo:** fixed input/result/confirmation controls, clearly labelled
  simulated output. It supports an interaction walkthrough; it does not test AI quality.
- **Core capability:** 3–20 editable cases are processed by the configured real model.
  Expected and actual output are shown together; automatic checks cover structure
  and literal quotations, while business correctness remains a human judgment.
- **Runnable POC:** a controlled input → real AI → structured result form inside
  the workbench. New inputs can be run explicitly; this is not an arbitrary app
  generator or standalone production deployment.

AI drafts a plan, which the user can edit and confirm. If drafting fails the UI
explicitly labels the editable fallback template. Execution requires a confirmed
plan; paid calls are not automatically repeated after a lost response. The task,
plan snapshots, actual results and model provenance persist in the separate
`dsh_pm_workbench_validation` storage domain via `/dsh-pm-validation-v1`.
Changing a plan invalidates its confirmation. Changing the source requirements
keeps historical results visible but prevents using them as current approval.

After inspecting a completed run, the user chooses pass, partial, fail, or hold.
Partial/failed conclusions link back to requirement review. A pass enables a ZIP
containing an editable Word handoff, a readable report, a JSON run configuration
and usage instructions. Scope is explicit: a selected requirement passing a few
cases does not certify the rest of the product. Exported POC configuration is a
readable record; running the POC still requires the original Harness project and
configured model. Cross-device import and standalone executable export are not
included in this version.

## Evidence boundary

Local macOS + Harness rc.6 runs have exercised the installed panel and real
DeepSeek-V4-Flash calls with synthetic material. This is a local pilot, not proof
of production readiness, customer outcomes, or compatibility with other versions.
The September 23 retest still has repeated explanations and leading follow-up
questions; business judgments require human review. See the repository preview
notes for the exact scope and known limitations.

Static package verification checks contents and import boundaries; it does not
prove model correctness or clean-machine installation. Historical Stage 2/3A
reports describe their own old artifacts, not the current release.

Original code is MIT licensed; bundled Zod and create-prd retain their notices
in docs/third-party.md. The manifest remains private:true only to prevent an
accidental npm publish. GitHub source and downloadable preview archives can
still be distributed under their applicable licenses. This package does not
include the separate ripple theme, its shaders, or its background photograph.
