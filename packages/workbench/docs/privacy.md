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

## Conversation Skill boundary

The bundled AI PM Skills run inside an ordinary Harness model conversation.
Text submitted to `/interview-to-prd` is therefore sent to the model provider
configured for that session and is retained according to the Harness session
and provider policies. The Skills do not authorize sending material to any
additional service. Confirm organizational permission and remove direct
identifiers before using real interview or customer content.

The current Skills do not transcribe audio. An audio-to-text integration must
state its destination and retention policy before real recordings are used.

These implementation constraints are not a runtime privacy certification.
Historical Stage 2 and Task 3 artifacts establish only their own recorded scope.
