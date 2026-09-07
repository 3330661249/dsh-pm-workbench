# DSH PM Workbench

Private, unofficial `@knight/dsh-pm-workbench@0.1.0` package for Harness `0.1.0-rc.6`.

## Stage 3A Product package

The Product workflow is materials → requirements → priority review → PRD. Its
Host owns the project aggregate and strict Connection RPC on
`/dsh-pm-workbench-product-v1`; its Client contributes an additive launcher and
overlay. The six endpoints are `health`, `projects.list`, `projects.get`,
`sources.get`, `artifacts.getMarkdown`, and `projects.command`. Zod 4.4.3 is
bundled into both outputs; React and the observed public Harness runtime imports
remain external. There are no runtime dependencies in the package manifest.

Stage 3A uses one built-in synthetic Fixture. It makes no model call and does
not accept real interview/customer data. Synthetic source import, evidence
review, human requirement revision, priority confirmation, immutable baselines,
and deterministic Markdown are implemented in source. Stage 3B model execution
is unimplemented; reserved protocol tags do not enable it.

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
excluded from this package. This package is private and UNLICENSED; it is not
published or approved for real data.
