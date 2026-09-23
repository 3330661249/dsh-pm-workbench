# Compatibility

This preview targets macOS, a local Web profile and Harness `0.1.0-rc.6` with the
pinned optional public peer cohort. Host ESM and wrapped Client CJS use the
public Connection, storage-domain, agent and subagent surfaces. Host injects
`connection`, `storageDomain`, `agents`, `subagents`, `agentDefaultModel` and
`tools`; Client injects `connection` and `slots`. Ordered package Client
injections remain Connection, Runtime, UI Layout and UI Sidebar on `web`.

The Product channel is `/dsh-pm-workbench-product-v1`, with API version
`pmwb-product-v1`. The launcher and overlay are additive. The package contains
one built-in synthetic Fixture and accepts explicitly authorized pasted text,
`.txt`, `.md`, and `.docx` interview material. Stage 3C model execution uses the current
Harness provider/model, a fresh local child, structured output, and exact quote
verification; failure does not fall back to Fixture output. Audio, PDF,
and multi-interview aggregation are outside this release.

Static graph/package checks do not establish model correctness or fresh-machine
installation. Local installed macOS/rc.6 runs with synthetic material have
exercised the current UI and DeepSeek-V4-Flash, including PRD and text validation.
Other operating systems and Harness versions are unverified. Historical Stage
2/3A archive gates describe older builds only.

Product state is stored in the Harness profile by design; package removal does
not erase that state. Delete/remove is not secure erasure. Runtime verification
may use synthetic material; real material requires the explicit in-product
authorization and permission for the selected provider to process it.

Release creation and retirement require one trusted exclusive controller on
Node 24 / macOS. Final identity checks and filesystem mutations run in
synchronous namespace critical sections, including the bounded offline npm
pack child. Substitutions at asynchronous boundaries remain checked against
held file and ancestor identities. Concurrent non-cooperating same-UID mutation is outside this claim,
as is replacing a trusted built-in inside a critical section. This cooperative
exclusion assumption is not a secure-erasure guarantee.
