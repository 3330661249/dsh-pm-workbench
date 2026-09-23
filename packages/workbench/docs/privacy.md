# Privacy

The preview accepts pasted text, `.txt`, `.md`, and `.docx` material. Word text extraction runs locally before preview and authorization. One built-in synthetic
Fixture remains available for testing. Other text is classified as authorized
real material and requires a separate, explicit confirmation before import.
Model execution sends the selected source text and research goal to the model
provider currently selected in Harness. It rejects unverified quotes and does
not silently replace a failed model result with Fixture output.

The Host owns Product state in the Harness profile. The Client keeps transient
drafts and communicates through the six strict Product RPC endpoints. It does
not persist Product drafts in browser storage. The implementation does not read
Harness workspace sessions or credentials. Stage 3C reads only the selected
provider/model identifiers and the structured response created for the current
analysis. Public outer Connection failures use the fixed `internal` carrier;
the Client ignores raw carrier messages and details.

Product profile data is intended to survive package removal. Delete/remove is
not secure erasure, and removing the plugin does not claim to delete profile
storage. Static package verification does not by itself prove restart
persistence or removal/re-add behavior for a particular retained archive.

Authorization in the panel records the user's decision for that import; it is
not a legal consent system and does not verify the provider's retention policy.
Confirm organizational permission, participant consent, and the current model
provider's policy before using real material. Remove direct identifiers when
possible.

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

## PRD drafting model boundary

The panel's PRD action sends the human-confirmed baseline project name, research
goal, included requirement text, priorities, human reasons and cited excerpts to
the model currently selected in Harness. It does not send the full source text or
internal baseline/requirement/evidence IDs and hashes. If the model selection has
changed since import, check that the new provider is authorized before drafting.
The owned drafting agent exposes only structured output capture. The bundled
`create-prd` guidance does not grant file, browser or external-service access.
The resulting PRD and its provider/model provenance persist in profile storage.

Generated flows, acceptance rules and plans are proposals for human review, not
a guarantee of factual correctness or a published product commitment. Missing
facts are collected as open questions. Existing PRD revisions are not rewritten.

PRD drafting may use an advertised lighter reasoning option for that owned child
only. The current provider/model route, global model settings, analysis semantics
and other conversations are not changed.
