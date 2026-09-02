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
narrow result for the currently approved third-party-plugin architecture, not
a claim that the PM Workbench product is impossible.

## Compatibility matrix

| Harness version | Static bundle/patch | Host load | Client load | strict Remote | persistence/restart | install/remove | browser E2E | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0.1.0-rc.6` | Pass | Not run | Not run | **Fail: generator emitted no artifacts** | Not run | Not run | Not run | **Gate A No-Go; downstream probes stopped** |

No handwritten descriptor, copied generated file, HTTP fallback, dynamic
Cordis fallback, protocol vendoring, or generator patch was used. Any such
change requires a new architecture decision and a fresh compatibility gate.
