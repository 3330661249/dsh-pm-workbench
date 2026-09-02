# Official Typert version-matrix runner

This private, unofficial tool compares exact published DeepSeek Harness Typert cohorts against one frozen synthetic Remote fixture. It answers only whether a cohort can produce the strict Host and Client Remote artifacts required for a later isolated mount probe.

It never runs `dsh`, starts a server, reads a Harness profile, binds port 3080, calls a model, or reads interview/user data. A passing selection case can produce only:

`ELIGIBLE_FOR_NEXT_ISOLATED_MOUNT_PROBE`

Every result has `humanDecisionRequired: true`. It does not establish full DeepSeek Harness compatibility, plugin installability, lifecycle behavior, storage behavior, or coexistence with another plugin.

## Matrices

- `config/matrix.official.json`: `decisionMode: selection`; rc.6 control plus rc.7, rc.8, 1.1-rc.1, and 1.1-rc.2 candidates.
- `config/matrix.official-experimental.json`: `decisionMode: exploratory`; alpha.2-alpha.4 only. These cases can never enter `eligibleCandidateIds`.
- `config/matrix.legacy-diagnostic.json`: `decisionMode: exploratory`; rc.5, rc.2, and rc.3 diagnostics only. These cases can never enter `eligibleCandidateIds`.

The explicit decision mode resolves a specification ambiguity: exploratory and legacy evidence is executable, but it cannot be promoted by the selection policy. A complete exploratory run exits `1` with decision `EXPLORATORY_ONLY`; incomplete evidence exits `2`.

## Offline verification

From this directory:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

From the repository root, after `npm run build`:

```bash
node tools/typert-version-matrix/dist/cli.js validate \
  --matrix tools/typert-version-matrix/config/matrix.official.json
```

`validate` checks the closed config and the committed fixture hashes without registry access.

Verify the exact reviewed Darwin lock inventory without installing any case graph:

```bash
node tools/typert-version-matrix/dist/cli.js verify-locks \
  --platform-key darwin-arm64-node24-npm11
```

This validates every selection and experimental case against its config and the
platform README's embedded manifest, including exact file inventory, lock bytes,
root declarations, direct and DSH cohort versions, public-registry origins,
SHA-512 integrities, and the preserved installed-graph evidence hash.

## Network matrix run

Resolve mode creates new case-local locks under the ignored run directory. It does not update reviewed locks:

```bash
node tools/typert-version-matrix/dist/cli.js run \
  --matrix tools/typert-version-matrix/config/matrix.official.json \
  --lock-mode resolve \
  --output .tmp/dsh-pm-workbench/version-matrix/runs/<new-run-id>
```

Frozen mode has no fallback and requires a reviewed platform lock for every case:

```bash
node tools/typert-version-matrix/dist/cli.js run \
  --matrix tools/typert-version-matrix/config/matrix.official.json \
  --lock-mode frozen \
  --platform-key darwin-arm64-node24-npm11 \
  --output .tmp/dsh-pm-workbench/version-matrix/runs/<new-run-id>
```

The tool requires Node `24.14.0` and its local npm CLI `11.9.0`. Every subprocess uses an approved Node script plus argv and `shell: false`; child environments are allowlisted and case caches/npmrc files are isolated.

Network execution is currently restricted to POSIX platforms (macOS and Linux), where
the runner starts each command in a separate process group and terminates the whole group
on timeout. Windows execution fails closed until an equivalent bounded process-tree
termination implementation is reviewed.

### Cold-cache timeout budget

Each case intentionally starts with its own npm cache. During an initial selection
resolve attempt, npm 11 spent the original three-minute stage budget collecting registry
metadata while expanding tsdown's optional-peer graph; it had not produced a lockfile or
reached any compatibility assertion when the bounded timeout stopped it.

Timeouts are fixed runner policy, not matrix or case input. `resolve-lock` and `install`
receive `900_000ms`; registry queries, dependency-tree inspection, TypeScript, the direct
adapter, tsdown, and pack inspection retain `180_000ms`. A timeout remains
`INFRA_ERROR`, can never become `PASS` or `FAIL_COMPATIBILITY`, and makes the aggregate
matrix inconclusive. The runner continues to enforce normal peer resolution and does not
use `--legacy-peer-deps`, `--force`, or dependency omission flags.

## Canonical evidence

Each run writes `matrix.json`, then derives `matrix.md` and `junit.xml` from the validated JSON. Exit codes are:

- `0`: selection matrix complete, all cases conclusive, at least one candidate passed all A-D assertions;
- `1`: complete evidence with no eligible candidate, or an exploratory-only run;
- `2`: invalid config/report, registry/lock/adapter uncertainty, infrastructure error, or any incomplete case.

Verify a report from the repository root:

```bash
node tools/typert-version-matrix/dist/cli.js verify-report \
  --input .tmp/dsh-pm-workbench/version-matrix/runs/<run-id>/matrix.json
```

## Current implementation boundary

The runner and its offline negative tests are implemented. An initial cold-cache attempt
ended during control lock resolution. Subsequent isolated resolve-mode observations covered
the closed selection and experimental case inventories and were used only to generate and
review the committed Darwin locks and preserved installed-graph hashes. Their reports
predate the hardened provenance and report schema, have been isolated from canonical dated
results, and are not admissible evidence for a candidate decision.

The final hardened frozen selection and experimental runs against those reviewed locks are
still pending. Until their canonical JSON passes `verify-report`, its derived Markdown and
JUnit match byte-for-byte, and the result receives manual review, this repository has no
eligible candidate conclusion or version recommendation. Raw workspaces, caches, logs,
npmrc files, and direct-generator source are never publication artifacts.

`verify-report` recomputes the aggregate decision and validates the closed PASS evidence
graph, including lock, installed graph, registry, stage, direct-generator summary, and
artifact hashes. Canonical serialization removes raw direct-generator source and applies a
recursive rejection pass for sensitive fields and values, absolute local paths, raw logs,
and generated source. These controls detect malformed or tampered report structure; they
are not a digital signature, external timestamp, or cryptographic proof that an otherwise
self-consistent report was produced by this runner.
