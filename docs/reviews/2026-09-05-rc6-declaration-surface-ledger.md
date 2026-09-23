# DeepSeek Harness rc.6 declaration surface ledger

## Review scopes and current status

### Task 1: compiler RED setup only

- Stage: A′-P1a, Task 1.
- Result: `RED_SETUP_ONLY`.
- Source baseline: `bd0ae743e0c490b5aa770eccae3dd77d325e9a48`.
- Task 1 execution baseline: `756c48be052705b0f62d69d7e9789700eb7f94aa`.
- The original dispatch base `6ed1006dfa0db7ea771c9d36ccb0a8bf3b6ac7f7`
  was followed by two documentation-only corrections before this RED was
  recorded: the isolated contract path and the Cordis asynchronous disposer
  contract.

This is dependency-absence setup evidence. It is not a declaration-surface
PASS and does not prove RPC behavior, slot behavior, lifecycle behavior,
plugin loading, browser behavior, persistence, or Harness compatibility.

### Task 2: static and local historical observations

- Stage: A′-P1a, Task 2.
- Committed result: `CHANGES_REQUIRED_REVIEW` /
  `INPUT_MANIFEST_V2_PENDING_B2` because the committed input is schema v1.
- Latest B2b stage output: `PASS_STAGED_RC6_DECLARATION_INPUT_V2`.
- Latest replay output: `PASS_STAGED_REPLAY`.
- Publication outputs: first `PUBLISHED`, then `ADOPTED_EXISTING`; these are
  execution results, not persistent status fields.
- Promotion: `PENDING_LEGACY_BRANCH_DECISION_AND_EXPLICIT_PROMOTION` (ledger
  label). Before promotion, the separate legacy branch must be reviewed and
  then hardened, replaced, or disabled.
- The committed input remains schema v1. A schema-v2 real local proposal has
  been staged and the final code/diff reviews passed, but it is not accepted
  until the legacy-branch decision and an explicit promotion step; the
  historical observations alone do not approve Task 2.

## Immutable contract bytes

Tasks 2 through 4 must use these four files without changing their bytes.

| Path | SHA-256 |
| --- | --- |
| `tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts` | `8848b3635b4962dee538a3609af574c69b34a2ca001cb0b44edc327bff0c3f90` |
| `tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts` | `3280e7b2c45861d5258e398e9a60e9e96d2664fa7207086c6a3eec76508defe4` |
| `tsconfig.surface.host.json` | `85320fca37cdfcb0e4712d35e14249ed681489d78bfa29f1fdc532562c4ee093` |
| `tsconfig.surface.client.json` | `5063d26fe852412fdc5659d16d2e0cf312e88415126360c63221c50f9f7735ea` |

Hash command, exit code `0`:

```bash
shasum -a 256 tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts tsconfig.surface.host.json tsconfig.surface.client.json
```

## RED execution

### Reviewed compiler-toolchain input

The frozen contracts/configs retain `types: []`, `paths` remains absent, and
`typeRoots` remains absent. Both root RED and accepted-root GREEN use the same
final `--types node` command-line argument. This selects only the reviewed root
compiler-toolchain input below; it does not add a local module declaration or a
Harness closure member.

| Toolchain package | Version | Root-lock integrity |
| --- | --- | --- |
| `typescript` | `6.0.3` | `sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==` |
| `@types/node` | `24.13.3` | `sha512-Dh8vAsV36ig5wa9OX4pXvMc9D3Veibfw2wix0CUwYODLD8nkj9UsLjASr49nPg+2eKzxhBV+v7L8pXvT4e639Q==` |
| `undici-types` | `7.18.2` | `sha512-AsuCzffGHJybSaRrmr5eHr81mwJU3kjw6M+uprWvCXiNeN9SOGwQ3Jn8jb8m3Z6izVgknn1R0FTCEAP2QrLY/w==` |

The serialized identities are version/integrity based and contain no local
path. Task 3 must separately materialize exactly the two Node ambient packages
for arbitrary-path replay; it must not copy the root `node_modules` wholesale,
include them in the Harness closure, or introduce `paths`/`typeRoots`.

### Anti-bypass guard

Command, exit code `0`:

```bash
npm test -- tests/contract/rc6-declaration-contract-guard.test.ts
```

Observed result: one test file and all 30 guard tests passed. Before the first
guard hardening, the added bypass table produced the expected RED result: 15
failures out of 26 tests. An independent review then found parenthesized and
aliased `require` escapes; their two added tests failed out of 29 before the
second correction. The same review requested an element-access regression; its
isolated form failed once out of 30 before the third correction. The corrected
guard then passed all 30 tests and the repository's normal typecheck.

The guard rejects local Harness declarations, the TypeScript `any` token, all
type assertions, non-null and definite-assignment assertions, suppression
directives, triple-slash references, export-from declarations, import type
expressions, dynamic imports, CommonJS loading, import-equals declarations,
private or copied import paths, imports outside each contract's exact allowlist,
non-strict or extra compiler settings including `noCheck`, aliases, and
contract-file crossover. It also pins the required Host and Client declaration
shapes. String literals containing words such as `any` or `@ts-ignore` are
covered as non-bypass controls and remain allowed.

### Host compiler

Command, exit code `2`:

```bash
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit --types node
```

Observed diagnostics:

```text
TS2882 Cannot find module or type declarations for side-effect import of '@deepseek-ai/dsh-client-connection'.
TS2307 Cannot find module '@deepseek-ai/dsh-client-connection' or its corresponding type declarations.
TS2339 Property 'connection' does not exist on type 'Context'.
```

`TS2339` is the expected downstream consequence of the missing Connection root
module: its official Host declaration is the source of the Cordis
`Context.connection` augmentation. No private path, copied declaration,
implicit-any diagnostic, cast, or suppression was used.

### Client compiler

Command, exit code `2`:

```bash
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit --types node
```

Observed diagnostics:

```text
TS2882 Cannot find module or type declarations for side-effect import of '@deepseek-ai/dsh-client-ui-layout/client'.
TS2882 Cannot find module or type declarations for side-effect import of '@deepseek-ai/dsh-client-ui-sidebar/client'.
TS2307 Cannot find module '@deepseek-ai/dsh-client-connection/client' or its corresponding type declarations.
TS2307 Cannot find module '@deepseek-ai/dsh-client-runtime/client' or its corresponding type declarations.
```

The RED directly names these absent packages:

- `@deepseek-ai/dsh-client-connection`;
- `@deepseek-ai/dsh-client-runtime`;
- `@deepseek-ai/dsh-client-ui-layout`;
- `@deepseek-ai/dsh-client-ui-sidebar`.

`@deepseek-ai/dsh-client-ui-slots` is not imported directly by either immutable
contract, so dependency absence does not produce a separate compiler diagnostic
for it. Its exact closure and locality remain Task 2 acceptance work.

## Reviewed declaration fact

`OFFICIAL_CLIENT_CONTEXT_CONNECTION_AUGMENTATION_ABSENT`

The binding design's reviewed rc.6 public declarations show that the
Connection `/client` entrypoint exports `ConnectionHandle` and
`ClientConnectionRpc` directly, while the Host root declaration supplies the
Cordis Host `Context.connection` augmentation. The Client contract therefore
uses a direct `ConnectionHandle` value and does not claim `ctx.connection` on
`ClientContext`. This fact is recorded from the reviewed public declaration
entries; the missing-package RED is not itself proof of their installed bytes.

## Task 1 historical safety boundary

This paragraph applies only to the Task 1 RED commands above. The later B2b
section records its own different boundary, including an owned disposable
offline npm replay, a Demo-test loopback listener, and regenerated build output.

No Harness process, profile, browser, listener or port, workbench tgz,
production manifest, storage package, model, credential, user session, or real
data was used. No package was installed, no network request was made, and
`~/.dsh` was not accessed. Root and workbench manifests, lockfiles, production
source, build output, and package contents were not modified.

## Task 2: frozen declaration input acceptance

- Stage: A′-P1a, Task 2.
- Result: `CHANGES_REQUIRED_REVIEW`.
- The committed input remains schema v1. The prior observations remain below,
  and the later B2b section records a staged schema-v2 proposal; neither is an
  accepted Task 2 result without final review and explicit promotion.
- Input label: `local-2026-09-05-rc6-declaration-lock-v1`.
- The accepted metadata contains no candidate or source-cache absolute path.
  It records only path-free lock identities, public registry URLs, package
  integrity values, and Node/npm file identities.
- The root package and lock hashes are respectively
  `208bae9d2b2c0d67b2fa6b985d394cc1ce483e3a5cd226e391ca0a6b7f261cd1`
  and
  `dde74c404cfbf8e7b1ec7cabece36d2aa2061f256770570f69c15f3064061ad1`.
  The latter contains 169 registry entries: 59 `@deepseek-ai/*` entries and
  54 `@deepseek-ai/dsh-*` entries, all at `0.1.0-rc.6`.
