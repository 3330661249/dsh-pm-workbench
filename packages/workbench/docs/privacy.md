# Privacy

The implemented Probe is synthetic-only. Its Client sends either an empty
`health` request or a bounded `counter.increment` request containing only the
fixed API version, a non-negative expected version, a random UUID v4 command
identifier and `delta: 1`. There is no free-text field.

The Host source is limited to a synthetic integer counter, aggregate version and
bounded idempotency receipts. It does not read a Harness workspace, session,
conversation, file, interview, transcript, recording, identity, credential,
provider response, prompt or model output, and it makes no model call. Strict
schemas and closed Client errors are designed not to echo payloads, paths,
credentials or stack traces.

Real Harness loading and persistence have not yet been observed, so this is a
source boundary rather than a runtime privacy certification. Use only synthetic,
non-identifying data. Any model integration or real interview data flow requires
a separate implementation scope, privacy review and gate.
