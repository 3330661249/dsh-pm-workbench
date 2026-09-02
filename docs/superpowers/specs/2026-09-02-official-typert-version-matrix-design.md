# DSH PM Workbench — official Typert version-matrix runner design

**Status:** implementation design only. This document does not authorize changing the
running Harness profile, starting a server, or treating a generator-only result as full
Harness compatibility.

**Decision under test:** whether an official, exact DeepSeek Harness Typert package
cohort can generate the strict Host and Client Remote artifacts required by the approved
PM Workbench architecture when consumed by a normal out-of-tree npm workspace.

**Known control:** `0.1.0-rc.6` must reproduce the existing failure in which package
discovery succeeds but automatic and forced generation return no artifacts. A successful
ordinary TypeScript/tsdown bundle is diagnostic evidence only and can never satisfy this
matrix.

## 1. Evidence boundary

The runner proves only the **generated Remote seam**. A passing case means that the
official generator/protocol cohort is eligible for the next isolated Host/Client mount
probe. It does not prove that the corresponding Harness CLI can load the package, that
the Client can mount it, or that slots, persistence, restart, removal, or browser behavior
work.

The runner must never:

- execute `dsh`, start a web server, bind a port, or touch a Harness profile;
- read or write `~/.dsh`, the current `127.0.0.1:3080` service, or the ripple plugin;
- read a real transcript, recording, user document, API key, model response, or provider;
- accept a package tag/range such as `latest`, `next`, `^`, `~`, `*`, a Git URL, an npm
  alias, or a `file:`/`workspace:` dependency;
- use a handwritten descriptor, ambient protocol redeclaration, copied generated file,
  vendored protocol, generator patch, HTTP fallback, or dynamic Cordis fallback;
- infer success from process exit code `0`, stdout text, or the presence of an ordinary
  `lib/index.js` bundle;
- silently change the fixture, generator adapter, toolchain, registry, lockfile, or
  assertion policy between cases.

All case source code is synthetic and byte-identical. The only case variable is the
declared official dependency cohort (plus its necessary exact Cordis version). Runtime
and build-tool versions are matrix-level constants.

## 2. Initial exact matrix

The first reviewed matrix should contain the known rc.6 control and the succeeding
release-candidate cohorts. Alpha cohorts belong in a separate exploratory config and are
not eligible for automatic selection.

```json
{
  "schemaVersion": "1",
  "runtime": {
    "node": "24.14.0",
    "npmCli": "11.9.0"
  },
  "toolchain": {
    "typescript": "6.0.3",
    "tsdown": "0.22.2",
    "zod": "4.4.3"
  },
  "registry": "https://registry.npmjs.org/",
  "generatorAdapter": "workspace-v1",
  "fixture": "strict-remote-v1",
  "policy": {
    "requireAllCasesConclusive": true,
    "requireAtLeastOneCandidatePass": true
  },
  "cases": [
    {
      "id": "typert-0.1.0-rc.6-control",
      "role": "control",
      "release": {
        "@deepseek-ai/dsh": "0.1.0-rc.6"
      },
      "packages": {
        "@deepseek-ai/dsh-typert-generator": "0.1.0-rc.6",
        "@deepseek-ai/dsh-typert-protocol": "0.1.0-rc.6",
        "@deepseek-ai/dsh-invariants": "0.1.0-rc.6",
        "@deepseek-ai/cordis": "4.0.1"
      }
    },
    {
      "id": "typert-0.1.0-rc.7",
      "role": "candidate",
      "release": {
        "@deepseek-ai/dsh": "0.1.0-rc.7"
      },
      "packages": {
        "@deepseek-ai/dsh-typert-generator": "0.1.0-rc.7",
        "@deepseek-ai/dsh-typert-protocol": "0.1.0-rc.7",
        "@deepseek-ai/dsh-invariants": "0.1.0-rc.7",
        "@deepseek-ai/cordis": "4.0.1"
      }
    },
    {
      "id": "typert-0.1.0-rc.8",
      "role": "candidate",
      "release": {
        "@deepseek-ai/dsh": "0.1.0-rc.8"
      },
      "packages": {
        "@deepseek-ai/dsh-typert-generator": "0.1.0-rc.8",
        "@deepseek-ai/dsh-typert-protocol": "0.1.0-rc.8",
        "@deepseek-ai/dsh-invariants": "0.1.0-rc.8",
        "@deepseek-ai/cordis": "4.0.1"
      }
    },
    {
      "id": "typert-0.1.1-rc.1",
      "role": "candidate",
      "release": {
        "@deepseek-ai/dsh": "0.1.1-rc.1"
      },
      "packages": {
        "@deepseek-ai/dsh-typert-generator": "0.1.1-rc.1",
        "@deepseek-ai/dsh-typert-protocol": "0.1.1-rc.1",
        "@deepseek-ai/dsh-invariants": "0.1.1-rc.1",
        "@deepseek-ai/cordis": "4.0.1"
      }
    },
    {
      "id": "typert-0.1.1-rc.2",
      "role": "candidate",
      "release": {
        "@deepseek-ai/dsh": "0.1.1-rc.2"
      },
      "packages": {
        "@deepseek-ai/dsh-typert-generator": "0.1.1-rc.2",
        "@deepseek-ai/dsh-typert-protocol": "0.1.1-rc.2",
        "@deepseek-ai/dsh-invariants": "0.1.1-rc.2",
        "@deepseek-ai/cordis": "4.0.1"
      }
    }
  ]
}
```