- The exact nested placement is
  `node_modules/katex/node_modules/commander` for
  `commander@8.3.0` under `katex`.
- The accepted selected cache has exactly 169 content records and 169 index
  records below its npm cache `_cacache` root, totaling 9,590,214 bytes. Its
  canonical selected-index SHA-256 is
  `26ace684b811eed1aff8627aaaf072f346a5a9983676ac5d4607a2690b09e001`;
  the ordered content-digest/byte-length aggregate SHA-256 is
  `63bffdc2c83e9df4863cb19655a53857fe2e3ce61f3f085168b45593d2b02194`.
  Every copied record was checked against lock integrity and size, public
  registry URL, and the absence of sensitive request/response header names
  before the complete npm cache root (including its `_cacache` subtree) was set
  read-only.
- Recorded local tool identities are Node `v24.14.0` (`node`, SHA-256
  `9e831e9b13aa47c5e5eaa3904d232aa527124e8abba7ca5d72b67b46cfb10ae8`)
  and npm `11.9.0` (`npm-cli.js`, SHA-256
  `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7`).
  These values bind the Node executable and npm CLI entry file; they do not
  recursively seal every additional JavaScript file loaded from the npm
  installation.

### Acceptance and replay commands

The command below completed with exit code `0`. It copies only the selected
cache records, makes that `_cacache` read-only, writes separate log/temp
directories, and invokes the pinned npm CLI entry with empty user/global npm
config:

```bash
node scripts/accept-rc6-declaration-input.mjs
```

Its direct npm invocation is equivalent to:

```bash
node npm-cli.js ci --ignore-scripts --offline --audit=false --fund=false --update-notifier=false --cache=declaration-input-cache --prefix=accepted --logs-dir=declaration-input-logs --userconfig=user-npmrc --globalconfig=global-npmrc
```

`node scripts/verify-rc6-declaration-closure.mjs --write` then completed with
exit code `0`. It verified installed package realpaths remain below the accepted
root, rejected undeclared/nested/duplicate placements, revalidated all selected
cache bytes, and wrote the canonical closure JSON. The closure records all 59
reachable `@deepseek-ai/*` packages and the five selected declaration roots;
its file SHA-256 is
`4f7a28fd8a84fed7a20a6dbd2c1412f8b341397e19c04298bd959318d9af198c`.

### Type and static evidence

- `npm test -- tests/integration/rc6-declaration-input.test.ts tests/integration/rc6-declaration-dependency-boundary.test.ts` exited `0`: 2 files,
  3 passed and 1 mutually-exclusive local-absence skip. The local replay branch
  ran and passed here.
- `npm test -- tests/contract/rc6-declaration-contract-guard.test.ts` exited
  `0`: 1 file and all 30 tests passed.
- Both copied immutable contracts compiled with the same final command-line
  arguments used by RED: `tsc -p accepted/tsconfig.surface.host.json --noEmit
  --types node` and `tsc -p accepted/tsconfig.surface.client.json --noEmit
  --types node`, each exit `0`. The reviewed TypeScript/Node ambient toolchain
  above is explicit; it did not alter frozen config bytes, add a package to the
  accepted root, or add a Harness closure member.
- The four Task 1 hashes in the immutable-contract table above were recomputed
  after acceptance and remain unchanged.

### Boundary and unresolved status

- `PASS_STATIC_METADATA` and `PASS_LOCAL_REPLAY` are local declaration-input
  facts only. The reviewed fact remains
  `OFFICIAL_CLIENT_CONTEXT_CONNECTION_AUGMENTATION_ABSENT`.
- No storage package is selected, imported, typechecked, or executed by this
  Task; a storage package may appear only as an unselected transitive record in
  the full closure.
- Fresh resolution status remains `FAIL_FRESH_RESOLUTION_RC8_ERESOLVE` from the
  approved preflight record and was not retried: this task is frozen local
  acceptance, not a new resolver experiment.
- This work does not prove dsh/Harness runtime compatibility, loading,
  lifecycle, RPC, slot behavior, a port/listener, browser/profile behavior,
  persistence, storage behavior, model behavior, credentials, real-data
  handling, or package distributability. No such process or capability was
  invoked in Task 2.

### B1 static-metadata P1 correction

Task 2 remains `CHANGES_REQUIRED_REVIEW`. The v2 static inspector now binds raw accepted-input bytes and the fixed production boundary before a static PASS; it does not treat the existing v1 historical diagnostics as approval. While the committed manifest remains v1, the public acceptance API and CLI stop before candidate/cache/root mutation and return only the path-free `CHANGES_REQUIRED_REVIEW` / `INPUT_MANIFEST_V2_PENDING_B2` condition. This is not an offline-install, replay, or Harness result.

### B1 second-review correction

The parsed accepted package JSON and full lockfile are now bound by recursive UTF-8-key canonical SHA-256 values before lock projection, covering top-level, root-record, and non-root metadata drift. Inspector schema handling is fail-closed: only string `"1"` (pending) and `"2"` (fully validated before static PASS) are supported. Task 2 remains `CHANGES_REQUIRED_REVIEW`. During the requested three-file focused suite, a pre-existing local-replay-eligible test invoked its verifier branch and passed `PASS_LOCAL_REPLAY`; that observation is historical/local only and does not authorize B2, acceptance, or a Harness claim.

### B1 third-review correction

The parsed-input freeze now uses a strict manual canonical JSON-byte serializer rather than reconstructed objects and ordinary JSON serialization. It orders object keys by UTF-8 bytes, preserves dense array order, rejects invalid JSON-domain values and unpaired surrogates, and is the sole canonicalizer for the accepted package/lock parsed-object hashes. The constants changed only because that byte encoding changed: package JSON `ec3d67e9…f593f`, package lock `d99f9a20…ecd1`. Public CLI failure output is allowlisted, path-free `{status, reasonCode}` JSON with nonzero exit and empty stderr; schema1 retains its exact pending response. Task 2 remains `CHANGES_REQUIRED_REVIEW`.

### B1 fourth-review correction

Task 2 remains `CHANGES_REQUIRED_REVIEW`. This correction did not execute B2, acceptance, npm/cache work, the verifier, boundary tests, Harness, or network activity, and did not generate a v2 manifest. Initial RED command `npm test -- tests/integration/rc6-declaration-input.test.ts` exited `1`: 99 tests collected, 16 failed, 83 passed. It exposed cyclic stack overflow, descriptor and Proxy ambiguity, getter-read risk, and CLI fallback that mislabeled v2 validation as `INPUT_READ_FAILED`. A final mapping-completeness RED then collected 100 tests with one failure: `PRODUCTION_BOUNDARY_SYMLINK` incorrectly became the generic internal result. The identical suite then passed 100/100. `npm run typecheck`, `node --check scripts/accept-rc6-declaration-input.mjs`, whitespace checks, and all four frozen SHA-256 checks passed.

The canonical serializer now uses an active `WeakSet` to reject direct/indirect cycles while allowing repeated shared acyclic references. It rejects Proxies before inspection and uses `Reflect.ownKeys` plus descriptors only, allowing object data properties and exact standard array indices while never executing getters. Symbol, hidden, accessor, sparse, extended, and non-standard array states fail. Valid parsed bytes remain unchanged, so the frozen canonical hashes remain package JSON `ec3d67e9…f593f` and package lock `d99f9a20…ecd1`. `fail` now gives errors a stable `code`; public mapping has explicit schema and validation mismatch allowlists, and unknown internal errors map only to `FAIL_INPUT_INTERNAL` / `UNEXPECTED_INPUT_ERROR`, with a nonzero, stderr-empty, path-free CLI result.

### B1 fifth-review correction

Task 2 remains `CHANGES_REQUIRED_REVIEW`; no B2 work, real acceptance/cache operation, npm, verifier, boundary test, Harness, or network activity ran. One synthetic CLI fixture intentionally exercised the public pre-mutation gate: its candidate root was absent and it stopped before candidate reads or target-path writes. RED command `npm test -- tests/integration/rc6-declaration-input.test.ts` exited `1`: 110 tests collected, 7 failed, 103 passed. It proved the dynamic cache/runtime filesystem codes had no public mapping, the synthetic v2 missing-candidate-root CLI result was generic internal, and the source-helper/registry tests were absent. The same suite then passed 110/110; `npm run typecheck`, Node syntax, whitespace, and all frozen-hash checks passed.

All literal and dynamic owned failure codes now have one exported registry-backed public classification. `ENOENT` is converted at its source by regular-file/directory helpers, while `assertDirectoryEmptyOrAbsent` retains its explicit absent-target allowance. Selected cache reads now report `MISSING_CACHE_INDEX`, malformed index JSON reports `INVALID_CACHE_INDEX_JSON`, and content lstat/read races report `MISSING_CACHE_CONTENT`. Production-boundary tree/list and expected-file disappearance now report stable production codes. Tests mechanically check every static `fail` literal plus registered dynamic code, exact candidate-root CLI JSON before mutation, and temporary-fixture cache source failures. Truly unregistered errors remain `FAIL_INPUT_INTERNAL` / `UNEXPECTED_INPUT_ERROR`.

