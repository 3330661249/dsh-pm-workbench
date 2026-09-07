# DSH PM Workbench

> Private, unofficial research repository. This project is not affiliated with,
> endorsed by, or maintained by DeepSeek.

DSH PM Workbench is an experimental codebase for exploring how an AI product
manager could organize evidence from product discovery through requirement
analysis, prioritization, and later POC planning inside a DeepSeek Harness
extension.

## Current Stage 3A Product source and static package

The current production graph implements the synthetic materials → requirements
→ priority review → PRD workflow through one Product Connection channel,
`/dsh-pm-workbench-product-v1`, a Host-owned project aggregate, and an additive
Client launcher and overlay. It uses one built-in synthetic Fixture, makes no
model call, and does not accept real interview/customer data. Stage 3B model
execution is unimplemented. Product state is stored in the Harness profile by
design; delete/remove is not secure erasure.

Task 11 verifies exact Product graphs and nine package members. No-argument
`npm run verify:package` is static, needs no Git metadata and retains no tgz or
receipt hash. `npm run pack:dry` remains an offline no-script dry run. The
explicit release verifier binds one real archive to a clean commit and a closed
receipt in the ignored Task 11 workspace. Task 12 must revalidate and consume
that exact retained archive without repacking it.

This checkpoint does not establish real Product installation, UI behavior,
Harness restart persistence, or remove/re-add recovery. Those observations
remain Task 12. The historical Stage 2 Probe and Task 3 storage gate preserve
their own evidence and cannot establish runtime behavior for these new bytes.

## Current implementation: standalone four-step Demo

A deterministic, in-memory browser Demo implements the four-step
`材料 → 需求 → 优先级 → PRD` workflow. It accepts synthetic text or text files,
generates fixture requirement cards with exact citations using local Demo rules,
supports human edits, priorities and inclusion decisions, and previews/downloads
Markdown containing only included cited requirements. These are local fixture
results, not AI analysis or real model output. State exists only in the current
page and is lost on refresh or close.

From the repository root:

```sh
npm run demo:serve
```