These five aligned cohorts were independently observed on the official npm registry on
2026-09-02: `@deepseek-ai/dsh`, generator, protocol, and invariants all exist at the exact
version shown. The runner still refreshes that evidence at execution time. Registry
existence is necessary but does not prove that the installed Harness can load this plugin;
reports must say **Typert cohort**, not “Harness version compatible”, until the later
mount/profile probe passes. `@deepseek-ai/dsh` is queried as release-cohort evidence but
is deliberately not installed into this generator-only workspace, so its much larger
runtime graph cannot confound the narrow Remote-generation comparison.

If alpha exploration is requested, use a separate
`matrix.official-experimental.json`. Exact aligned npm cohorts exist for
`0.1.2-alpha.2`, `0.1.2-alpha.3`, and `0.1.2-alpha.4`; each uses Cordis `4.0.2`,
TypeScript `6.0.3`, and tsdown `0.22.2`. Do not mix their results into the
release-candidate selection policy. `0.1.2-alpha.1` has an official Git tag but
`@deepseek-ai/dsh@0.1.2-alpha.1` returned `E404` from the official npm registry, so it is
excluded rather than approximated with another package version. The runner never derives
Cordis from a peer range.

The official source trees for these tagged cohorts declare Node
`^22.19.0 || >=24.0.0` and pnpm `11.7.0`. The local consumer probe's exact Node
`24.14.0` satisfies that Node contract. It intentionally uses npm `11.9.0` because this
matrix tests normal npm package consumption and tarball packaging, not a source-monorepo
build. The report records this distinction; it does not mislabel npm as the official
source build tool.

Static review of the official rc.7-through-alpha.4 tags found no new npm-package
provenance branch in the `isTypeMetaSymbol` logic, and the sampled published protocol
declarations still were not ambient `declare module` blocks. That is a strong failure
hypothesis, not a matrix result: the runner must execute every approved exact cohort and
must not pre-classify or skip it from source similarity alone.

## 3. Repository layout

```text
tools/typert-version-matrix/
├── package.json                         # private; every dependency exact
├── package-lock.json                    # runner's own frozen graph
├── tsconfig.json
├── README.md
├── config/
│   ├── matrix.official.json
│   ├── matrix.official-experimental.json
│   └── matrix.schema.json
├── locks/
│   └── <platform-key>/
│       └── <case-id>.package-lock.json  # reviewed frozen case graph
├── fixtures/
│   └── strict-remote-v1/
│       ├── fixture.manifest.json        # SHA-256 for every fixture file
│       ├── tsconfig.host.json
│       ├── tsdown.config.mjs
│       └── packages/
│           └── probe/
│               ├── package.template.json
│               ├── tsconfig.json
│               └── src/index.ts
├── src/
│   ├── cli.ts
│   ├── types.ts
│   ├── exact-version.ts
│   ├── config.ts
│   ├── boundaries.ts
│   ├── environment.ts
│   ├── process.ts
│   ├── registry.ts
│   ├── lockfile.ts
│   ├── workspace.ts
│   ├── command-plan.ts
│   ├── adapters/
│   │   ├── index.ts
│   │   └── workspace-v1.ts
│   ├── assertions/
│   │   ├── discovery.ts
│   │   ├── generation.ts
│   │   ├── artifacts.ts
│   │   ├── descriptors.ts
│   │   └── package.ts
│   ├── run-case.ts
│   ├── aggregate.ts
│   ├── report-json.ts
│   ├── report-markdown.ts
│   └── redact.ts
└── tests/
    ├── exact-version.test.ts
    ├── config.test.ts
    ├── boundaries.test.ts
    ├── process.test.ts
    ├── lockfile.test.ts
    ├── workspace.test.ts
    ├── assertions.test.ts
    ├── aggregate.test.ts
    ├── reports.test.ts
    └── fixtures/
        ├── fake-generated-pass/
        ├── fake-empty-generation/
        ├── fake-permissive-descriptor/
        └── fake-bin/

.github/workflows/
├── typert-matrix-runner-tests.yml
└── typert-version-matrix.yml
```

Generated evidence is never mixed with source:

