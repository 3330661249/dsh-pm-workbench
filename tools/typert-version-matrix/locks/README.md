# Reviewed platform locks

One reviewed set is present under `darwin-arm64-node24-npm11/`. Its README contains
a human-readable table and an exact embedded JSON manifest for all eight locks,
their direct dependency evidence, installed graph hashes, and resolve-run chain.
`verify-locks` checks that closed inventory offline. Frozen mode has no fallback: it fails
closed as `INCONCLUSIVE_LOCK` when
`locks/<platform-key>/<case-id>.package-lock.json` is absent, invalid, or mismatched.

Resolve-mode locks remain under the ignored run root until their hashes, exact
versions, origins, workspace link, and portability have been reviewed and copied
here in a separate change.