### B1 sixth-review correction

Task 2 remains `CHANGES_REQUIRED_REVIEW`; no B2, real acceptance/replay, npm/cache operation, verifier, boundary test, Harness, or network activity ran. Synthetic v2 CLI fixtures exercised only the pre-mutation gate and stopped before selected-cache reads or target-path creation. Initial RED `npm test -- tests/integration/rc6-declaration-input.test.ts` collected 118 tests with 6 failures; the final registry de-duplication RED collected 119 with 7 failures, including five duplicate public-mismatch entries. GREEN passed 120/120. `npm run typecheck`, `node --check`, whitespace checks, frozen hashes, and the direct schema-v1 CLI all passed their expected outcomes; the direct CLI exited `1` with only `CHANGES_REQUIRED_REVIEW` / `INPUT_MANIFEST_V2_PENDING_B2` JSON.

`realpathWithStableMissingCode` now converts only `ENOENT`, including dangling symlinks, to the supplied owned code. Candidate source cache, npm CLI, and Node executable resolution use `INVALID_SOURCE_CACHE`, `INVALID_NPM_CLI`, and `INVALID_NODE_EXECUTABLE` respectively; other I/O remains internal. `MISSING_CACHE_INDEX` is now dynamic-owned. The registry contains each dynamic code once and is spread into the mismatch registry only once. Temporary fixtures assert missing and dangling source cache/npm CLI paths produce exact path-free CLI JSON and leave cache, accepted root, log, and temp targets absent.

## Task 2 B2a — selected read-only source and cache snapshot primitives

- Current status remains `CHANGES_REQUIRED_REVIEW`; this is implementation and synthetic-fixture evidence only. No historical cache, npm, real acceptance/replay, verifier, boundary test, Harness, or network command ran.
- RED command: `npm test -- tests/integration/rc6-declaration-input.test.ts` exited `1`: 131 collected, 11 failed, 120 passed. The new append-log/snapshot/prepare surface was absent. Its initial terminal failures were additionally masked by an `EACCES` cleanup defect in the new read-only temporary fixture; the fixture was corrected to restore write permission only beneath its own `rc6-b2a-cache-*` temporary root before cleanup. No workspace or historical-cache path was touched.
- GREEN: the input suite passed 131/131; `npm run typecheck` and `node --check scripts/accept-rc6-declaration-input.mjs` passed. Append-log parsing validates SHA-1(JSON) for every nonempty physical line, selects the last matching live record, rejects checksum corruption/tombstones/wrong integrity as stable errors, and freezes the selected bucket as exact `LF + selected line` bytes with no trailing newline.
- `snapshotSelectedCache` uses nofollow opens, validates selected key/integrity/public URL/headers/size/SHA-512 content, records raw index/content identity including mode/dev/ino/nlink, and has strict exact-inventory mode for extras, missing paths, symlinks, special files, writable entries, and hardlinks. Source snapshots are deliberately nonexact and record identity for S0/S1 comparison; staged cache snapshots are exact/read-only.
- Synthetic `prepareSelectedSource` creates only a same-parent unique incoming directory, copies three candidate inputs and selected cache files through nofollow/exclusive file handles, writes a path-free v2 descriptor with `_cacache`, validates source S0=S1 and staged exact cache, chmods files `0444` and directories `0555`, then atomically renames. Existing final roots are refused; failure cleanup is containment-checked and limited to its own incoming directory. Test-only lock-model/failure injection is an exported-function argument and is not CLI reachable.

### B2a rewrite correction — pointer/bundle protocol (synthetic only)

The preceding B2a paragraph describes a superseded fixture prototype and is not
evidence for the current production protocol. Task 2 remains
`CHANGES_REQUIRED_REVIEW`. The replacement uses a fixed consumer pointer at
`.tmp/dsh-pm-workbench/declaration-input-source.json` and creates an exclusive,
high-entropy bundle directory under the canonical workspace-local
`declaration-input-source-bundles` parent. It does not publish by renaming a
staging directory. The synthetic core writes selected bytes already captured
through nofollow reads, changes bundle files to POSIX read-only modes, writes a
canonical path-free receipt, verifies it, writes a canonical read-only pointer
temporary, and uses `link` as the one-way visibility point. A stable preexisting
pointer is read without following symlinks and is never overwritten.

The new focused RED command was `npm test --
tests/integration/rc6-declaration-input.test.ts -t 'fixture-only bundle
preparation'`, exit `1`, with both new tests failing because
`prepareSelectedSourceFixtureCore` did not exist. The focused GREEN passed
2/2. The full input suite then passed 131/131; `node --check
scripts/accept-rc6-declaration-input.mjs` and `npm run typecheck` exited `0`.
This used only temporary one-record cache fixtures. It did not read/copy the
historical cache, create the real stable pointer, invoke npm, acceptance,
replay, verifier, boundary tests, Harness, or network activity.

The present core still needs a dedicated review for the full 169-record
production path, descriptor/header leakage scan, full receipt inventory/cleanup
race matrix, and two-producer recovery scenarios. It claims POSIX mode
read-only only; it makes no ACL, immutable-bit, crash-durability, or hostile
same-user-process guarantee.

### B2a-R1 data-source correction

Status remains `CHANGES_REQUIRED_REVIEW`. This synthetic-only R1 correction
adds explicit append-log policy: malformed checksum/JSON/null/other-key records
are ignored; the final valid matching object wins; keyed tombstone or integrity
mismatch is a miss; CRLF is rejected rather than normalized; physical index
files and individual physical lines have fixed byte bounds. The selected-only
reader uses nofollow descriptors with pre/post identity comparison and does not
recursively inventory the source cache; an unreadable unrelated canary is not
read or serialized. `prepareSelectedSource({ workspaceRoot })` now rejects
unknown fields before candidate access. This is not evidence for the complete
169-record cohort or R2 publication/cleanup concurrency.

### B2a-R1b complete synthetic public-path correction

Status remains `CHANGES_REQUIRED_REVIEW` pending final independent review. The
public `prepareSelectedSource({ workspaceRoot })` path was exercised with a
complete synthetic cache shaped from all 169 frozen lock records. It returned
only `status`, `pointer`, and `descriptor`; the independently decoded
publication contained exactly 169 minimal index files, 169 content files, 341
ordinary bundle files, and 9,590,214 selected content bytes. Descriptor,
receipt, owner marker, payload inventory, file modes, content integrity, and
path-free serialization were recomputed outside the production verifier.

The source-cache root, workspace, pointer parent, bundle parent, bundle root,
and selected index/content ancestor chains are opened or rechecked as bound
directories. Selected files and final inventory files are read through held
descriptors with pathname identity checks before and after the read. Existing
source-root and workspace-ancestor symlinks are rejected, and invalid source
input fails before the publication bundle parent is created. These checks catch
pre-existing symlinks and replacements that persist across an observation;
they do not close every pathname race against a continuously hostile process
running with the same user privileges.

### B2a-R2 publication and recovery correction

The stable consumer pointer is created with one no-overwrite hard-link
visibility step after its bundle, descriptor, receipt, and read-only pointer
temporary have been verified. Recovery first verifies an existing stable
publication against the current candidate and complete lock-derived content,
so it does not need the original source cache after a successful first
publication. A valid existing publication is adopted without overwriting it;
two cooperative producers converge on one bundle, and a protocol-shaped
`nlink=2` crash residue is reduced to `nlink=1` only after exact inode, name,
mode, bytes, bundle, and receipt verification.

Two test-only link wrappers cover ambiguous completion without changing the
production API. One throws a non-`EEXIST` error before calling the real link and
proves `POINTER_COMMIT_FAILED`, removal of only the producer-owned bundle/temp,
and preservation of foreign canaries. The other calls the real filesystem
link, observes source and stable pointer as the same inode with `nlink=2`, then
throws; production re-probes that inode, preserves the published bundle,
verifies it, removes the temporary alias, and returns PASS with the same stable
inode at `nlink=1`. This is JavaScript-layer fault injection around a real
hard-link operation, not evidence that a particular kernel will return that
error after committing a link.

Verification results on the final code before independent review:

- `node --check scripts/accept-rc6-declaration-input.mjs`: exit `0`;
- `npm run typecheck`: exit `0`;
- `vitest run tests/integration/rc6-declaration-input.test.ts`: 194/194
  passed;
- `vitest run`: 19/19 files, 306 passed and 1 conditional local-input skip;
- `npm run build`, `npm run verify:package`, and `npm run pack:dry`: exit `0`;
- all four frozen declaration/configuration hashes and the raw accepted
  package/lock hashes remained unchanged.

This is still synthetic preparation and static/declaration evidence. It did
not read or prepare the real historical cache, run an accepted-cache npm
replay, install or load the workbench in Harness, start Harness, use a browser
or profile, access credentials or real data, or use the network. The protocol
claims cooperative local POSIX no-overwrite visibility and tested process-level
recovery only. It does not claim directory-entry `fsync`/power-loss durability,
network-filesystem behavior, ACL or immutable-bit protection, or resistance to
a continuously hostile same-user TOCTOU process.