```text
.tmp/dsh-pm-workbench/version-matrix/runs/<run-id>/
├── run.json
├── matrix.json
├── matrix.md
├── junit.xml
└── cases/
    └── <case-id>/
        ├── workspace/                 # one complete npm workspace
        ├── npm-cache/                 # unique to this case
        ├── npmrc                      # generated public-registry config
        ├── proposed-lock/             # resolve mode only
        ├── logs/
        │   ├── registry.json
        │   ├── npm-install.stdout.log
        │   ├── npm-install.stderr.log
        │   ├── tsc.stdout.log
        │   ├── tsc.stderr.log
        │   ├── direct-generator.json
        │   ├── tsdown.stdout.log
        │   └── tsdown.stderr.log
        ├── evidence.json
        └── report.md
```

Each case gets a distinct real directory, npm cache, npmrc, node_modules, lockfile, log
directory, and process cwd. Nothing is shared except read-only fixture files and the
runner executable. Concurrency defaults to one; enabling bounded concurrency must not
change those boundaries.

## 4. Frozen synthetic fixture

`strict-remote-v1` is identical for every case and contains one direct Remote method with
both an input and output boundary:

```ts
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export interface MatrixHealthRequest {
  readonly nonce: 'matrix-v1'
}

export interface MatrixHealthResult {
  readonly ok: true
  readonly apiVersion: 'v1'
}

export class MatrixProbeService extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'matrixProbe')
  }

  @Remote
  health(_request: MatrixHealthRequest): MatrixHealthResult {
    return { ok: true, apiVersion: 'v1' }
  }
}

export default MatrixProbeService
```

The package name is always `@knight/dsh-typert-matrix-probe`, version `0.0.0`,
`private: true`, and `license: UNLICENSED`. Its public exports are fixed:

```json
{
  ".": {
    "types": "./lib/types/index.d.ts",
    "default": "./lib/index.js"
  },
  "./typert": {
    "types": "./lib/typert.host.d.ts",
    "default": "./lib/typert.host.js"
  },
  "./remote": {
    "types": "./lib/typert.remote-client.d.ts",
    "default": "./lib/typert.remote-client.js"
  },
  "./package.json": "./package.json"
}
```

For each case the runner constructs a private root manifest with
`workspaces: ["packages/*"]` and exact dev dependencies for generator, protocol,
invariants, Cordis, TypeScript, tsdown, and zod. The nested probe manifest declares the
case's exact protocol dependency and exact Cordis peer. Neither manifest contains an npm
script or a semver range. `@deepseek-ai/dsh` remains registry-only release evidence and
does not enter either manifest.

The `files` whitelist includes all five required generated files, including
`lib/typert.remote-client.d.ts.map`. The fixture manifest stores a SHA-256 for the source,
tsconfigs, tsdown config, and template manifest. The runner verifies those hashes before
creating any case. Generated artifacts must be absent before generation. This makes a
pre-seeded, copied, or stale artifact a hard failure.

The fixture is deliberately slightly stronger than the original rc.6 health-only probe:
the request and response literals allow runtime checks of both strict codecs. The rc.6
control must still reproduce the known provenance failure. Once committed, fixture v1
cannot be edited in place; any change creates `strict-remote-v2` and a separate matrix.

## 5. Configuration and exact-version rules

### 5.1 Case validation

`parseMatrixConfig()` rejects the entire run before network access if:

- `schemaVersion`, runtime, toolchain, adapter, fixture, or policy is missing;
- there is no control, no candidate, or a duplicate case id;
- a case contains any release-evidence or installed package outside its closed allowlist;
- any package or tool version is not a complete SemVer, including prerelease;
- any value contains a range operator, tag, whitespace, URL, slash path, npm alias,
  environment expansion, or command metacharacter;
- `@deepseek-ai/dsh`, generator, protocol, and invariants do not share the exact cohort
  version for the initial RC matrix;
- a case attempts to override Node, npm, TypeScript, tsdown, zod, registry, fixture, or
  adapter;
- the registry is not the literal approved HTTPS origin;
- a path resolves outside the declared matrix root or output root.

The exact-version checker should use a complete anchored SemVer parser and then require
that reserialization equals the original string. Do not “clean” or coerce input.
Case ids additionally match the fixed slug grammar
`^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$`; they never become commands or package names.

### 5.2 Registry evidence

For the release-evidence `@deepseek-ai/dsh` package and each installed direct package,
resolve the literal `<name>@<exact-version>` against
`https://registry.npmjs.org/` with the pinned npm CLI. Store only:

```ts
interface RegistryEvidence {
  readonly name: OfficialPackageName
  readonly requestedVersion: string
  readonly returnedVersion: string
  readonly integrity: `sha512-${string}`
  readonly tarballOrigin: 'https://registry.npmjs.org'
  readonly repositoryUrl?: string
  readonly observedAt: string
}
```

The returned name/version must exactly match the request; integrity must be present; the
Typert packages' repository metadata must point to the official
`deepseek-ai/deepseek-harness` repository. A missing package, mismatched version,
unexpected origin, or missing integrity is `INCONCLUSIVE_REGISTRY`, never an invitation to
try a tag or mirror.

### 5.3 Lock modes

Two explicit modes are allowed:

