# Stage 2 public rc.6 surface — verified dependency freeze

**Current observed status:** Task 1 dependency/type-contract verification passed
against the final exact rc.6 graph. The earlier mixed-lock hydration failures below
are retained only as superseded diagnostic history. This note is not a Harness
runtime result, a profile install, or a general compatibility claim.

## Required public surfaces

The compile-only fixtures use public package entrypoints only:

| Side | Public surface | Fixture assertion |
| --- | --- | --- |
| Host | `@deepseek-ai/dsh-client-connection` | `ctx.connection.rpc.handle('/dsh-pm-workbench-v1', handler, { authority: 'loopback' })` |
| Host | `@deepseek-ai/dsh-storage-domain` | `await ctx.storageDomain.open(probeDomainSpec)` |
| Client | `@deepseek-ai/dsh-client-connection/client` | `ctx.connection.rpc.call('/dsh-pm-workbench-v1', 'health', {}, signal)` |
| Client | layout/sidebar public `/client` entries | `ctx.slots.inject()` and `ctx.slots.register()` for `sidebar.footer.action` |

The client fixture imports public `ConnectionHandle` and declares the smallest
intersection required by rc.6:

```ts
declare const ctx: ClientContext & { readonly connection: ConnectionHandle }
```

This documents a public declaration gap: the rc.6 Client Context declarations do
not themselves provide `connection`. The fixture does not copy an API, cast a
value, add a local module declaration, or hide errors through `skipLibCheck`.

`@deepseek-ai/dsh-client-ui-slots` stays a public type/peer dependency. It is not
listed in `dsh.client.inject`, because rc.6 has no Web `./client` bundle for it.

## Freeze construction

The root development graph directly pins the public declaration/peer packages
needed by this compilation to exact `0.1.0-rc.6`, including `dsh-agent`. Agent is
direct because the public type trace through the selected Client dependency graph
includes declarations that reference it; this is a type-resolution dependency, not
a product feature or a runtime activation.

The root `overrides` map pins every other package in the known 56-package reachable
rc.6 DSH closure to exact `0.1.0-rc.6`. `dsh-sandbox` and
`dsh-sandbox-policy` are optional peers of the `dsh-subagent` dependency reached
through `dsh-host-apiproxy`, so they are exact root direct pins rather than
overrides; this makes the required closure materialize both lock locations. Other
direct packages are intentionally absent from
`overrides`; the contract test checks that split. This avoids prerelease caret
ranges drifting from rc.6 to rc.8 during a normal npm resolution.

The workbench package keeps `zod@4.4.3` as a normal runtime dependency. Cordis,
all selected Harness Host/Client peers, React, and React DOM remain exact optional
peers supplied by the Harness host.

## Superseded hydration diagnostics

An earlier hydration attempt selected mixed rc.8 DSH entries. Its strict compiler
errors were diagnostic only and were never treated as a passing rc.6 surface. That
state was superseded by the final normal exact resolution recorded under **Fresh
Task 1 verification**, where every lockfile DSH occurrence is rc.6.

## Verification sequence used

The isolated worktree was resolved and checked with:

```bash
npm install --ignore-scripts --no-audit --no-fund
npm test -- tests/contract/harness-rc6-public-surface.test.ts tests/contract/package-manifest.test.ts tests/contract/rc6-declaration-contract-guard.test.ts
./node_modules/.bin/tsc -p tsconfig.stage2.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.stage2.surface.client.json --noEmit
npm run typecheck
```

The installation command used ordinary npm resolution: exact direct pins plus the
closed override map replaced the earlier `--legacy-peer-deps` diagnostic attempt.
The passing commands below are the current evidence.

## Cordis compatibility cohort

The 56-package DSH closure excludes four non-DSH compatibility packages. They
are pinned separately as root overrides: `cordis-plugin-include@1.0.6`,
`cordis-plugin-loader@1.0.2`, `cosmokit@1.8.2`, and `schemastery@3.18.1`.
Cordis itself remains the direct root `4.0.1` pin and is not overridden.

This separates the platform compatibility constraint from the DSH closure:
without it, ordinary npm resolution selected
`@deepseek-ai/cordis-plugin-include@1.0.7`, whose Cordis peer requirement is
`^4.0.2` and therefore incompatible with the targeted `4.0.1` surface.

## Zod consistency gate

The root development graph and the workbench runtime dependency both pin
`zod@4.4.3`. The public-surface contract enumerates every lockfile occurrence
of canonical package name `zod` and requires all of them to resolve at `4.4.3`.
This is separate from the DSH 56-package and four-package Cordis cohorts.

A prior normal install left root-level `zod@4.5.4` while the workbench carried
nested `4.4.3`; that historical mixed tree was not used for the Task 1 GREEN
claim. The final ordinary npm resolution after the root exact pin superseded it.

## Fresh Task 1 verification

After normal resolution of the closed exact graph, these commands completed with
exit code 0 in the isolated worktree:

```bash
npm test -- tests/contract/harness-rc6-public-surface.test.ts tests/contract/package-manifest.test.ts tests/contract/rc6-declaration-contract-guard.test.ts
./node_modules/.bin/tsc -p tsconfig.stage2.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.stage2.surface.client.json --noEmit
npm run typecheck
npm ls --all
```

The focused contracts passed 36 tests. The lock audit found 67 DSH package
occurrences representing exactly 56 canonical `@deepseek-ai/dsh-*` names; every
occurrence is `0.1.0-rc.6`. It found no rc.8 records. Every canonical `zod`
lock occurrence resolves to `4.4.3`. This verifies the compile-only public
surface and locked dependency graph, not a Harness RPC/UI/storage runtime.
