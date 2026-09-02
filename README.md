# DSH PM Workbench

> Private, unofficial research repository. This project is not affiliated with,
> endorsed by, or maintained by DeepSeek.

DSH PM Workbench is an experimental codebase for exploring how an AI product
manager could organize evidence from product discovery through requirement
analysis, prioritization, and later POC planning inside a DeepSeek Harness
extension.

The long-term workflow is a product direction, not a statement of implemented
functionality.

## Current status: Gate A No-Go

The current architecture requires generated, strict Typert Host/Client Remote
artifacts. In the isolated `0.1.0-rc.6` probe, the workspace package was
discovered but the generator emitted no Remote artifacts. The required files
were absent, so Gate A was recorded as **NO-GO** and all downstream work stopped.

The repository currently contains a private static package skeleton and
technical evidence only. It has **not** established that the package:

- can be installed into DeepSeek Harness;
- can load or mount in a Harness profile;
- is compatible with any Harness version;
- can persist projects or requirements;
- can analyze interviews;
- can call a real model;
- can process real user data.

No handwritten descriptor, copied generated file, private HTTP fallback,
dynamic Cordis fallback, protocol vendoring, or generator patch is accepted as
proof that Gate A passed.

## Next approved investigation

The next bounded task is an isolated official-version compatibility matrix. It
must reuse one fixed synthetic Remote probe for every tested version, preserve
the raw exit status and artifact assertions, and subject any apparent success
to adversarial review before the architecture decision changes.

Version-matrix work does not authorize UI development, persistence, a real
model, real interviews, installation into the user's active Harness profile, or
public distribution.

## Data boundary

Only synthetic, non-identifying fixtures may enter this repository.

Never commit or attach:

- real interview recordings or meeting audio/video;
- real transcripts, notes, summaries, quotations, or uploaded documents;
- names, contact details, account identifiers, customer data, or other personal
  information;
- API keys, access tokens, cookies, browser sessions, credentials, `.npmrc`,
  local Harness profiles, or provider responses;
- private model prompts or outputs produced from real user data.

If sensitive material is committed accidentally, treat it as compromised:
revoke or rotate credentials where applicable, remove the material from Git
history, and review any clones, logs, artifacts, and Pull Requests that may
contain it.

## Development and Pull Requests

`main` is the reviewed baseline. Development happens on short-lived branches,
using the `codex/` prefix for Codex-authored work.

Every functional change should arrive through a Pull Request that states:

- what changed and why;
- which gate or approved scope permits it;
- the exact checks actually run and their observed results;
- whether any compatibility claim is proven, failed, proposed, or still
  unknown;
- whether dependencies or third-party source references changed;
- whether the data boundary or privacy surface changed.

A passing build alone is not compatibility evidence. A PR must not claim that
the plugin is installable, compatible, secure, or ready for real interview data
unless the corresponding gate has been explicitly passed with reproducible
evidence.

Direct pushes to `main`, force pushes, secret-bearing commits, generated caches,
and real user data are outside the repository workflow.

## Distribution and license

This repository is private and **UNLICENSED**. No permission is granted to use,
copy, modify, publish, distribute, sublicense, or sell this code. Private GitHub
visibility is an access setting; it does not grant a reuse license.

Third-party dependencies and reference projects remain subject to their own
licenses. Their presence in documentation does not mean their source code was
copied or approved for redistribution.