1. `resolve`: produce a new lock from the exact manifest, validate it, record its SHA-256
   and full installed graph, then run the case. The lock is evidence for that dated run.
   It is written under `proposed-lock/`, never silently copied into the repository.
2. `frozen`: require the reviewed platform-specific lock under `locks/<platform-key>/`,
   verify its SHA-256 if the config pins one, and run `npm ci`. CI uses this mode.

There is no fallback from `frozen` to `resolve`. A missing or mismatched frozen lock is
`INCONCLUSIVE_LOCK` and stops that case.

Platform-specific lock directories prevent an npm optional native binding resolved on
one operating system/architecture from being misrepresented as the exact graph on
another. Results always include `process.platform`, `process.arch`, lock SHA-256, and an
installed-graph SHA-256. Do not pin a Darwin Rolldown binding as a direct dependency for
a Linux CI run; let the reviewed lock capture the correct optional package.

## 6. Core interfaces

```ts
type InstalledPackageName =
  | '@deepseek-ai/dsh-typert-generator'
  | '@deepseek-ai/dsh-typert-protocol'
  | '@deepseek-ai/dsh-invariants'
  | '@deepseek-ai/cordis'

type OfficialPackageName = InstalledPackageName | '@deepseek-ai/dsh'

type CaseStatus =
  | 'PASS'
  | 'FAIL_COMPATIBILITY'
  | 'INCONCLUSIVE_REGISTRY'
  | 'INCONCLUSIVE_LOCK'
  | 'INCONCLUSIVE_ADAPTER'
  | 'INFRA_ERROR'

type CheckStatus = 'PASS' | 'FAIL' | 'BLOCKED'

interface MatrixConfig {
  readonly schemaVersion: '1'
  readonly runtime: { readonly node: string; readonly npmCli: string }
  readonly toolchain: {
    readonly typescript: string
    readonly tsdown: string
    readonly zod: string
  }
  readonly registry: 'https://registry.npmjs.org/'
  readonly generatorAdapter: 'workspace-v1'
  readonly fixture: 'strict-remote-v1'
  readonly policy: {
    readonly requireAllCasesConclusive: true
    readonly requireAtLeastOneCandidatePass: true
  }
  readonly cases: readonly MatrixCase[]
}

interface MatrixCase {
  readonly id: string
  readonly role: 'control' | 'candidate' | 'experimental'
  readonly release: {
    readonly '@deepseek-ai/dsh': string
  }
  readonly packages: Readonly<Record<InstalledPackageName, string>>
}

interface ProcessRequest {
  readonly program: ApprovedProgram
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: Readonly<Record<string, string>>
  readonly timeoutMs: number
  readonly stdoutFile: string
  readonly stderrFile: string
}

interface ProcessEvidence {
  readonly program: ApprovedProgram
  readonly args: readonly string[]
  readonly cwdToken: '<case-root>' | '<workspace>'
  readonly startedAt: string
  readonly durationMs: number
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly timedOut: boolean
  readonly stdoutSha256: string
  readonly stderrSha256: string
}

interface GeneratorAdapter {
  readonly id: 'workspace-v1'
  inspect(workspaceRoot: string): Promise<DirectGeneratorEvidence>
  normalizeHost(module: unknown): NormalizedContribution
  normalizeRemote(module: unknown): NormalizedContribution
}

interface DirectGeneratorEvidence {
  readonly discover: readonly DiscoveredPackage[]
  readonly automatic: readonly NormalizedEmitResult[]
  readonly forced: readonly NormalizedEmitResult[]
}

interface AssertionResult {
  readonly id: AssertionId
  readonly status: CheckStatus
  readonly expected: unknown
  readonly actualSummary: unknown
  readonly evidenceRefs: readonly string[]
}

interface CaseEvidence {
  readonly schemaVersion: '1'
  readonly case: MatrixCase
  readonly environment: EnvironmentEvidence
  readonly fixtureSha256: string
  readonly lockSha256: string
  readonly installedGraphSha256: string
  readonly registry: readonly RegistryEvidence[]
  readonly stages: readonly StageEvidence[]
  readonly assertions: readonly AssertionResult[]
  readonly artifacts: readonly ArtifactEvidence[]
  readonly status: CaseStatus
  readonly failure?: { readonly code: string; readonly stage: string }
}
```

`workspace-v1` is compiled runner code, not a command supplied by JSON. It imports
`WorkspaceTypertGenerator`, calls `discover(['host'])`,
`generate(undefined, ['host'])`, and
`generate(['@knight/dsh-typert-matrix-probe'], ['host'])`, then writes normalized JSON.
If a future official version changes the public API, that case is
`INCONCLUSIVE_ADAPTER`. Supporting it requires a separately reviewed adapter id; the
runner must not guess method names or fall back to internal files.

## 7. Process execution without shell composition

Every subprocess goes through one implementation:

```ts
runProcess(request: ProcessRequest): Promise<ProcessEvidence>
```

