# DSH PM Workbench Minimal Harness Integration Design

**Status:** approved product direction, implementation gated by the stages below

**Baseline:** `origin/main` merge commit `bd0ae743e0c490b5aa770eccae3dd77d325e9a48`

**Target runtime:** DeepSeek Harness `0.1.0-rc.6`

**Owner direction:** continue from the accepted standalone Demo with the smallest isolated Harness integration proof

## 1. Purpose

The standalone `材料 → 需求 → 优先级 → PRD` Demo proves the product flow, but it does not prove that a third-party package can load inside DeepSeek Harness. This design defines a narrow sequence that answers that question without touching the user's active Harness profile or introducing real interview data or model calls.

The first useful outcome is an additive Harness entry that opens a small diagnostic panel and completes a public Connection RPC health round trip. Persistence and the full four-step workbench follow only after earlier evidence passes.

## 2. Relationship to earlier documents

The following documents remain research history and are not executable task lists for the current branch:

- `2026-09-02-dsh-pm-workbench-v0.1-rollout.md`
- `2026-09-02-dsh-pm-workbench-v0.1-f0-shared-foundation.md`
- `2026-09-02-dsh-pm-workbench-v0.1-h0-connection-rpc-probe.md`
- `2026-09-02-dsh-pm-workbench-v0.1-h1-plugin-alpha.md`

Their public-API, isolation, lifecycle, trust-fence, and evidence requirements remain useful references. Their missing F0 evidence chain and large authorization machinery are not silently treated as completed prerequisites.

The 2026-09-04 simple design remains the product definition. This document only adds the current Harness integration sequence.

## 3. Claim ladder

Each stage has a separate claim. Passing an earlier stage never implies a later one.

| Stage | What may be claimed after PASS | What remains unproven |
| --- | --- | --- |
| A′-P1 Public surface | The exact tested rc.6 public types expose the minimum Connection, storage, and additive-slot seams | Package load, browser behavior, persistence, Harness compatibility |
| A′-P2 Isolated mount | One exact tgz loaded in one disposable rc.6 profile; health and additive launcher/overlay worked | Persistence, restart recovery, full Gate A′, product workflow |
| A′-P3 Synthetic state | The same isolated setup preserved a synthetic counter through the declared restart/remove/reinstall sequence | Real projects, interview data, model calls, complete Gate A′ |
| Full Gate A′ | Every retained runtime, trust, lifecycle, cleanup, coexistence, and leakage check passed in one frozen run | Product Alpha, real model, real data, public distribution |
| Harness workflow Alpha | The approved four-step synthetic workflow worked inside Harness | Real-data readiness unless a later privacy gate passes |
| Gate M | A separately approved real model path passed synthetic evaluation | Real interview deployment unless separately approved |

Until Full Gate A′ passes, stages A′-P1 through A′-P3 are called **preflight slices**, not Gate A′ PASS.

## 4. Fixed safety boundary

Every Harness-facing run must use:

- a new disposable `DSH_HOME` below the repository-controlled temporary run root;
- profile name `pm-workbench-probe`;
- `127.0.0.1` only;
- port `3186`, after proving it is free;
- `trustedHosts: []`;
- one exact locally built tgz;
- synthetic strings and integers only;
- no inherited user profile, workspace, session, credential, model, browser profile, or ripple installation.

The run must not read or write:

- `~/.dsh`;
- port `3080`;
- the `web` or `open-design` user profiles;
- the current browser's profile or saved sessions;
- Desktop, Downloads, clipboard, recordings, transcripts, or real interview files;
- provider configuration, API keys, tokens, cookies, or model responses.

The runner must stop cleanly and prove that no listener remains on `3186`.

## 5. Architecture

### 5.1 Host

The Host uses only public rc.6 APIs. It registers the unique channel `/dsh-pm-workbench-v1` with `authority: 'loopback'`.

Preflight endpoints are closed and stage-specific:

- A′-P2: `health` only;
- A′-P3: `health` and `counter.increment` only.

Unknown endpoints and malformed input or output fail closed. The Host returns the existing rc.6 `RpcResult` envelope and disposes the channel through the Cordis lifecycle.

### 5.2 Client

The Client uses `ctx.connection.rpc.call(...)`, validates every returned payload, and registers two additive slots:

