# Security and data-handling policy

## Project status

DSH PM Workbench is a private, unofficial experiment. The historical generated-
Typert Gate A is **NO-GO** because the required Host/Client Remote artifacts
were not produced by the isolated probe or the later eight-cohort matrix.

The owner has selected public Connection RPC plus strict shared schemas as a
new design candidate. Its replacement Gate A′ has not run. The selection is not
evidence that the package can load, that the RPC boundary is secure, or that it
is suitable for real interview material.

The codebase is not established as installable, Harness-compatible,
production-ready, or suitable for real interview data. Do not run it against an
active or production profile, expose it to the public internet, or connect it
to a real model or provider account without a later approved gate. Gate A′ may
use only an isolated profile, a non-3080 port, and synthetic counter data.

The selected v0.1 boundary is loopback-only: bind `127.0.0.1`, keep
`trustedHosts=[]`, use `authority: 'loopback'`, and do not expose the channel
through LAN, `0.0.0.0`, a reverse proxy, or a tunnel. Loopback is a Host/Origin
reachability fence, not user authentication; other processes running as the
same macOS user are inside the initial trust assumption. Connection buffers and
parses JSON before plugin-level size validation, so business limits do not
eliminate local denial-of-service risk. The plugin cannot inspect raw request
whitespace or fully bound Connection-owned fields such as `rpcId`, so its
documented byte limits apply only to canonical plugin request/outcome values,
not to the complete carrier message. These are reasons Gate A′ stays limited to
synthetic counter data.

The proposed H1 design uses a profile-private cursor-signing key only to detect
cursor modification; it is not authentication and must never be logged or
exported. H1 also remains blocked until bounded project/profile persistence and
atomic failure/recovery behavior pass the separate Gate B.

## Prohibited repository content

Do not commit, upload to a Pull Request, paste into an Issue, or preserve in CI
artifacts any of the following:

- real interview recordings, meeting audio, screen recordings, or videos;
- real transcripts, notes, summaries, quotations, research documents, or
  customer uploads;
- personal information, customer identifiers, internal business data, or
  confidential product material;
- passwords, API keys, PATs, OAuth tokens, cookies, browser-session material,
  SSH/private keys, `.npmrc`, provider credentials, or Harness profile secrets;
- prompts, traces, provider requests, or model responses derived from real data;
- local absolute paths, temporary profiles, npm caches, runtime databases, or
  diagnostic bundles that may reveal user or machine information.

Tests may use only clearly labeled synthetic fixtures that contain no copied
conversation, identity, customer content, or production credential.

## Pull Request security checks

Every Pull Request must confirm that:

- the change stays within an explicitly approved gate and scope;
- repository and package outputs contain no credentials or local absolute paths;
- fixtures are synthetic and their provenance is documented;
- generated output, caches, runtime state, recordings, and transcripts are not
  included;
- dependency and third-party-license changes are disclosed;
- compatibility statements distinguish observed evidence from proposals and
  unknowns;
- security-relevant checks list the command or procedure actually run and its
  observed result.

A successful typecheck or build does not prove that the package is installable,
compatible, secure, or safe for real data.

## Reporting a security or privacy problem

Do not disclose a vulnerability, credential, or personal data in a public
Issue. Use a GitHub private security advisory if it is enabled for the
repository; otherwise contact the repository owner through an agreed private
channel and include only the minimum information needed to reproduce the
problem.

Do not include a live credential in a report. Use a redacted identifier and
describe where the owner can verify it locally.

## Accidental secret or data exposure

If a credential or real user material enters Git history:

1. stop further pushes and artifact publication;
2. revoke or rotate the affected credential immediately;
3. identify every commit, branch, tag, Pull Request, CI artifact, log, fork, and
   clone that may contain the material;
4. remove the material from Git history rather than only deleting it in a later
   commit;
5. invalidate and regenerate affected caches or artifacts;
6. document the incident privately and re-run the repository leakage checks.

Deleting the latest copy is not sufficient once sensitive content has been
committed or pushed.