It uses `child_process.spawn(programPath, args, { shell: false, cwd, env })`. It never
uses `exec`, `execSync`, `spawnSync` with a command string, `sh -c`, `zsh -c`, `&&`, `|`,
redirection, command substitution, or arguments read from case JSON beyond validated
versions/case ids.

`ApprovedProgram` is a closed enum resolved by the runner:

- the pinned local npm CLI, invoked as `process.execPath` plus
  `tools/.../node_modules/npm/bin/npm-cli.js`;
- the case-local TypeScript binary, invoked through `process.execPath`;
- the case-local tsdown binary, invoked through `process.execPath`;
- the runner's own compiled direct-generator and assertion scripts, invoked through
  `process.execPath`.

Package manifests contain no chained npm scripts. Node orchestrates sequential stages.
Executable and bin paths are realpathed and must remain inside the runner or case
`node_modules` root. A timeout sends `SIGTERM`, waits five seconds, then sends `SIGKILL`;
timeouts are infrastructure failures, never compatibility passes.

### 7.1 Fixed subprocess argv

The command planner emits these operations; bracketed values are separately validated
argv elements, not interpolated shell text:

| Stage | Program and argv |
| --- | --- |
| Registry | pinned npm CLI: `view`, `[name]@[exactVersion]`, `--json`, `--registry=https://registry.npmjs.org/`, `--cache=[caseCache]`, `--userconfig=[caseNpmrc]` |
| Resolve lock | pinned npm CLI: `install`, `--package-lock-only`, `--ignore-scripts`, `--no-audit`, `--no-fund`, registry/cache/userconfig args |
| Frozen install | pinned npm CLI: `ci`, `--ignore-scripts=false`, `--no-audit`, `--no-fund`, registry/cache/userconfig args |
| Tree | pinned npm CLI: `ls`, `--all`, `--json` |
| Compile | case TypeScript CLI: `-b`, `tsconfig.host.json`, `--pretty`, `false` |
| Direct API | runner adapter child: `--workspace`, `[caseWorkspace]`, `--output`, `[directJson]` |
| Generate | case tsdown CLI: `--config`, `tsdown.config.mjs` |
| Pack audit | pinned npm CLI: `pack`, `--dry-run`, `--json`, `--workspace`, `@knight/dsh-typert-matrix-probe` |

No case can supply an extra flag. Registry output is parsed in memory and only the safe
fields in `RegistryEvidence` are persisted.

The child environment is constructed from an allowlist rather than inherited wholesale.
It excludes `NPM_TOKEN`, `NODE_AUTH_TOKEN`, `GH_TOKEN`, API keys, Harness variables, and
user npm configuration. `npm_config_cache` and `npm_config_userconfig` point to the
case-specific paths. The generated npmrc fixes the official registry, enables strict SSL,
and disables audit/fund/update-notifier for install determinism; a separate recorded audit
may run later but is not part of the Remote assertion. `HOME` is not reassigned.

Logs are size-bounded, written directly to files, hashed, and path-redacted in the
normalized report. Raw logs remain ignored/CI artifacts and are not committed.

## 8. Case execution algorithm

### 8.1 Global preflight

1. Parse and validate the matrix schema and every exact value.
2. Realpath the repository, tool root, fixture root, lock root, and requested output root.
3. Reject output traversal, a symlink escape, a non-empty reused run directory, or a run
   directory outside `.tmp/dsh-pm-workbench/version-matrix/runs/`.
4. Verify the complete fixture manifest and record the aggregate fixture SHA-256.
5. Verify exact Node and pinned local npm CLI versions.
6. Build a typed command plan and assert that it contains no `dsh`, server, browser,
   profile, model, user-data, port, `3080`, or arbitrary program operation.
7. Atomically create the run record with state `RUNNING`.

Any failure here aborts the whole matrix before the first registry or install call.

### 8.2 Per case

1. Create unique `workspace/`, `npm-cache/`, `npmrc`, and `logs/` directories.
2. Copy the frozen fixture without following symlinks. Render package manifests by
   constructing JSON objects and `JSON.stringify`; do not perform shell/text replacement.
3. Re-hash every non-manifest fixture file and prove the source is identical across cases.
4. Query and validate selected registry metadata for the exact release-evidence package
   and all exact installed direct packages. Do not install `@deepseek-ai/dsh` in this
   narrow generator workspace.
5. In `resolve` mode, create and validate a proposed lock; in `frozen` mode, copy and
   validate the reviewed lock. Never use `--force` or `--legacy-peer-deps`.
6. Run the pinned npm CLI `ci` with explicit argv, case cache, case npmrc, no audit, and no
   fund output.
7. Parse `package-lock.json` and `npm ls --all --json`. Require the workspace link and all
   four direct packages/toolchain packages at the declared exact versions. Record every
   installed `@deepseek-ai/*`, Cordis, TypeScript, tsdown, zod, and Rolldown binding version.
8. Delete the package `lib/` directory with a boundary-checked filesystem call, recreate
   it, and assert that none of the five generated paths exists.
