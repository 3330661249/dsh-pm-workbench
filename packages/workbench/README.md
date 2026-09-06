# DSH PM Workbench

Private development bundle for a local interview requirements workbench.

## Standalone browser Demo

From the repository root, run:

```sh
npm run demo:serve
open http://127.0.0.1:4173/
```

This is an in-memory fixture Demo, not an installed Harness plugin or a real
model result. It runs locally with synthetic interview data, stores no session
state, and loses edits on refresh. Use only synthetic material. The server builds
the three browser files in `.tmp/dsh-pm-workbench/demo/` before listening on
`127.0.0.1:4173`; stop it with Ctrl+C. `npm run demo:build` builds those files
without starting the server. These commands are separate from Harness and from
the package build.

## Package status

This package source implements a bounded synthetic Harness Probe through public
Connection RPC and strict shared schemas. The Host exposes only `health` and
`counter.increment` on `/dsh-pm-workbench-v1` with `authority: 'loopback'`. It
uses a `storageDomain` aggregate for a synthetic integer counter and bounded
idempotency receipts. The Web Client contributes one additive sidebar-footer
launcher and one additive shell overlay; it does not replace the Harness root.

The Probe accepts no free text, calls no model and reads no workspace, session,
interview, transcript, file, credential, provider response, or other user data.
It is not the product-manager workflow implemented by the standalone Demo.

This source and its local contracts do not prove that the packed tgz installs,
loads, mounts, calls Host RPC from a browser, persists across a real Harness
restart, disappears on removal, or restores state after reinstall. Those runtime
observations have not been performed. No compatibility, Gate A′, model,
interview-analysis, real-data, or release claim has been established.

The target remains Harness `0.1.0-rc.6`. The package is private, UNLICENSED and
not published. The next real-tarball observation must use a fresh isolated
profile, a dynamically allocated loopback port that is not `3080`, and synthetic
counter data only. Gate A′ remains not run.

The implemented route requests `authority: 'loopback'`. The planned isolated
runtime boundary also restricts the listener to `127.0.0.1` and empty
`trustedHosts`. Source configuration is not an authentication or real-data
guarantee.