Open [the local Demo](http://127.0.0.1:4173/). The server builds the three browser
files in `.tmp/dsh-pm-workbench/demo/` and listens only on `127.0.0.1`.
`npm run demo:build` builds the same files without starting a server. Use only
synthetic, non-identifying material.

The approved scope is §8.1 of the
[simple Demo/Alpha design](docs/superpowers/specs/2026-09-04-dsh-pm-workbench-simple-alpha-design.md),
implemented through the
[standalone interactive Demo plan](docs/superpowers/plans/2026-09-05-dsh-pm-workbench-interactive-demo.md).
That design supersedes the older complex rollout as the current implementation
scope; the earlier documents remain research history.

The standalone Demo and historical synthetic Harness Probe are separate from the current Product build graph.
The Demo is not an installed Harness plugin, and the Probe is not the AI product
manager workflow. Real Harness installation/mounting, observed restart recovery,
model calls, and the Alpha privacy/real-data capability remain unverified or out
of scope. The historical Typert **NO-GO** remains historical, and Connection RPC
Gate A′ has **not run**.

## Historical Harness investigation and gate status

The canonical Harness investigation and gate-status ledger, with append-only run blocks, is
[`docs/probe-results.md`](docs/probe-results.md). Future phase and gate evidence
commits update that ledger and bind observations to exact source/tgz hashes;
this README provides orientation and must not be used to infer a newer runtime
state. README/compatibility files packed inside any tgz describe only that
artifact's build-time state, while the external ledger is authoritative for
later observed runs of the same hash.

The historical architecture required generated, strict Typert Host/Client Remote
artifacts. The initial isolated `0.1.0-rc.6` probe discovered the workspace
package but emitted no Remote artifacts. A later hardened frozen matrix repeated
the same synthetic probe across eight exact official cohorts from
`0.1.0-rc.6` through `0.1.2-alpha.4`. All eight completed as
`FAIL_COMPATIBILITY / GENERATION_EMPTY`: automatic and forced generation each
returned zero outputs, so none produced the five required files. The selection
decision is `NO_ELIGIBLE_CANDIDATE`; that generated-Typert Gate A remains a
historical **NO-GO**.

On 2026-09-02, the owner approved a revised architecture specification:
public Connection RPC, a shared strict Zod endpoint registry, Host-owned state,
and a `WorkbenchTransport` abstraction that preserves a later Typert migration
path. The approved canonical specification is
[`docs/superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md`](docs/superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md).
Its historical gated implementation plan set is retained at
[`docs/superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-rollout.md`](docs/superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-rollout.md).
That wider Harness integration plan has not been executed as a product Alpha.
The later approved simple design governs the standalone Demo; the retained Stage 2 source describes its historical synthetic Connection RPC Probe. Gate A′ has **not run**; implementing the architecture does not
establish that Connection RPC works from this third-party tarball.

The source-free canonical result set is retained in
[`docs/matrix-results/2026-09-02-darwin-arm64/`](docs/matrix-results/2026-09-02-darwin-arm64/).

Alongside the implemented standalone Demo, the repository retains the private
Harness Probe source and technical evidence. The canonical Harness ledger has
**not** established that the package:

- can be installed into DeepSeek Harness;
- can load or mount in a Harness profile;
- is compatible with any Harness version;
- can persist projects or requirements;
- can perform model-based interview analysis inside Harness;
- can call a real model;
- can process real user data.

No handwritten descriptor, copied generated file, private HTTP fallback,
dynamic Cordis fallback, protocol vendoring, or generator patch is accepted as
proof that the historical Gate A passed. The newly selected Connection RPC seam
must instead pass its own isolated Gate A′.

## Completed investigation and current decision

The approved official-version matrix is complete. It reused one fixed synthetic
Remote probe, exact reviewed locks, a clean committed runner, and source-free
canonical evidence for every tested version. Independent adversarial review
found no remaining P0 or P1 issue in the evidence path; its residual P2 findings
are recorded alongside the results.

No tested candidate is eligible for an isolated mount probe under the old
strict generated-Remote architecture. The owner has approved Connection RPC as
the architecture boundary, not as a proved compatibility result. The current
Stage 2 source implements the bounded `health`/synthetic-counter service and
additive launcher/overlay portion of that direction; the real-tarball isolated
runtime observation remains a separate next step. Any later Harness Alpha work
needs its own approved implementation scope and observed integration evidence.
Neither the standalone Demo nor the Probe authorizes a real model, real
interviews, installation into the user's active Harness profile, merge, or
public distribution.

## Data boundary

Only synthetic, non-identifying fixtures may enter this repository.

Never commit or attach:

- real interview recordings or meeting audio/video;
- real transcripts, notes, summaries, quotations, or uploaded documents;
- names, contact details, account identifiers, customer data, or other personal
  information;
- API keys, access tokens, cookies, browser sessions, credentials, `.npmrc`,
  local Harness profiles, or provider responses;
- private model prompts or outputs produced from real user data.

If sensitive material is committed accidentally, treat it as compromised:
revoke or rotate credentials where applicable, remove the material from Git
history, and review any clones, logs, artifacts, and Pull Requests that may
contain it.

## Development and Pull Requests

`main` is the reviewed baseline. Development happens on short-lived branches,
using the `codex/` prefix for Codex-authored work.

Every functional change should arrive through a Pull Request that states:

- what changed and why;
- which gate or approved scope permits it;
- the exact checks actually run and their observed results;
- whether any compatibility claim is proven, failed, proposed, or still
  unknown;
- whether dependencies or third-party source references changed;
- whether the data boundary or privacy surface changed.

A passing build alone is not compatibility evidence. A PR must not claim that
the plugin is installable, compatible, secure, or ready for real interview data
unless the corresponding gate has been explicitly passed with reproducible
evidence.

Direct pushes to `main`, force pushes, secret-bearing commits, generated caches,
and real user data are outside the repository workflow.

## Distribution and license

This repository is private and **UNLICENSED**. No permission is granted to use,
copy, modify, publish, distribute, sublicense, or sell this code. Private GitHub
visibility is an access setting; it does not grant a reuse license.

Third-party dependencies and reference projects remain subject to their own
licenses. Their presence in documentation does not mean their source code was
copied or approved for redistribution.