### Auxiliary current-platform relocation regression

`standalone-copy.test.ts` now copies 75 exact, sorted, self-contained source
files and the current platform's already installed root `node_modules` tree to
another absolute path. It rejects selected symlinks, symlink ancestors,
non-file leaves, escaping dependency symlinks, destination extras, inherited
environment state, and the injected canary plus original source-root values in
the child environment, command output, and fixture tree. A separate unit check
proves rebuilt error messages/stacks omit its representative repository,
fixture, canary, and forbidden-environment values. This is a fixed-value
regression, not a generic secret or absolute-path detector. Vitest runs with
`--no-cache`, so its results do not mutate the copied dependency inventory.
The five standalone tests passed; the full relocated sequence ran typecheck,
tests, build, package verification, and dry packing.

This auxiliary result is deliberately narrower than Task 3. It uses a copied
preinstalled dependency tree and `npm` resolved through the explicit child
`PATH`; it does not run `npm ci`, consume the accepted selected cache, invoke a
fixed accepted npm CLI entry identity, or materialize only the separate compiler
toolchain. It is therefore not clean-clone evidence, accepted frozen-input
offline replay, dependency installation evidence, cross-platform portability,
or Task 3 PASS. Its ordinary-file inventory uses pathname pre/post checks, not
the production bundle reader's same-descriptor identity chain, and it makes no
hostile same-user race guarantee.

### B2a final review correction

Two independent read-only reviews found no remaining P0 or P1 in the synthetic
169-entry publication/recovery protocol or its narrowed standalone regression.
The reviews prompted and then confirmed three corrections: publication
allocation/write failures now map to operational internal results rather than
input mismatch; ten unreachable superseded reason codes are no longer public;
and `ADOPTED_EXISTING` cleanup failure does not trigger a second cleanup from a
stale bundle path. The public schema, mismatch, and operational registries are
individually duplicate-free and mutually disjoint. Focused regressions and the
final 194-test input suite passed after these changes.

Task 2 as a whole still remains `CHANGES_REQUIRED_REVIEW`: this review closes
the synthetic B2a implementation slice only. It does not create a v2 accepted
real input, satisfy Task 3, perform accepted-cache replay, or establish Harness
runtime/plugin compatibility. No later stage starts automatically.

## Task 2 B2b — initial real local offline proposal staging (superseded)

This section preserves the first real B2b run and its diagnostic trail. Later
P1 review found that its receipt did not bind the actual TypeScript file lists
and that several verifier reads could block on pre-existing special files. The
proposal and verification counts in this section are therefore historical and
were superseded by the final P1 correction below.

Task 2 B2b now has a real, workspace-local proposal, but it is still a proposal
and not an accepted input or a Harness compatibility result. This run did not
start DeepSeek Harness, load or install a plugin, access a profile, account,
model, conversation, credential, browser, or real user document, push a remote
branch, create a pull request, or merge. The npm invocation was constructed with
the exact `--offline` policy and an isolated selected-cache bundle; there was no
packet-level network observation, so this evidence does not claim observed zero
network traffic.

The earlier pre-v2 source pointer and bundle were reversibly moved to
`declaration-input-source.superseded-pre-v2-20260906.json` and
`declaration-input-source-bundles.superseded-pre-v2-20260906` before the
no-overwrite publisher created the complete current 169-record source. The live
bundle is
`declaration-input-source-bundles/bundle-4d20027b7b3fb8d8093979d83e6ad553`.
Its receipt SHA-256 is
`984a8a417df4b7a4349ee306304ae90266c58cd25876d22b0fcba04f551cfb1d`;
the selected index SHA-256 is
`73e76d127ab8188d8005e4becb750bbe9cfec30988e501185b13558f4c6cd3f6`;
the selected content aggregate SHA-256 is
`3a8c2e3ba2bb7e07d3cc51212e9ae3dd4925e522d9c9c87acac16fee122757dc`.
Independent inventory counted 169 minimal index files, 169 content files, 341
ordinary files in total, and 9,590,214 selected content bytes. A second source
preparation adopted the same stable pointer instead of overwriting it.

The first real stage attempt failed closed with `COMPILER_OUTPUT_ESCAPE` during
the client declaration compile and published no proposal. The compiler had
resolved four declaration files from the workspace ancestor: React global and
index declarations, PropTypes, and `csstype`. The failed replay was isolated as
`.cleanup-replay-1abbcb8cf5014438cf575faa1593da44-f661c9e50b2953c1`.
That replay was later changed manually only for diagnosis, so it is not final
PASS evidence.

The correction expands the sealed compiler input from three to six exact local
package trees: TypeScript, Node types, `undici-types`, React types, PropTypes,
and `csstype`. Its independently recomputed source aggregate is
`44535345dd7a3448bac9206c60ad352f67c265708d410c4c5e20dad0de83d943`.
The client compile now uses a replay-local canonical overlay containing only
relative mappings for `react`, `prop-types`, and `csstype`; its SHA-256 is
`ccc1578a3ed59a72264d3d468af7968b2a0771b693875d9ea9ee8fda4b1a2d24`.
A separate diagnostic TypeScript 6.0.3 replay reported zero diagnostics, 388
listed files, zero files outside the replay, and all four formerly escaping
declarations beneath its `.compiler` tree. That manually amended diagnostic
tree was not sealed; the later real stage separately passed the production
compiler seal and locality checks.

After the final production-source self-hash was recomputed and stamped, the
three-file focused command passed 247 tests with one conditional skip. The
first real `stageRc6DeclarationInputV2({ workspaceRoot })` then returned
`PASS_STAGED_RC6_DECLARATION_INPUT_V2`, `PASS_STAGED_REPLAY`, and `PUBLISHED`.
The second identical invocation returned the same two PASS statuses and
`ADOPTED_EXISTING`, pointing to the same bundle:
`rc6-declaration-v2-proposal-bundles/bundle-71f0e6586bdba7ffd4c7c04912c0621c`.

Independent post-publication inspection, separate from the publisher, found:

- stable proposal pointer SHA-256
  `3b54b34d9843f9859f7c89957292b4b3e14f32a8e45efdfb4f2877a361639e0`,
  mode `0444`, and link count 1;
- receipt SHA-256
  `af979f8398e2906a34d10ba9f9434f1f7a31546ff7a5c65173d6a83cd6c7d8df`,
  exactly matching the pointer;
- input manifest SHA-256
  `e898299fd2b19f1195bc6402b6c00c95aa7bcdc52ee3d3dd513a0f4d1ba5eaa7`
  and closure SHA-256
  `19bfda32be5b62ea7097704015ff8640b420c36b65682de85e77914ae819c8a0`,
  both exactly matching the receipt;
- sealed compiler aggregate
  `ddf98666210bbd9325c3902b7ab0718543ee4a37bc0c8a376e71bede4d3fe14a`
  and verifier-result SHA-256
  `1d3c401ea2a7207927d159178b7b54a504eae2d562bb2a812d091fe381dc59bb`;
- receipt owner and payload identity recomputation matched; the bundle directory
  was mode `0555`, all four bundle files were mode `0444` with link count 1,
  and recursive JSON-value inspection found no local absolute-path or file-URI
  string;
- the input and closure agreed on 169 registry packages, 59 DeepSeek packages,
  and 54 DSH packages; `input-manifest.v2.json.compilerToolchain` contained
  exactly six source package lock-path/version/integrity identities, while the
  sealed copies were persistently bound by their aggregate hash.

One initial full-suite attempt in the restricted sandbox produced 355 passes,
one conditional skip, and two non-product failures: the sandbox denied a
loopback listener with `EPERM`, and the relocation test's 120-second outer
timeout expired while its relocated child was itself running the enlarged full
suite. The loopback test passed when rerun with local loopback permission. The
relocation test timeout was raised to 600 seconds without removing or weakening
any assertion because its nested full suite alone now takes more than 200
seconds. The final full-suite result is recorded below after the clean rerun.

This evidence supports the two frozen Host/Client rc.6 declaration contracts,
the selected local cache cohort, exact offline npm policy, declaration compiler
locality, verifier result gating, and recoverable cooperative POSIX proposal
publication. It does not establish clean-clone installation, arbitrary future
declarations,
cross-platform behavior, hostile same-UID pathname-race resistance, network
filesystem or power-loss durability, or DeepSeek Harness runtime/plugin
compatibility. Task 2 is ready for final code review only after the clean full
suite, build/package checks, and final diff review below pass.

### B2b pre-final verification (superseded by P1 corrections)