- `sidebar.footer.action` with ID `pm-workbench-probe-launcher`;
- `shell.overlay` with ID `pm-workbench-probe-overlay`.

It never registers `root`, `sidebar`, `conversation`, or `details`. The diagnostic panel shows only:

- connection state;
- plugin and protocol versions;
- the synthetic counter in A′-P3;
- an explicit “isolated test” label;
- open, retry, increment, and close controls as applicable.

The existing four-step Demo is not mounted during A′-P1 through A′-P3.

### 5.3 Synthetic storage

A′-P3 uses `@deepseek-ai/dsh-storage-domain` with one domain and one global record. It stores only:

- `counter`;
- `aggregateVersion`;
- bounded idempotency receipts required by the probe.

It stores no text, filenames, paths, timestamps, user identifiers, sessions, prompts, or model output.

## 6. Stage gates

### 6.1 A′-P1 Public surface

PASS requires all of the following:

1. Exact rc.6 packages resolve below this worktree's own `node_modules`.
2. Host and Client public type surfaces compile separately.
3. The compiled checks prove the presence and expected signatures of:
   - `HostConnectionHandle.rpc.handle(...)`;
   - `ConnectionHandle.rpc.call(...)`;
   - `DomainFacility.open(...)`;
   - `sidebar.footer.action`;
   - `shell.overlay`;
   - synchronous UI disposers and asynchronous RPC disposer.
4. No private import, copied protocol, parent dependency fallback, Harness source modification, or runtime start is used.
5. Manifest, lockfile, notices, focused tests, complete typecheck, full tests, build, and package boundary checks pass.

Any mismatch is recorded as FAIL and returns to architecture review. A′-P2 must not start.

### 6.2 A′-P2 Isolated mount

PASS requires one exact audited tgz to complete:

1. offline/no-script install into the disposable profile;
2. Host and Client load;
3. exact `health` round trip through `/dsh-pm-workbench-v1`;
4. launcher appears without replacing the shipped sidebar;
5. overlay opens, closes, restores focus, and leaves original chat usable;
6. plugin remove makes the launcher, overlay, and channel disappear;
7. process exit and listener cleanup complete.

The result is still only an isolated mount preflight.

### 6.3 A′-P3 Synthetic state

PASS requires the same exact tgz and disposable profile to prove:

1. compare-and-set version behavior;
2. exact-request idempotency and reused-ID rejection;
3. restart readback;
4. remove/reinstall lifecycle with the declared data-retention behavior;
5. no duplicate handler, launcher, or overlay after remount;
6. bounded storage and request sizes;
7. clean shutdown and no listener residue.

### 6.4 Full Gate A′

Full Gate A′ is a separate implementation and review step. It must reconcile the retained A01–A22 checks in the 2026-09-02 Connection RPC specification, including trust-fence negatives, cancellation timing, admission limits, canary scanning, package audit, ripple coexistence, and evidence closure. No preflight slice may be relabeled as this result.

## 7. Testing strategy

All production behavior follows test-first development:

1. contract tests fail before dependencies or surfaces exist;
2. Host and Client types compile in separate TypeScript projects;
3. unit tests drive strict endpoint parsing, response validation, state transitions, and disposal;
4. package tests inspect a real tgz rather than a source link;
5. runtime tests use a disposable profile and a real browser only after the code and package are frozen;
6. cleanup assertions run on PASS, FAIL, timeout, and signal paths.

No screenshot, config dump, successful build, or visible button alone counts as RPC, persistence, or compatibility evidence.

## 8. Stop conditions

Stop immediately if the implementation requires any of the following:

- private imports or copied generated descriptors;
- `/api` interception or a custom bare HTTP route;
- `root`, `sidebar`, `conversation`, or `details` replacement;
- non-loopback binding, `trusted-host`, proxy, tunnel, or LAN access;
- edits to DeepSeek Harness source or installed package bytes;
- the user's active profile, credentials, model configuration, sessions, or real data;
- an unreviewed lifecycle script;
- a missing public disposer or a listener that cannot be proven closed.

The result is FAIL or INCONCLUSIVE. The next stage does not begin automatically.

## 9. Current implementation decision

The first implementation plan covers **A′-P1 Public surface only**. It does not build or run a Harness plugin. After A′-P1 is implemented, tested, committed, and independently reviewed, the owner receives a plain-language result before any tgz is installed or port `3186` is started.