9. Run TypeScript project compilation as one process.
10. Run the direct public generator adapter in a separate Node process. Capture discovery,
    automatic generation, and forced generation as JSON.
11. Assert direct results, but continue to the official tsdown plugin when safe even if
    generation is empty; this preserves the rc.6 diagnostic comparison.
12. Run tsdown as one process. Record its exit separately from TypeScript and direct
    generator results.
13. Inspect artifacts, import the generated Host and Remote modules, execute strict-codec
    assertions, and compare emitted hashes to direct-generator strings.
14. Invoke pinned npm `pack --dry-run --json` with argv and verify the five artifacts are
    in the package whitelist. Do not create or publish a tarball.
15. Write and schema-validate `evidence.json`; derive `report.md` only from that JSON.

Cases continue independently so one rc.6 failure does not suppress evidence for later
versions. No failed case proceeds to any profile/mount/UI/storage stage because those
operations do not exist in this runner.

## 9. Required assertions

A case is `PASS` only if **every** assertion below passes.

### A. Dependency and workspace assertions

- `A01`: registry name and version exactly match each release/direct request.
- `A02`: every release/direct registry record has `sha512` integrity and approved origin.
- `A03`: lock manifest versions exactly match the matrix; lock SHA-256 is recorded.
- `A04`: `npm ci` exits `0` and is not timed out/killed.
- `A05`: `npm ls --all --json` exits `0`; no missing, invalid, extraneous, or peer problem.
- `A06`: the npm workspace link exists and realpaths to `packages/probe`.
- `A07`: installed direct versions equal the exact case/toolchain values.
- `A08`: fixture source hashes equal the frozen manifest and every other case.
- `A09`: all five generated artifact paths are absent before generation.

### B. Compile and generator assertions

- `B01`: TypeScript exits `0` with zero diagnostics.
- `B02`: direct `discover(['host'])` returns exactly the probe package, package root, and
  Host face.
- `B03`: direct automatic generation returns exactly one Host result for the probe.
- `B04`: direct forced generation returns exactly the same normalized result.
- `B05`: both results contain non-empty Host JS/DTS and Remote JS/DTS/DTS-map strings.
- `B06`: the official tsdown plugin process exits `0`.
- `B07`: ordinary `lib/index.js` is recorded but explicitly marked non-decisive.

`B06` never compensates for `B03`, `B04`, `B05`, or any C/D assertion.

### C. Artifact assertions

All five paths must be regular files, not symlinks, inside the probe package, non-empty,
and newly created during the case:

1. `lib/typert.host.js`
2. `lib/typert.host.d.ts`
3. `lib/typert.remote-client.js`
4. `lib/typert.remote-client.d.ts`
5. `lib/typert.remote-client.d.ts.map`

Additional checks:

- `C06`: package exports exactly map `./typert` and `./remote` to those files.
- `C07`: generated headers identify `@deepseek-ai/dsh-typert-generator`.
- `C08`: Host/Remote file hashes match the direct generator's returned strings.
- `C09`: the source map is valid JSON, names the remote declaration, and contains no
  absolute local path.
- `C10`: npm pack dry-run includes all five files and excludes node_modules, caches,
  tests, `.tmp`, credentials, logs, and absolute paths.

### D. Strict descriptor assertions

After importing each file with a unique query string:

- `D01`: Host exports `TYPERT`; `package` is the exact probe package and `face` is `host`.
- `D02`: Host has exactly one `matrixProbe/health` invocation and no unexpected method.
- `D03`: Remote exports `TYPERT_REMOTE`, default export has object identity with it, and
  `package` is exact.
- `D04`: Remote has exactly one `matrixProbe/health` descriptor and no unexpected method.
- `D05`: Host and Remote method ids/service/namespace/method fields agree.
- `D06`: the request parameter codec has `mode: 'strict'`, a non-empty `typeSymbol`, and a
  schema with `safeParse`.
- `D07`: the result codec has the same strict properties.
- `D08`: request schema accepts `{ "nonce": "matrix-v1" }` and rejects a wrong literal,
  missing nonce, array, string, and null.
- `D09`: result schema accepts `{ "ok": true, "apiVersion": "v1" }` and rejects false,
  wrong/missing version, array, string, and null.
- `D10`: lookup of `matrixProbe/unknown` returns no descriptor/invocation; the exact method
  inventory is compared rather than merely searching for one desired method.

This validates actual generated schemas and prevents an empty, broad, or permissive
descriptor from passing. It does not claim transport-level unknown-method rejection;
that belongs to the later mount/registry test.

## 10. Status, aggregation, and stopping rules

### 10.1 Case status

- `PASS`: every A-D assertion passed.
- `FAIL_COMPATIBILITY`: the exact official graph installed and the case ran, but compile,
  discovery, generation, artifacts, packaging, or strict descriptors failed.