The clean serial rerun used `npm test -- --maxWorkers=1`; the elevated rerun was
authorized for the Demo test's loopback-listener need. It exited `0`: all 20
test files passed, with 357 tests passed and one conditional
`SKIP_ACCEPTED_CACHE_OR_ROOT_ABSENT` local-input skip. The
arbitrary-path relocation test passed in 224.839 seconds; its fixed manifest
now contains 77 unique sorted source files, including the new filesystem-safety
test and strict-umask child helper. The relocated child completed its own
typecheck, no-cache test suite, build, package verification, dry pack, source
and dependency identity rechecks, environment/output leak checks, and
containment checks.

After that full run, the main workspace also passed `npm run typecheck`, Node
syntax checks for the acceptance script, verifier, and strict-umask child,
`npm run build`, `npm run verify:package`, `npm run pack:dry`, and
`git diff --check`. Package verification returned `status: verified` and
reported a nine-file package inventory. Dry packing reported the filename
`knight-dsh-pm-workbench-0.1.0.tgz`, 2.5 kB package metadata, and 5.2 kB of
unpacked content; because this was `npm pack --dry-run`, no archive was written.
The final normalized acceptance-source stamp is
`e6d7171a0c15a68623a5e83e0c05351abb12307fe48e5ab9c701f32226f36abd`
and independently recomputed to the same value before the real stage.

The deterministic write-fault review also identified one non-blocking P2 for
future hardening: an exclusive internal pointer temporary can be left behind
if its writer fails after `open(O_EXCL)` but before it returns the temporary
identity to its caller. A safe future correction must retain the original file
handle, delete only a still-single-linked path with matching `dev`/`ino` under
the bound parent, and distinguish an unprovable cleanup from the original write
failure. This does not affect the successful real proposal or the tested
cooperative-producer convergence paths, and it is not being presented as
hostile same-UID race resistance.

## Task 2 B2b — final P1 correction and current proposal

The initial proposal pointer and bundle parent were reversibly moved to
`.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.superseded-pre-storage-proof-20260906.json`
and
`.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal-bundles.superseded-pre-storage-proof-20260906`.
They were not deleted or reused as current evidence.

The final correction closes three fail-closed gaps before publication. First,
the verifier's JSON reader and selected-cache byte readers now preflight ordinary,
single-linked files, use `O_NOFOLLOW | O_NONBLOCK`, bind file-descriptor and
pathname identities before and after reading, enforce containment and size
bounds, and reject writable selected-cache files or writable/symlinked selected
ancestor directories. Real FIFO regressions cover the verifier's generic JSON
reader, accepted package and lock inputs, and selected cache content. The
legacy local result now says `selectedCacheReadOnly` rather than claiming that
unrelated cache content was inspected.

Second, before execution the pinned Node version/basename/hash and npm CLI
basename/hash, together with both bound file identities, are checked. After
`npm --version`, both entries are rebound and rechecked, and the reported npm
version is compared with its pin. A real fake-CLI test proved that an initially
unpinned same-name script is rejected before it can create its sentinel; a
separate post-execution drift test proved that a pinned test fixture which
changes itself is rejected on the second check.

Third, both declaration compiles now inspect every actual `tsc --listFiles`
entry. Each entry must resolve inside the replay, the expected Host or Client
contract must be present, duplicates are rejected, and exact path segments for
`@deepseek-ai/dsh-storage` and `@deepseek-ai/dsh-storage-domain` are rejected.
The receipt persists a Host/Client summary without local absolute paths and its
canonical hash; tests cover both surfaces, nested storage paths, similar
non-storage names, and receipt field/hash/extra-key drift.

After final source-hash stamping, the focused three-file command exited `0`:
263 tests passed and one `SKIP_ACCEPTED_CACHE_OR_ROOT_ABSENT` conditional test
was skipped. The current acceptance/verifier tooling sources are bound as
follows:

- normalized acceptance source SHA-256:
  `3caf3ab49fe4b79c7ce703411e95f3d3af625a4a8ad96a10d77427dfd2972d56`;
- raw acceptance source SHA-256:
  `cdc9cf615112ce88d1f03bf4ad7c0758ebf4630f972e2b3bd0b52e58943aecba`;
- verifier source SHA-256:
  `1cd80842bb5b1d8b6b74d9a818bdd827d85a3e0e1e63003e665864ce28096a37`.

The first corrected real stage returned
`PASS_STAGED_RC6_DECLARATION_INPUT_V2`, `PASS_STAGED_REPLAY`, and `PUBLISHED`.
The second returned the same stage/replay statuses and `ADOPTED_EXISTING` for
the same current bundle:
`rc6-declaration-v2-proposal-bundles/bundle-70f3488f0d24bf62341f7e46270f3e0b`.

Independent post-publication inspection and canonical recomputation found:

- stable pointer SHA-256
  `3041c72f98fca0360677819894e02eab3ff323adc6314a3aeea6ab5041a24409`,
  mode `0444`, link count 1;
- receipt SHA-256
  `e7262509100cf9360d55412ad45a03f1f6b5b342a5fc6e08ba2e65faf41419d0`,
  exactly matching the pointer;
- unchanged input-manifest SHA-256
  `e898299fd2b19f1195bc6402b6c00c95aa7bcdc52ee3d3dd513a0f4d1ba5eaa7`
  and closure SHA-256
  `19bfda32be5b62ea7097704015ff8640b420c36b65682de85e77914ae819c8a0`,
  exactly matching the receipt;
- compiler-result SHA-256
  `96ef092029819624f0a4a62510bd03f3c7a56cfb1498fa751b64872451b48bc7`,
  independently equal to the canonical Host/Client result object;
- the receipt records a Host compile of 314 replay-relative files, list SHA-256
  `87d56f0335888cc23448e38faf98b5b016f39279814cb9b9b6c92ba91d88874c`;
- the receipt records a Client compile of 388 replay-relative files, list SHA-256
  `71086ce76394f560d5e1819d74442d5df0337bac5489e97cbe3f2f745ea26d35`;
- the publisher code enforces contract presence, all realpaths inside the
  replay, and no listed declaration beneath either exact storage package. The
  full `--listFiles` lists were intentionally not persisted, so their counts
  and list hashes are receipt-bound stage outputs rather than post-cleanup
  independently rehashable evidence;
- the owner, payload identity, input/closure hashes, and compiler-result hash
  independently matched; the pointer mode/link count, bundle-directory mode,
  and all four bundle-file mode/single-link checks passed; recursive JSON-value
  inspection found no local absolute path or file URI.

The fixed selected source, input/closure payload, compiler-source aggregate
`44535345dd7a3448bac9206c60ad352f67c265708d410c4c5e20dad0de83d943`,
sealed-compiler aggregate
`ddf98666210bbd9325c3902b7ab0718543ee4a37bc0c8a376e71bede4d3fe14a`,
and verifier-result SHA-256
`1d3c401ea2a7207927d159178b7b54a504eae2d562bb2a812d091fe381dc59bb`
remain unchanged and are rebound by the corrected receipt.

This is the current staged proposal, not a committed schema-v2 input and not a
Harness plugin/runtime PASS. Explicit promotion remains pending. Promotion
must also review, harden, replace, or disable the separate legacy acceptance
branch: after a future schema-v2 promotion that branch would become reachable,
and its older candidate-cache reads, npm install timeout policy, and legacy
closure-writer destination handling are outside this B2b stage proof. No
promotion, Harness action, remote operation, or later stage starts
automatically.

### Current final verification after all corrections

The final serial suite, run after the three fail-closed corrections and the
standalone-manifest update, exited `0` in 467.83 seconds:

- 20 test files passed;
- 373 tests passed;
- one conditional accepted-cache test was skipped;
- the arbitrary-absolute-path standalone relocation test passed in 239.728
  seconds.

Fresh post-suite checks all exited `0`:

- `npm run typecheck`;
- syntax checks for the acceptance script, verifier, and strict-umask proposal
  child;
- `npm run build`;
- `npm run verify:package`, which returned `status: verified` and reported a
  nine-file package inventory;
- `npm run pack:dry`, which reported
  `knight-dsh-pm-workbench-0.1.0.tgz`, 2.5 kB packed, 5.2 kB unpacked, and nine
  files without writing a tarball;
- `git diff --check`.

These are repository and proposal-preflight results only. They do not prove
installation, load/unload behavior, a live Harness session, compatibility with
an arbitrary Harness release, or schema-v2 promotion.

Two final independent read-only reviews of the current diff, ledger, and local
proposal reported zero P0 and zero P1 findings. The evidence review also found
no remaining overstatement. Their PASS closes this B2b review gate only; it
does not approve the separate legacy branch or perform the explicit schema-v2
promotion.

## Task 2 B2c — legacy writer retirement and regenerated current local proposal

As of repository HEAD
`14180b8f5b1a9c7deb0b6f03d6d2ca8c97b594cc`, the preceding section titled
“Task 2 B2b — final P1 correction and current proposal” is preserved byte for
byte as historical evidence, but its use of “current” is now superseded. This
section records the replacement local proposal after both legacy writer entry
points were disabled. It does not supersede the earlier evidence by deletion
or rewrite.

