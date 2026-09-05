# Official Typert matrix — 2026-09-02 / Darwin arm64

This directory contains the reviewed, source-free canonical outputs of two
frozen local matrix runs. The repository is private and unofficial.

## Decision

| Matrix | Run ID | Cases | Result | Exit |
| --- | --- | ---: | --- | ---: |
| Selection | `2026-09-02-hardened-frozen-selection-darwin-arm64-01` | 5 | `NO_ELIGIBLE_CANDIDATE` | 1 |
| Experimental | `2026-09-02-hardened-frozen-experimental-darwin-arm64-01` | 3 | `EXPLORATORY_ONLY` | 1 |

All eight cases completed conclusively as
`FAIL_COMPATIBILITY / GENERATION_EMPTY` at the `direct-generator` stage. In
each case the synthetic package was discovered once with its host face, but
both automatic and forced generation returned zero outputs. No case produced
the five required strict Remote artifacts.

The selection result contains no eligible candidate. The experimental result
cannot nominate a candidate by policy. Gate A therefore remains **NO-GO** for
the current strict generated-Remote architecture.

## Exact cohort results

| Case | Role | Exact DSH/Typert cohort | Automatic | Forced | Required artifacts | Status |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `typert-0.1.0-rc.6-control` | control | `0.1.0-rc.6` | 0 | 0 | 0/5 | `FAIL_COMPATIBILITY` |
| `typert-0.1.0-rc.7` | candidate | `0.1.0-rc.7` | 0 | 0 | 0/5 | `FAIL_COMPATIBILITY` |
| `typert-0.1.0-rc.8` | candidate | `0.1.0-rc.8` | 0 | 0 | 0/5 | `FAIL_COMPATIBILITY` |
| `typert-0.1.1-rc.1` | candidate | `0.1.1-rc.1` | 0 | 0 | 0/5 | `FAIL_COMPATIBILITY` |
| `typert-0.1.1-rc.2` | candidate | `0.1.1-rc.2` | 0 | 0 | 0/5 | `FAIL_COMPATIBILITY` |
| `typert-0.1.2-alpha.2` | experimental | `0.1.2-alpha.2` | 0 | 0 | 0/5 | `FAIL_COMPATIBILITY` |
| `typert-0.1.2-alpha.3` | experimental | `0.1.2-alpha.3` | 0 | 0 | 0/5 | `FAIL_COMPATIBILITY` |
| `typert-0.1.2-alpha.4` | experimental | `0.1.2-alpha.4` | 0 | 0 | 0/5 | `FAIL_COMPATIBILITY` |

`GENERATION_EMPTY` maps to the failed B03 assertion. Ordinary `lib/index.js`
bundle output was observed in every case but is deliberately non-decisive; it
cannot substitute for the required generated Host/Client Remote files.

## Reproducibility identity

Both reports bind the following shared evidence:

- runner source commit:
  `d1cb6c6cb86374748001282fd7a6bbd8675f5ad0`;
- clean worktree at run start: `true`;
- runtime: Darwin arm64, Node `24.14.0`, tool-local npm CLI `11.9.0`;
- lock mode and platform key: `frozen` / `darwin-arm64-node24-npm11`;
- fixed fixture SHA-256:
  `fb0e5cc05bad7f98043c844e88234def3397de54144783640df553af2b35bcbe`;
- reviewed eight-case manifest SHA-256:
  `6d83cdfa08ff2da1456316d39cc5bccc3febaf1aab504b81c1659e646b4e0ba9`;
- runner source-tree SHA-256:
  `edfc8aa8660d40d441c1d9974f960a5882e0c3fcaf1a56f666ac37a8630a8c49`;
- built runner JavaScript SHA-256:
  `3bd1b8bbd23021fbf164c9918f3b5f30481f300f6f1ae04abe62cdaf98b75e5c`;
- matrix-tool package-lock SHA-256:
  `d12f57522a43cff8a52e60b127f42fab50bcda11dab3ce88153e18e671540173`.

The selection run started at `2026-09-02T08:41:46.472Z` and completed at
`2026-09-02T08:43:18.925Z`. The experimental run started at
`2026-09-02T08:41:40.343Z` and completed at
`2026-09-02T08:42:45.478Z`.

## Published files and hashes

| File | SHA-256 |
| --- | --- |
| `selection-matrix.json` | `8636a13e7dbd64a593bdadfcdef79f3b7f05fd5b97143729135c56abf8ca00fc` |
| `selection-matrix.md` | `808236bf0c5af8ec5e14116ea4344791314c6cfb187bc66aa586c893056a1661` |
| `selection-junit.xml` | `8fbcecdb0fe6c522ccd42e39ca1b615703ed05a86a74ec432c74384aa033a5a5` |
| `experimental-matrix.json` | `e61069370f18ddcc24e319bcb5ea43af3fffde075cbfccf59ce263ffda4b8e81` |
| `experimental-matrix.md` | `ecdf448131112443d5f89da6dfc350ba29c975468684d57b7b793d7c5017c3c3` |
| `experimental-junit.xml` | `0434409a8e1c32f52dca942a68854d5836338382a6d62b9740eeea1da048450d` |

Both JSON reports passed the current semantic verifier. Each committed JSON
also round-tripped to identical canonical bytes, and the Markdown and JUnit
companions were regenerated in memory and matched byte for byte.

## Publication boundary

Only the canonical JSON, derived Markdown, and derived JUnit views are
retained. The repository does not retain case workspaces, npm caches, npmrc
files, process stdout/stderr, raw logs, generated source, or proposed locks from
these runs. The canonical reports state `rawSourceIncluded: false` for every
case and contain no local absolute path or credential-bearing field.

These results answer one narrow question: none of the tested exact official
cohorts generated the strict Remote artifacts required by this architecture
for the frozen synthetic fixture. They do **not** prove or disprove general
DeepSeek Harness compatibility, all possible plugin designs, installation,
mounting, UI behavior, persistence, security, model access, or coexistence
with the ripple theme. No Harness profile, port 3080 service, model, interview,
or real user data was used.
