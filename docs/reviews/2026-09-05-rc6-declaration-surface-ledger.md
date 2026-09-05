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
- Current result: `CHANGES_REQUIRED_REVIEW`.
- The prior accepted-input and local-replay observations are historical only;
  they do not approve Task 2 pending the fresh B2 acceptance snapshot.

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

## Safety boundary

No Harness process, profile, browser, listener or port, workbench tgz,
production manifest, storage package, model, credential, user session, or real
data was used. No package was installed, no network request was made, and
`~/.dsh` was not accessed. Root and workbench manifests, lockfiles, production
source, build output, and package contents were not modified.

## Task 2: frozen declaration input acceptance

- Stage: A′-P1a, Task 2.
- Result: `CHANGES_REQUIRED_REVIEW`.
- The prior accepted-input and local-replay observations remain recorded below,
  but they are pending the other Task 2 review fixes and are not final approval.
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

### Acceptance and replay commands

The command below completed with exit code `0`. It copies only the selected
cache records, makes that `_cacache` read-only, writes separate log/temp
directories, and invokes the exact npm CLI with empty user/global npm config:

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
frozen accepted npm CLI identity, or materialize only the separate compiler
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
