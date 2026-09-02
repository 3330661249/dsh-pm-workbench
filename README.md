# DSH PM Workbench

> Private, unofficial research repository. This project is not affiliated with,
> endorsed by, or maintained by DeepSeek.

DSH PM Workbench is an experimental codebase for exploring how an AI product
manager could organize evidence from product discovery through requirement
analysis, prioritization, and later POC planning inside a DeepSeek Harness
extension.

The long-term workflow is a product direction, not a statement of implemented
functionality.

## Documentation-baseline status: historical Typert No-Go; Gate A′ not run

The canonical implementation and gate-status ledger, with append-only run blocks, is
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
Its gated implementation plan set is pending owner review at
[`docs/superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-rollout.md`](docs/superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-rollout.md).
No implementation phase is authorized. Gate A′ has **not run**. Approving the
architecture does not establish that Connection RPC works from this third-party
tarball.

The source-free canonical result set is retained in
[`docs/matrix-results/2026-09-02-darwin-arm64/`](docs/matrix-results/2026-09-02-darwin-arm64/).

At this reviewed documentation baseline, the repository contains a private
static package skeleton and technical evidence only. The canonical ledger has
**not** established that the package:

- can be installed into DeepSeek Harness;
- can load or mount in a Harness profile;
- is compatible with any Harness version;
- can persist projects or requirements;
- can analyze interviews;
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
the next architecture boundary, not as a proved compatibility result. The next
eligible technical step, only after implementation-plan review and a separate
phase authorization, is the F0 shared foundation followed by a bounded Gate A′
using only `health`, a synthetic persisted counter, an additive launcher and
overlay, and a real tarball in an isolated profile. This design decision
does not authorize full UI development, a real model, real interviews,
installation into the user's active Harness profile, merge, or public
distribution.

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
