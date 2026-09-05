# Compatibility baseline and probe outcome

Recorded on 2026-09-02 for the isolated `DSH PM Workbench v0.1` technical
probe.

## Local target

| Item | Observed value |
| --- | --- |
| Operating system | macOS |
| User model | single user |
| Harness profile | local Web profile |
| Browser target | Chrome |
| Harness target | `0.1.0-rc.6` |
| `dsh --version` | `0.1.0-rc.6` |
| `node --version` | `v24.14.0` |
| `npm --version` | `11.9.0` |

GitHub `master` was reference material only and is not this package's
compatibility contract.

## What was verified

- The private static package has rc.6-shaped nested `dsh.bundle` and
  `dsh.client` metadata.
- Its patch is a single additive `insert`; an isolated rc.6 `--dump-config`
  parsed it and appended the `dsh-pm-workbench` row.
- The Client build emits a `window.__ModuleLoader__.load(...)` wrapper.
- Typecheck, 6 static/boundary tests, build, package inspection, and a nine-file
  pack dry run passed. A pristine copy preserving the repository/plugin layout
  also passed offline `npm ci`, typecheck, all six tests, and build without a
  pre-existing `.tmp` directory.
- The locked development dependency tree has no `0.1.0-rc.8` references and
  the final npm audit reported zero known vulnerabilities.

These checks prove only the static skeleton and patch shape. They do not prove
the package can load or mount in a running Harness profile.

## Strict Remote failure

The required rc.6 Typert probe discovered the workspace package, but both
automatic and forced generation returned an empty artifact list. The ordinary
Host bundle built successfully while all five strict Host/Remote Typert files
remained absent. A second copy with a normalized npm workspace installation
reproduced the same result.

The independent review traced the failure to rc.6 protocol-symbol provenance:
the generator does not accept the resolved declarations from a normal
npm-installed `@deepseek-ai/dsh-typert-protocol@0.1.0-rc.6` package. This is a
narrow result for the then-approved generated-Typert architecture, not
a claim that the PM Workbench product is impossible.

## Official Typert version matrix

The later hardened frozen matrix used the same five-file synthetic Remote
fixture for eight exact official cohorts. It ran from clean commit
`d1cb6c6cb86374748001282fd7a6bbd8675f5ad0` on Darwin arm64 with Node
`24.14.0` and tool-local npm `11.9.0`. Every reviewed lock and installed graph
matched the eight-case manifest before compatibility assertions ran.

| Harness version | Static bundle/patch | Host load | Client load | strict Remote | persistence/restart | install/remove | browser E2E | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0.1.0-rc.6` | Pass for the original rc.6 static check | Not run | Not run | **Fail: automatic 0, forced 0, artifacts 0/5** | Not run | Not run | Not run | control failed |
| `0.1.0-rc.7` | Not run | Not run | Not run | **Fail: automatic 0, forced 0, artifacts 0/5** | Not run | Not run | Not run | candidate failed |
| `0.1.0-rc.8` | Not run | Not run | Not run | **Fail: automatic 0, forced 0, artifacts 0/5** | Not run | Not run | Not run | candidate failed |
| `0.1.1-rc.1` | Not run | Not run | Not run | **Fail: automatic 0, forced 0, artifacts 0/5** | Not run | Not run | Not run | candidate failed |
| `0.1.1-rc.2` | Not run | Not run | Not run | **Fail: automatic 0, forced 0, artifacts 0/5** | Not run | Not run | Not run | candidate failed |
| `0.1.2-alpha.2` | Not run | Not run | Not run | **Fail: automatic 0, forced 0, artifacts 0/5** | Not run | Not run | Not run | experimental only; failed |
| `0.1.2-alpha.3` | Not run | Not run | Not run | **Fail: automatic 0, forced 0, artifacts 0/5** | Not run | Not run | Not run | experimental only; failed |
| `0.1.2-alpha.4` | Not run | Not run | Not run | **Fail: automatic 0, forced 0, artifacts 0/5** | Not run | Not run | Not run | experimental only; failed |

The five-case selection report concluded `NO_ELIGIBLE_CANDIDATE` with no
incomplete case. The three alpha cases concluded `EXPLORATORY_ONLY`; they were
ineligible for selection by policy and also failed the same B03 generation
assertion. The canonical JSON, Markdown, JUnit and exact hashes are in
[`matrix-results/2026-09-02-darwin-arm64/`](matrix-results/2026-09-02-darwin-arm64/).

This is not a general compatibility claim. No tested cohort was loaded into
Harness, mounted in a profile, exercised in the browser, or tested with storage.
The result only rejects the historically specified strict generated-Remote path for
this fixed fixture. Gate A remains **NO-GO**.

No handwritten descriptor, copied generated file, bare/private webServer HTTP fallback, dynamic
Cordis fallback, protocol vendoring, or generator patch was used. Any such
change requires a new architecture decision and a fresh compatibility gate.

## Current architecture decision: Connection RPC design

On 2026-09-02, the owner selected a different boundary for specification:

```text
public Connection RPC
+ shared strict Zod endpoint schemas
+ Host-owned state
+ WorkbenchTransport migration seam
```

This decision does not change any matrix observation above and does not turn
the historical generated-Typert Gate A into a pass. The proposed Connection RPC
combination has not yet been loaded from this third-party tarball, called from
its Client, connected to `storageDomain`, restarted, removed, or exercised in a
browser. Its replacement Gate A′ is **Not run**.

The current design and its exact evidence boundary are recorded in
[`superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md`](superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md).