The retirement was developed through explicit RED/GREEN gates. The corrected
legacy-policy RED produced 13 intended failures, 227 existing passes, and one
conditional skip. After the production retirement and the separately reviewed
verifier-pin fixture update, the focused two-file GREEN produced 240 passes and
one conditional skip. The `proposalStage` schema change first produced four
intended failures and three passes, then its full input-file GREEN produced 234
passes. The macOS alias-path regression first made all five direct closure-CLI
argv cases resolve incorrectly with blank output; after the canonical-entry
guard fix, the same filter produced five passes and eight unrelated skips. Its
fresh companion checks also produced 23 file-safety passes, 234 input passes,
and 12 dependency-boundary passes with one conditional skip.

Independent read-only reviews passed the final Task 1 policy tests, Task 2
production retirement, Task 3 schema semantics, Task 4 source identities, and
Task 4a alias-path correction. The updated cumulative pre-publication review at
`14180b8` reported no P0, P1, or P2 findings and explicitly closed the earlier
alias-path P2 before the real stage. These reviews approve the reviewed code
and the decision to use the explicit stage API; they are not a promotion or a
Harness-runtime result.

The two retained legacy API names are now argument-blind rejecting
compatibility shims with stable errors:

- `acceptRc6DeclarationInput(_options)` throws
  `LEGACY_ACCEPT_DISABLED` before reading its argument or filesystem;
- `writeCommittedDeclarationClosure(_options)` throws
  `LEGACY_CLOSURE_WRITE_DISABLED` before reading its argument or filesystem.

For an intended direct invocation, every argv variant of the first legacy CLI
emits the pretty JSON serialization, plus one final newline, of
`{"status":"FAIL_INPUT_POLICY","reasonCode":"LEGACY_ACCEPT_DISABLED"}`;
every argv variant of the second emits the corresponding fixed object
`{"status":"FAIL_CLOSURE_POLICY","reasonCode":"LEGACY_CLOSURE_WRITE_DISABLED"}`.
Both policies exit `1`, leave stderr empty, contain no caller-supplied path or
error detail, and preserve the surrounding fixture bytes. Neither legacy API
or CLI writes proposal evidence, writes a committed closure, or forwards into
`stageRc6DeclarationInputV2`.

Before replacement staging, the prior pointer and bundle parent were moved by
reversible filesystem renames to fixed, previously absent destinations:

- `.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.superseded-pre-legacy-disable-20260906.json`;
- `.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal-bundles.superseded-pre-legacy-disable-20260906`.

The independent audit found the archived pointer and archived bundle distinct
from the replacement objects. The archived bundle remains
`bundle-70f3488f0d24bf62341f7e46270f3e0b`; its directory was mode `0555`, link
count 6, and its four expected files were regular, non-symlink, mode `0444`,
link count 1. The archived pointer was mode `0444`, link count 1. Its four
historical hashes remain exactly unchanged:

| Archived object | SHA-256 |
| --- | --- |
| pointer | `3041c72f98fca0360677819894e02eab3ff323adc6314a3aeea6ab5041a24409` |
| receipt | `e7262509100cf9360d55412ad45a03f1f6b5b342a5fc6e08ba2e65faf41419d0` |
| input manifest | `e898299fd2b19f1195bc6402b6c00c95aa7bcdc52ee3d3dd513a0f4d1ba5eaa7` |
| closure | `19bfda32be5b62ea7097704015ff8640b420c36b65682de85e77914ae819c8a0` |

The stage implementer then invoked only
`stageRc6DeclarationInputV2({ workspaceRoot })` twice. The first returned
`PASS_STAGED_RC6_DECLARATION_INPUT_V2`, `PASS_STAGED_REPLAY`, and `PUBLISHED`;
the second returned the same two PASS statuses and `ADOPTED_EXISTING`. The two
returned path triples were byte-for-byte identical and named:

`rc6-declaration-v2-proposal-bundles/bundle-0f5e4867db1a4a9d9aa806b43d10d8f7`.

Those two transient publication statuses are implementer-observed facts from
the stage report. The independent auditor did not rerun or claim to witness the
two calls; it instead reconstructed the immutable state they left behind and
reported `TASK 5 EVIDENCE AUDIT PASS` with no P0, P1, or P2 findings.

The current pointer is
`.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json`, and the current bundle
is
`.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal-bundles/bundle-0f5e4867db1a4a9d9aa806b43d10d8f7`.
The independent reconstruction found the replacement pointer canonical, with
exactly four keys and one final newline, as a regular non-symlink file of mode
`0444`, link count 1. The current bundle parent was a non-symlink directory of
mode `0700`, link count 3; the bundle itself was a non-symlink directory of mode
`0555`, link count 6, with exactly four entries and no extra file:

| Current object | Size | Mode | Links | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| pointer | 317 | `0444` | 1 | `339bb78040d2c4b189388f6f05d32459d88dd697cdcf00efb7f3facd230640b5` |
| `.owner` | 32 | `0444` | 1 | `fae3f964d7634d1a89bc633fe8e61f71ca1c0f0df26c62d4bf424a050aed95eb` |
| `input-manifest.v2.json` | 86,226 | `0444` | 1 | `5bd085fd661cb6888c347927b1796a3d488dcf55e8d0b17f57a7b54d0407af65` |
| `rc6-declaration-closure.v2.json` | 32,540 | `0444` | 1 | `c65c5fc8afbfd7e8a4c949d6c6a4b9b88297daa4f01178bea802949a1a8ef0c4` |
| `receipt.json` | 2,723 | `0444` | 1 | `c5ee85f114aa0c3254420c6cf0f3ebfba743886b5f453671b1c604dbd7e50422` |

The pointer's `receiptSha256` equals the exact receipt bytes; the receipt binds
the exact input and closure hashes in the table. The `.owner` bytes are
`ae2b3dbf146b009fcc58529b997772e8`, equal to the receipt owner marker. The
actual payload inventory equals the receipt payload, and its independently
recomputed identity is
`4f14cc3d1ca3ff6c88e41e1457e9b8bbe7fc43cbce02e3a24a980a67eca7876b`.
The receipt result is exactly `PASS_RC6_DECLARATION_V2_PROPOSAL`.

The independently reconstructed source, compiler, verifier, and policy
identities are:

| Identity | SHA-256 |
| --- | --- |
| raw acceptance source | `8fe7c0d2fdf05912d8b6ddcac812462c3c9bd59e255bdedc283f6a4b94c5a6a5` |
| normalized acceptance self-hash | `fbe0fc9584762866f0daab302a03b6683157267e2dc6dc2a9f12d716f4d3be98` |
| raw verifier source | `a0b9b11ad0ca1e8cf2fe79b7c127a5de1418329970ffca174d8b510e9b213329` |
| compiler source aggregate | `44535345dd7a3448bac9206c60ad352f67c265708d410c4c5e20dad0de83d943` |
| sealed compiler aggregate | `ddf98666210bbd9325c3902b7ab0718543ee4a37bc0c8a376e71bede4d3fe14a` |
| canonical compiler-result object | `96ef092029819624f0a4a62510bd03f3c7a56cfb1498fa751b64872451b48bc7` |
| verifier result | `1d3c401ea2a7207927d159178b7b54a504eae2d562bb2a812d091fe381dc59bb` |
| npm policy | `d25abf25f3cf9206bc6ad3da9c02392dee5a4565ae022fd1f44f9ad91c48944e` |
| compile policy | `30acc54a153ee1ed016f6b79becb3b1fddd011dd27d7f2fab33ef0aeef207700` |

The input manifest has no top-level `acceptance` key. Its exact top-level stage
claim is limited to:

```json
{
  "command": "stageRc6DeclarationInputV2({ workspaceRoot })",
  "result": "PASS_STAGED_RC6_DECLARATION_INPUT_V2"
}
```

The serialized input contains none of `PASS_ACCEPTED_INPUT`,
`PASS_OFFLINE_INSTALL`, or `--verify-and-compile`.

The selected-source publication was also independently rebound rather than
accepted from the proposal receipt. Its current bundle is
`declaration-input-source-bundles/bundle-4d20027b7b3fb8d8093979d83e6ad553`;
its pointer SHA-256 is
`f69456bcf8ab1d10726244d9c4bd3399ca8bf39998d5e577412e5e65f9c4bc4f`,
its receipt SHA-256 is
`984a8a417df4b7a4349ee306304ae90266c58cd25876d22b0fcba04f551cfb1d`,
its owner marker is `3c797d9ab85d6ebcc1ff5f2b207deb12`, and its independently recomputed
924-record payload identity is
`02aee7170134447b46777e1f5d923ad6a99500bc4d39313779c858412f079a7d`.
The bound selection remains 169 packages and 9,590,214 content bytes.

A recursive scan visited 1,797 structured string values across the current
pointer, receipt, input manifest, and closure. It found zero `/Users/`,
`/private/`, `file:` URI, Windows drive-absolute, or UNC-path hits.

