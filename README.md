# DSH PM Workbench

> Private, unofficial research repository. This project is not affiliated with,
> endorsed by, or maintained by DeepSeek.

DSH PM Workbench is an experimental codebase for exploring how an AI product
manager could organize evidence from product discovery through requirement
analysis, prioritization, and later POC planning inside a DeepSeek Harness
extension.

The long-term Harness workflow is a product direction. The standalone browser
Demo and a bounded synthetic Harness Probe now exist in source; neither by
itself establishes real Harness runtime compatibility.

## Current Harness source implementation: Stage 2 synthetic Probe

The Harness package source now implements a bounded, synthetic integration
Probe. Its Host graph owns a strict two-endpoint registry for `health` and
`counter.increment`, a `storageDomain` aggregate for the synthetic counter and
idempotency receipts, and the single `/dsh-pm-workbench-v1` Connection RPC
channel configured with `authority: 'loopback'`. Its Web Client contributes one
`sidebar.footer.action` launcher and one `shell.overlay`; it does not replace a
Harness root. Requests and responses are validated against strict shared Zod
schemas, and the Client keeps at most eight RPC calls in flight.

This is a **source implementation checkpoint**. The package has not yet been
installed from its real tgz into an isolated Harness profile, loaded by the
Harness Host or Client, exercised in Chrome, restarted to observe persistence,
or removed and reinstalled. Stage 2 runtime compatibility and Gate A′ therefore
remain unverified and must not be inferred from source, type, unit, build, or
package checks. The Probe uses only an empty health request and synthetic
integer/UUID command metadata. It makes no model call and does not read or
process interviews, transcripts, files, sessions, credentials, providers, or
other user data.

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

The standalone Demo and the synthetic Harness Probe are separate build graphs.
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
The later approved simple design governs the standalone Demo, while the current
Stage 2 source implements only the bounded synthetic Connection RPC Probe
described above. Gate A′ has **not run**; implementing the architecture does not
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