- `INCONCLUSIVE_REGISTRY`: exact public-package metadata could not be verified.
- `INCONCLUSIVE_LOCK`: the case graph could not be frozen or did not match its manifest.
- `INCONCLUSIVE_ADAPTER`: the official public API is different from the explicitly
  supported adapter.
- `INFRA_ERROR`: timeout, signal, disk/permission error, corrupt report, or runner defect.

An inconclusive/infra result is never converted to compatibility failure or success.

### 10.2 Within-case stopping

- Stop the case before install on registry/lock/integrity failure.
- Stop before compile if `npm ci`, dependency-tree, workspace-link, version, or fixture
  assertions fail.
- Stop generator stages when TypeScript cannot produce the declared inputs.
- If direct discovery/generation is empty but TypeScript succeeded, still run the approved
  tsdown generation once to capture the known rc.6 comparison; do not run any other
  workaround.
- If tsdown fails, inspect only whatever safe artifact evidence exists; do not import a
  missing/non-regular/out-of-boundary file.
- On the first artifact/descriptor assertion failure, retain the remaining independent
  read-only checks where safe, but final status remains failed.
- Never retry with another registry, dist-tag, package range, adapter, compiler flag,
  protocol layout, or hand-authored artifact.

### 10.3 Whole-run stopping and exit codes

- Abort all cases before network if global config, fixture, runtime, adapter, command-plan,
  or path-boundary preflight fails.
- Continue other cases after an ordinary per-case compatibility failure.
- Exit `0` only when every enabled case is conclusive (`PASS` or
  `FAIL_COMPATIBILITY`), reports validate, and at least one `candidate` is `PASS`.
- Exit `1` when the run is structurally complete but no candidate passes.
- Exit `2` for any global error, inconclusive case, infrastructure error, or invalid
  report. This prevents a partial matrix from becoming an architecture decision.

The control is observational: its failure does not make the overall run fail, but it must
execute conclusively. If rc.6 unexpectedly passes, report the change; do not suppress or
rewrite it as an expected failure.

Even with exit `0`, the report's decision is `ELIGIBLE_FOR_NEXT_ISOLATED_MOUNT_PROBE` and
`humanDecisionRequired: true`. The runner never updates the PM Workbench peer range,
installs a profile, modifies 3080, or declares Gate A complete.

## 11. Structured reports

`matrix.json` is canonical. Each Markdown report is generated only from validated JSON so
the two cannot disagree. Writes use a temporary sibling plus atomic rename; a JSON schema
validation failure makes the run exit `2`.

The aggregate JSON contains:

- schema version and run id;
- matrix config, fixture, lock, and runner commit hashes;
- UTC timestamps and durations;
- OS/architecture, exact Node/npm, and CI metadata;
- selected safe registry metadata and direct dependency graph;
- every process exit/signal/timeout plus log hashes;
- direct discovery/automatic/forced normalized results;
- every assertion, expected value, safe actual summary, and evidence reference;
- generated artifact relative paths, sizes, and SHA-256 values;
- case status and typed failure code;
- eligible candidate ids, incomplete cases, aggregate exit reason, and explicit statement
  that the result does not prove full Harness compatibility.

Markdown contains a compact matrix followed by per-case failures:

| Typert cohort | Role | Install | Discover | Auto generate | Forced generate | 5 artifacts | Strict codecs | Pack | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

The ordinary bundle outcome appears in a separate “non-decisive diagnostics” column or
note, never in the pass calculation.

Normalized JSON/Markdown replace local absolute paths with `<repo>`, `<run-root>`, and
`<case-root>`. They do not include raw stdout/stderr, environment values, npm credentials,
home paths, or registry response bodies. Raw logs remain local/short-lived CI artifacts.

## 12. Commands

Commands are intentionally separate; none uses shell chaining.

### Runner verification

```bash
npm --prefix tools/typert-version-matrix ci
npm --prefix tools/typert-version-matrix run typecheck
npm --prefix tools/typert-version-matrix test
node tools/typert-version-matrix/dist/cli.js validate --matrix tools/typert-version-matrix/config/matrix.official.json
```

### First local exact-resolution run

```bash
node tools/typert-version-matrix/dist/cli.js run --matrix tools/typert-version-matrix/config/matrix.official.json --lock-mode resolve --output .tmp/dsh-pm-workbench/version-matrix/runs/local-rc-matrix
node tools/typert-version-matrix/dist/cli.js verify-report --input .tmp/dsh-pm-workbench/version-matrix/runs/local-rc-matrix/matrix.json
```

### Frozen CI/local replay

```bash
node tools/typert-version-matrix/dist/cli.js run --matrix tools/typert-version-matrix/config/matrix.official.json --lock-mode frozen --platform-key linux-x64-node24-npm11 --output .tmp/dsh-pm-workbench/version-matrix/runs/ci-rc-matrix
node tools/typert-version-matrix/dist/cli.js verify-report --input .tmp/dsh-pm-workbench/version-matrix/runs/ci-rc-matrix/matrix.json
```

