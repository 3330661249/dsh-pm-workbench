# Privacy

Stage 3A uses one built-in synthetic Fixture, makes no model call and does not
accept real interview/customer data. Synthetic source text and human edits are
bounded and validated. Do not enter personal, customer or confidential content.
Stage 3B model execution is unimplemented.

The Host owns Product state in the Harness profile. The Client keeps transient
drafts and communicates through the six strict Product RPC endpoints. It does
not persist Product drafts in browser storage. The implementation does not read
Harness workspace sessions, credentials or provider responses. Public outer
Connection failures use the fixed `internal` carrier; the Client ignores raw
carrier messages and details.

Product profile data is intended to survive package removal. Delete/remove is
not secure erasure, and removing the plugin does not claim to delete profile
storage. Task 11 checks only the static code graph and exact package bytes;
actual restart persistence and removal/re-add behavior await Task 12.

These implementation constraints are not a runtime privacy certification.
Historical Stage 2 and Task 3 artifacts establish only their own recorded scope.
