# Security and data-handling policy

## Project status

DSH PM Workbench is an unofficial early preview, not a production security
certification. Local macOS / Harness rc.6 use and synthetic model calls have
been exercised. Other environments, real customer outcomes and secure erasure
are not established. Bind the local service to loopback, not the public internet.

The panel uses shared schemas, a Host-owned state boundary and task-owned model
agents. Source input is untrusted. Human confirmation remains required for
scope and validation conclusions. Users must authorize the selected provider
before submitting real material. Historical Typert/Stage 3A gates below describe
older designs and must not be read as the current runtime status.

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