The CLI rejects an existing/non-empty `--output` directory. A new run id must use a new
directory; evidence is immutable after finalization.

## 13. Test suite

The runner's own tests execute without Harness, a profile, real data, or network except
for a separately marked registry smoke test.

1. Accept exact stable/prerelease SemVer; reject ranges, tags, aliases, URLs, file/workspace
   specs, whitespace, coercible partial versions, and command metacharacters.
2. Reject duplicate ids, unknown package names, missing roles, mixed DSH cohorts, per-case
   toolchain overrides, and unapproved adapters/registries.
3. Reject `..`, absolute-path injection, output reuse, and symlink escape for fixture,
   locks, workspace, logs, artifacts, and reports.
4. Prove `runProcess` always uses `shell: false`, typed argv, bounded logs, timeout/kill,
   and an environment without token/API/Harness variables.
5. Prove two cases receive different workspace/cache/npmrc/node_modules/log paths.
6. Fail on fixture hash drift and prove copied case source is byte-identical.
7. Fail closed on missing frozen lock, manifest/lock mismatch, altered lock SHA, wrong
   platform lock, missing workspace entry, missing integrity, and unexpected direct
   version.
8. Reproduce the original evidence defect: `npm ls` failure or a missing workspace link
   stops the case even when external packages are installed.
9. Prove `tsc=0` and `tsdown=0` plus zero generated files results in
   `FAIL_COMPATIBILITY` with `ARTIFACT_MISSING`.
10. Fail discovery on empty, wrong package/root, missing Host face, or extra package.
11. Fail automatic/forced generation on empty, disagreement, wrong face/package, missing
    Remote strings, or an adapter exception.
12. Reject pre-seeded artifacts, artifact symlinks, zero-byte files, wrong headers,
    out-of-boundary source maps, and hashes that do not match direct output.
13. Reject missing/wrong exports and dry-run packages that omit one artifact or include
    forbidden files.
14. Reject missing `TYPERT`/`TYPERT_REMOTE`, empty arrays, wrong package/face/method,
    unexpected extra methods, different Host/Remote ids, permissive codec modes, missing
    schemas, valid payload rejection, or malformed payload acceptance.
15. Prove unknown method inventory fails if any unexpected method exists.
16. Prove deterministic JSON and Markdown for fixed timestamps; schema validation catches
    disagreement or missing evidence.
17. Prove reports contain no absolute repo/home path and redact token-shaped environment
    values.
18. Aggregation: control fail + all candidates fail => exit `1`; control fail + one
    candidate pass + all cases conclusive => exit `0`; any inconclusive/infra/corrupt
    report => exit `2`; no case can pass from ordinary build alone.
19. Snapshot the command plan and prove it contains no `dsh`, profile, server, browser,
    model, user data, or port operation.

An optional registry smoke test verifies one exact known package using a temporary isolated
cache. It is not part of unit tests and must label network failures inconclusive.

## 14. CI design

`typert-matrix-runner-tests.yml` runs on pull requests that modify the runner/config and:

- checks out read-only source;
- sets up the exact Node version;
- installs the runner from its lockfile;
- asserts the pinned local npm CLI version;
- runs typecheck and all offline unit/fixture tests;
- uses no repository secrets.

`typert-version-matrix.yml` is initially manual (`workflow_dispatch`) and:

- has `contents: read` permissions only;
- uses frozen case locks and an explicitly named platform key;
- sets a job timeout and one-case-at-a-time default;
- writes only under the job workspace `.tmp` directory;
- uploads `matrix.json`, `matrix.md`, JUnit, and bounded logs with `if: always()`;
- returns the runner's `0/1/2` status after artifact collection;
- never starts Harness, Chrome, a service container, or a listening port;
- never passes `GITHUB_TOKEN` or repository secrets into the runner's child environment.

Action references must be pinned to reviewed commit SHAs when implemented. CI on Linux
proves the generator matrix on that platform only; before selecting a cohort for the
user's Mac, run the same fixture with a reviewed Darwin lock and record a separate result.
Do not merge OS results into a single unqualified “compatible” claim.

## 15. Acceptance and next decision

Implementation of this design is complete only when:

- runner unit tests pass;
- the rc.6 control conclusively reproduces the known empty-generation/missing-artifact
  result from a correct npm workspace install;
- all requested candidates produce conclusive results in independent directories/caches;
- JSON and Markdown agree and validate;
- protected ripple hashes remain unchanged;
- no Harness profile, 3080 service, model, browser, or real data was touched.

If no candidate passes, preserve the complete matrix and return to the architecture choice
between a narrowly pinned generator fork and a sidecar/dynamic seam. Do not broaden a
version range or start UI work.

If one or more candidates pass, report them only as **Remote-generation eligible**. The
owner must choose one exact cohort. A new Gate A probe then has to install a tarball into an
isolated `DSH_HOME`, use a non-3080 port, prove Host load, Client mount, strict transport,
and lifecycle removal, and rerun the adversarial review before the PM Workbench target
version changes.
