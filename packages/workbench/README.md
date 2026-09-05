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

This package is still a no-op static Host and Web Client skeleton. The owner has
selected public Connection RPC plus strict shared schemas as the next design
candidate, replacing the failed generated-Typert route. That candidate has not
been implemented or tested from this tarball. No Host/Client RPC, UI mount,
storage, restart, install/remove, model, interview analysis, or real-data claim
has been established.

The target remains Harness `0.1.0-rc.6`. The package is private, UNLICENSED and
not published. Only an isolated future Gate A′ may load it, on a non-3080 port
with synthetic counter data.

The candidate boundary is restricted to `127.0.0.1`, empty `trustedHosts` and
`authority: 'loopback'`; it is not an authentication or real-data guarantee.
