# Compatibility

Stage 3A targets macOS, a local Web profile and Harness `0.1.0-rc.6` with the
pinned optional public peer cohort. Host ESM and wrapped Client CJS use the
public Connection, storage-domain, agent and subagent surfaces. Host injects
`connection`, `storageDomain`, `agents`, `subagents`, `agentDefaultModel` and
`tools`; Client injects `connection` and `slots`. Ordered package Client
injections remain Connection, Runtime, UI Layout and UI Sidebar on `web`.

The Product channel is `/dsh-pm-workbench-product-v1`, with API version
`pmwb-product-v1`. The launcher and overlay are additive. The package contains
one built-in synthetic Fixture and does not accept real interview/customer
data. Stage 3B model execution is implemented only for synthetic material. It
uses the current Harness provider/model, a fresh local child, structured output
and exact quote verification; failure does not fall back to Fixture output.

Task 11 is static graph/package verification only. Real installation, browser
behavior, restart persistence and remove/re-add recovery remain unverified for
this exact Product archive until Task 12. Historical Stage 2 and Task 3 reports
remain separate evidence; the earlier generated-Typert matrix remains history.

Product state is stored in the Harness profile by design; package removal does
not erase that state. Delete/remove is not secure erasure. Any later runtime
observation must use the authorized isolated synthetic-data profile and its
exact retained release artifact.

Release creation and retirement require one trusted exclusive controller on
Node 24 / macOS. Final identity checks and filesystem mutations run in
synchronous namespace critical sections, including the bounded offline npm
pack child. Substitutions at asynchronous boundaries remain checked against
held file and ancestor identities. Concurrent non-cooperating same-UID mutation is outside this claim,
as is replacing a trusted built-in inside a critical section. This cooperative
exclusion assumption is not a secure-erasure guarantee.