The canonical persisted `compileResults` object and its top-level hash are
independently reconstructible. Its receipt records a Host summary of 314
replay-relative files with list hash
`87d56f0335888cc23448e38faf98b5b016f39279814cb9b9b6c92ba91d88874c`
and a Client summary of 388 with list hash
`71086ce76394f560d5e1819d74442d5df0337bac5489e97cbe3f2f745ea26d35`.
However, the full `tsc --listFiles` arrays were not persisted. Their semantic
truth, the associated execution booleans, and those exact counts/list hashes
remain stage-bound observations unless the compiles are rerun. Likewise, the
first-run `PUBLISHED` and second-run `ADOPTED_EXISTING` events are transient
stage-report observations rather than two events reconstructible from the
final bundle.

This B2c artifact is still a local, pending-review proposal. Task 6 full-suite
verification and final reviews remain separate gates, and an explicit future
promotion remains required. Nothing in this section is a promoted or committed
schema-v2 input, a DeepSeek Harness runtime/load/unload check, an installation,
a packet-level network observation, a push, or a pull request.

### Task 2 B2c — final verification

The first `npm test -- --maxWorkers=1` run inside the restricted sandbox
reported 18 passing and two failing test files, with 377 tests passed and one
conditional skip. The two failures were the Demo server's loopback
`listen EPERM` and the standalone relocation suite encountering that same
restricted test in its nested run. The complete errors confirmed that both
failures came from the sandbox denying a listener on `127.0.0.1`, rather than
from a product assertion.

After explicit approval, the identical command was rerun outside that sandbox
restriction and exited `0`: all 20 test files passed, 379 tests passed, and one
conditional test was skipped. Total duration was 464.49 seconds; the standalone
relocation test passed in 237.942 seconds, and the Demo loopback test passed.

Fresh checks after that suite also passed:

- `npm run typecheck`;
- Node syntax checks for the acceptance script, verifier, and
  `rc6-strict-umask` child helper;
- `npm run build`;
- `npm run verify:package`, which returned `status: verified` with nine files;
- `npm run pack:dry`, which reported 2.5 kB packed, 5.2 kB unpacked, and nine
  files without writing a tarball;
- `git diff --check`.

The two final independent reviews and the local commit remain pending. These
verification results do not perform or prove a DeepSeek Harness action, an
external-network operation or packet-level observation, schema-v2 promotion,
a push, or a pull request.

## Task 2 B2d — acceptance entry correction and regenerated current local proposal

The first final B2c code review found a P1 in the acceptance CLI entry guard:
its basename-only comparison allowed a different-basename symlink invocation
to skip `main()`, while an unrelated same-basename importer could trigger it.
The matching evidence review found the resulting P1 overstatement in the B2c
ledger at lines 769–777, beginning with “every argv variant of the first legacy
CLI.” No other actionable code or evidence finding was reported. The complete
B2c text remains unchanged as historical evidence, but B2c is superseded by
this section and that sentence must no longer be read as the current contract.

Task 4b added six focused regressions before the production fix. Against
`14180b8f5b1a9c7deb0b6f03d6d2ca8c97b594cc`, the exact filter exited `1` with
six failures and 234 skips: five differently named symlink invocations silently
resolved without output, and one same-basename importer wrongly executed
`main()`, emitted the disabled policy, and exited `1`. This is the actual RED,
not a synthetic reconstruction.

The corrected entry guard compares the canonical real path of
`process.argv[1]` with the canonical real path of the module URL. Missing,
unresolvable, or different paths return false without throwing. After the fix,
the six new cases passed with 234 skips. The six existing argument-blind API
and legacy acceptance CLI policy cases also passed with 234 skips; the
file-safety suite produced 23 passes; acceptance syntax, typecheck, and diff
checks passed. The tracked correction is commit
`8fd628e988f2c5dee87610c91282445d07e5fc17` (`Fix retired acceptance CLI entry
guard`).

The corrected observable contract is precise: each of the five tested argv
variants invoked through a different-basename symlink emits the fixed,
path-free `{"status":"FAIL_INPUT_POLICY","reasonCode":"LEGACY_ACCEPT_DISABLED"}`
JSON with one final newline, exits `1`, and leaves stderr empty. A same-basename
driver that merely imports the implementation remains silent and successful.
Missing, unresolvable, and unrelated argv entry paths are import-safe.
The legacy API remains an argument-blind rejecting shim; no case writes
evidence or forwards into the stage API. An independent Task 4b review
reproduced these behaviors, rechecked the source identities and scope, and
reported PASS with no P0, P1, or P2 findings.

Before B2d staging, the B2c current pointer and bundle parent were reversibly
renamed to fixed destinations that had first been confirmed absent:

- `.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.superseded-pre-acceptance-entry-guard-20260906.json`;
- `.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal-bundles.superseded-pre-acceptance-entry-guard-20260906`.

The archived B2c bundle remains
`bundle-0f5e4867db1a4a9d9aa806b43d10d8f7`. Its parent is a distinct non-symlink
directory, mode `0700`, link count 3; its bundle is mode `0555`, link count 6;
the archived pointer and all four bundle files are regular, non-symlink, mode
`0444`, link count 1. The B2c owner marker remains
`ae2b3dbf146b009fcc58529b997772e8`, with owner-file SHA-256
`fae3f964d7634d1a89bc633fe8e61f71ca1c0f0df26c62d4bf424a050aed95eb`.
Its four B2c hashes remain unchanged:

| B2c archived object | SHA-256 |
| --- | --- |
| pointer | `339bb78040d2c4b189388f6f05d32459d88dd697cdcf00efb7f3facd230640b5` |
| receipt | `c5ee85f114aa0c3254420c6cf0f3ebfba743886b5f453671b1c604dbd7e50422` |
| input manifest | `5bd085fd661cb6888c347927b1796a3d488dcf55e8d0b17f57a7b54d0407af65` |
| closure | `c65c5fc8afbfd7e8a4c949d6c6a4b9b88297daa4f01178bea802949a1a8ef0c4` |

The stage implementer then invoked only
`stageRc6DeclarationInputV2({ workspaceRoot })` twice at `8fd628e`. The first
call returned `PASS_STAGED_RC6_DECLARATION_INPUT_V2`, `PASS_STAGED_REPLAY`, and
`PUBLISHED`; the second returned the same two PASS statuses and
`ADOPTED_EXISTING`. Both returned exactly the same three paths under the new
current bundle:

`.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal-bundles/bundle-7d2ca3aadeb78d26238260889726effc`.

Those two publication statuses are implementer-observed stage-report facts.
The independent Task 5b auditor did not rerun the API; it reconstructed the
resulting B2d bytes and filesystem closure and reported
`TASK 5B EVIDENCE AUDIT PASS` with no P0, P1, or P2 findings.

The B2d current pointer is
`.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json`. It is canonical JSON
with exactly four validator-owned keys and one final newline. The current
bundle parent and bundle are distinct non-symlink directories: the parent is
mode `0700`, link count 3, and the bundle is mode `0555`, link count 6, with
exactly four expected entries and no extra file. The independently reconstructed
objects are:

| B2d current object | Size | Mode | Links | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| pointer | 317 | `0444` | 1 | `0ef8ee0979e99e179a6831d8d7bc3558e2402b831c6586a14d9fcefcb966845e` |
| `.owner` | 32 | `0444` | 1 | `a07e29434ffa2f53a2f0dec12a855d5fb3422b618f09fcb161d8b79cc209801a` |
| `input-manifest.v2.json` | 86,226 | `0444` | 1 | `5bd085fd661cb6888c347927b1796a3d488dcf55e8d0b17f57a7b54d0407af65` |
| `rc6-declaration-closure.v2.json` | 32,540 | `0444` | 1 | `c65c5fc8afbfd7e8a4c949d6c6a4b9b88297daa4f01178bea802949a1a8ef0c4` |
| `receipt.json` | 2,723 | `0444` | 1 | `6de405c0ca373fdefa6e41eaff147532449914305788c7025105660687c08c66` |

All five table entries are regular, non-symlink files. The pointer binds the
exact receipt bytes; the receipt binds the exact input and closure bytes; and
the closure binds the same input digest. The `.owner` bytes are
`89d455fab167f69738f10d47788edb1d`, exactly equal to the receipt owner marker.
The actual proposal payload equals the receipt payload, and its independently
recomputed identity is
`4f14cc3d1ca3ff6c88e41e1457e9b8bbe7fc43cbce02e3a24a980a67eca7876b`.
The receipt result is exactly `PASS_RC6_DECLARATION_V2_PROPOSAL`.

The B2d source, compiler, verifier, runtime, and policy identities were
independently reconstructed as follows:

| Identity | SHA-256 |
| --- | --- |
| raw acceptance source | `b4ef83fa3d7e1e0f43241268a3db2277b3addd565e59e98ebfe4095c30370934` |
| normalized acceptance self-hash | `6dab6f41bfda75795031e1fa9a2e9bbc41672884276d92f72fd6af2f2eb8a120` |
| raw verifier source | `a0b9b11ad0ca1e8cf2fe79b7c127a5de1418329970ffca174d8b510e9b213329` |
| compiler source aggregate | `44535345dd7a3448bac9206c60ad352f67c265708d410c4c5e20dad0de83d943` |
| client compiler overlay | `ccc1578a3ed59a72264d3d468af7968b2a0771b693875d9ea9ee8fda4b1a2d24` |
| sealed compiler aggregate | `ddf98666210bbd9325c3902b7ab0718543ee4a37bc0c8a376e71bede4d3fe14a` |
| canonical compiler-result object | `96ef092029819624f0a4a62510bd03f3c7a56cfb1498fa751b64872451b48bc7` |
| verifier result | `1d3c401ea2a7207927d159178b7b54a504eae2d562bb2a812d091fe381dc59bb` |
| npm policy | `d25abf25f3cf9206bc6ad3da9c02392dee5a4565ae022fd1f44f9ad91c48944e` |
| compile policy | `30acc54a153ee1ed016f6b79becb3b1fddd011dd27d7f2fab33ef0aeef207700` |

The verifier reconstruction contains 59 full-cohort packages and five selected
declarations. Its derived closure SHA-256 is
`8aa0be0b2803af71b0fb3f9f85d9cf5f04789f98332630a307188c3cf7e4c6af`,
and its selected-manifests SHA-256 is
`f8318087aa8642b7610e2fd0df7c504e2826a0026523be244fe3aa748df41a0c`.
The runtime bound across input, closure, and receipt matches the current Node
`v24.14.0` binary, basename `node`, SHA-256
`9e831e9b13aa47c5e5eaa3904d232aa527124e8abba7ca5d72b67b46cfb10ae8`,
and npm `11.9.0`, CLI basename `npm-cli.js`, SHA-256
`8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7`.
The committed replay `package.json` and `package-lock.json` hashes are
`208bae9d2b2c0d67b2fa6b985d394cc1ce483e3a5cd226e391ca0a6b7f261cd1`
and `dde74c404cfbf8e7b1ec7cabece36d2aa2061f256770570f69c15f3064061ad1`.

The selected-source publication was independently inventoried rather than
accepted from the B2d receipt. Its exact identities are:

| Selected-source identity | Value |
| --- | --- |
| bundle | `declaration-input-source-bundles/bundle-4d20027b7b3fb8d8093979d83e6ad553` |
| pointer SHA-256 | `f69456bcf8ab1d10726244d9c4bd3399ca8bf39998d5e577412e5e65f9c4bc4f` |
| receipt SHA-256 | `984a8a417df4b7a4349ee306304ae90266c58cd25876d22b0fcba04f551cfb1d` |
| owner marker | `3c797d9ab85d6ebcc1ff5f2b207deb12` |
| owner-file SHA-256 | `7b92607196687aa994ee4d62c4dda14aebec1fc8fb9ea1753de5b24aea3a42d2` |
| descriptor SHA-256 | `995d0dca284ce38ddc28d4bdcc7f020c4d6b4ced06cd64587efdac59e9338011` |
| payload identity SHA-256 | `02aee7170134447b46777e1f5d923ad6a99500bc4d39313779c858412f079a7d` |
| selected-cache index SHA-256 | `73e76d127ab8188d8005e4becb750bbe9cfec30988e501185b13558f4c6cd3f6` |
| selected-content aggregate SHA-256 | `3a8c2e3ba2bb7e07d3cc51212e9ae3dd4925e522d9c9c87acac16fee122757dc` |

The selected-source payload has 924 records: 585 directories and 339 files.
It binds 169 packages and 9,590,214 selected content bytes. Its pointer was
mode `0444`, link count 1; parent mode `0700`, link count 3; bundle mode
`0555`, link count 6; and all payload files were mode `0444`, link count 1.

The current input has no top-level `acceptance` key. Its `proposalStage` has
exactly these two fields and values:

```json
{
  "command": "stageRc6DeclarationInputV2({ workspaceRoot })",
  "result": "PASS_STAGED_RC6_DECLARATION_INPUT_V2"
}
```

The serialized input contains none of `PASS_ACCEPTED_INPUT`,
`PASS_OFFLINE_INSTALL`, or `--verify-and-compile`. A recursive audit visited
1,797 parsed string values across the B2d pointer, receipt, input, and closure;
it found zero `/Users/`, `/private/`, `file:` URI, Windows drive-absolute, or
UNC-path hits.

The canonical persisted `compileResults` object and its top-level hash are
independently reconstructible. The receipt records a Host summary of 314
replay-relative files with list SHA-256
`87d56f0335888cc23448e38faf98b5b016f39279814cb9b9b6c92ba91d88874c`
and a Client summary of 388 with list SHA-256
`71086ce76394f560d5e1819d74442d5df0337bac5489e97cbe3f2f745ea26d35`.
The full `tsc --listFiles` arrays were not persisted, so their semantic truth,
the execution booleans, and the exact counts/list hashes remain stage-bound
unless the compiles are rerun. The first-call `PUBLISHED` and second-call
`ADOPTED_EXISTING` values are likewise transient stage-report observations,
not two historical events independently recoverable from the final bundle.

The full-suite PASS and associated final checks recorded in the B2c verification
subsection were run before commit `8fd628e` changed production source and tests.
They remain valid B2c historical evidence only and cannot be reused as B2d
completion evidence. The final serial suite, fresh repository checks as needed,
and both independent final reviews must be rerun against B2d before any final
local commit.

This B2d object remains a local proposal. Nothing here is schema-v2 promotion,
a committed schema-v2 input, an installation, a DeepSeek Harness runtime or
load/unload result, an external-network action or packet-level observation, a
push, or a pull request.

### Task 2 B2d — final verification

Fresh verification was run after commit
`8fd628e988f2c5dee87610c91282445d07e5fc17` and with the B2d ledger state
present. Using the already approved local-loopback permission,
`npm test -- --maxWorkers=1` exited `0`: all 20 test files passed, with 385
tests passed and one conditional skip, 386 total, in 464.09 seconds. The
standalone relocation test passed in 237.874 seconds, and the Demo loopback test
passed.

Fresh checks after that suite also passed:

- `npm run typecheck`;
- Node syntax checks for the acceptance script, verifier, and
  `rc6-strict-umask` child helper;
- `npm run build`;
- `npm run verify:package`, which returned `status: verified` with nine files;
- `npm run pack:dry`, which reported 2.5 kB packed, 5.2 kB unpacked, and nine
  files without writing a tarball;
- `git diff --check`.

Two new final independent reviews and the local ledger commit remain pending.
These results do not perform or prove schema-v2 promotion, a committed
schema-v2 input, installation, a DeepSeek Harness runtime or load/unload
result, an external-network action or packet-level observation, a push, or a
pull request.

### Task 2 B2d — final independent reviews

`FINAL CODE REVIEW B2D PASS` and `FINAL EVIDENCE REVIEW B2D PASS` each reported
zero P0, zero P1, and zero P2 findings. The code reviewer directly exercised 27
focused tests and checked both realpath entry guards, both rejecting legacy
shims, reachability, exact `proposalStage` semantics, source binding, and the
exact final review package.

The evidence reviewer independently reconstructed the B2c archive and complete
B2d current pointer/bundle chain, the selected-source publication, all 1,797
structured-string scan results, append-only history, and the stated stage-bound
and verification boundaries. Neither review invoked stage, DeepSeek Harness,
the network, promotion, push, or a pull request.

These two PASS results approve only the planned local ledger commit. They do
not approve schema-v2 promotion, installation, a Harness action, or any remote
operation. The local commit remains pending.

### Stage 2 boundary separation — legacy evidence retained

The declaration acceptance boundary above remains immutable historical evidence.
Its 33 production paths and exact hashes in
`scripts/accept-rc6-declaration-input.mjs` were not changed, and the historical
`tsconfig.surface.host.json` and `tsconfig.surface.client.json` bytes were restored
to the recorded hashes. Earlier sections of this ledger retain their original
meaning and have not been rewritten as Stage 2 evidence.

Stage 2 intentionally changes the current root manifest, root lock, and Workbench
package manifest. The current workspace is therefore expected to fail the frozen
legacy production-boundary comparison. That rejection records separation between
historical acceptance evidence and present development; it is not a regression in
the legacy fixture.

Tests reconstruct the historical boundary from the committed, path-free
`tests/fixtures/rc6-legacy-production-boundary.json`. Before writing any temporary
fixture file, they require the exact 33-path set, each recorded SHA-256, canonical
base64 bytes, and source commit `7044c6d3a342954fce9469473421b27b1ce91575`.
They require no Git process at test runtime. Stage 2 public-surface compilation now
uses the separately named `tsconfig.stage2.surface.host.json` and
`tsconfig.stage2.surface.client.json`.

This separation does not prove a Harness installation, runtime, RPC, storage,
visible UI, disable/remove/reinstall cycle, external-network behavior, push, or
pull request.
