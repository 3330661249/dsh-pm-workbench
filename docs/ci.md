# CI safety boundary

The repository has two deliberately separate GitHub Actions workflows. Neither
workflow runs DeepSeek Harness, reads a Harness profile, opens port 3080, calls a
model, or processes interviews or other user data.

## Pull requests and pushes

`.github/workflows/static-verification.yml` runs on `pull_request` and `push`.
It performs only:

- the workbench type-check, unit/integration tests, package build, package-boundary
  verification, and package dry run;
- the matrix runner's type-check, offline tests, and build;
- offline validation of the closed selection and experimental configurations and
  the frozen synthetic fixture.

The two locked dependency-install steps may fetch packages or restore GitHub's npm
cache. After installation, `npm_config_offline=true` is applied to all checks and
matrix `validate` calls. This workflow never invokes the matrix `run` command, so a
pull request or push cannot query DSH release metadata or resolve a version cohort.

`actions/setup-node` fixes Node at `24.14.0`, but the workbench does not claim that
the npm bundled with that Node distribution has a particular patch version. That
runner-provided npm is used only to apply the root lockfile and dispatch the static
workbench scripts. The matrix package separately locks `npm@11.9.0`; after dependency
installation, CI verifies and uses
`tools/typert-version-matrix/node_modules/npm/bin/npm-cli.js`. The matrix runner also
resolves every case with this same tool-local npm CLI.

## Explicit manual network matrix

`.github/workflows/manual-typert-matrix.yml` has only a `workflow_dispatch` trigger.
The person dispatching it must choose exactly one input:

| Input | Closed configuration | Decision boundary |
| --- | --- | --- |
| `selection` | `matrix.official.json` | May report an eligible candidate for later human-reviewed mount testing. |
| `experimental` | `matrix.official-experimental.json` | Exploratory evidence only; exit code `0` is rejected as a policy violation. |

The workflow validates the selected config offline before invoking `run` with
`--lock-mode resolve`. It accepts runner exit code `0` or `1` for `selection`, and
only exit code `1` for `experimental`. Exit code `2`, a missing exit code, or any
other combination fails closed.

The runner's exit code never triggers a commit, Pull Request comment, label,
approval, merge, release, deployment, profile edit, or version change. Every
reported result still requires a person to inspect the evidence and decide whether
to perform a later isolated mount probe.

## Raw evidence artifact

The manual workflow uploads a seven-day private artifact containing an allowlist of
the run markers, canonical JSON/Markdown/JUnit reports, per-case evidence and logs,
proposed locks, and generated `typert.*` probe files. It excludes case npm caches,
`node_modules`, and the rest of each generated workspace. The runner uses the
synthetic `strict-remote-v1` fixture and an allowlisted child environment; no real
interview, profile, credential, provider response, or model output belongs in this
artifact.

## Token and action policy

Both workflows declare only:

```yaml
permissions:
  contents: read
```

Checkout does not persist credentials. The workflows do not use repository secrets,
`pull_request_target`, schedules, write permissions, or deployment environments.
Every referenced workflow action is pinned to a full commit SHA verified from its
official GitHub release:

| Action | Retained tag | Full commit SHA | Official release |
| --- | --- | --- | --- |
| `actions/checkout` | `v4.3.1` | `34e114876b0b11c390a56381ad16ebd13914f8d5` | <https://github.com/actions/checkout/releases/tag/v4.3.1> |
| `actions/setup-node` | `v4.4.0` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | <https://github.com/actions/setup-node/releases/tag/v4.4.0> |
| `actions/upload-artifact` | `v4.6.2` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | <https://github.com/actions/upload-artifact/releases/tag/v4.6.2> |

These workflows can be parsed and reviewed locally, but their GitHub-hosted behavior
is not established until the branch is pushed and the corresponding Actions runs
are observed. A local green check is not evidence that GitHub runners, caches,
artifact upload, or repository policy settings behaved as intended.
