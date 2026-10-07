# Prototype setup log

## Scope

This record covers repository setup and neutral starter validation only. No customer-specific product decisions, workflow changes, or public deployment were performed.

## Completed setup

Timestamp: 2026-10-05 23:37:50 PDT (`UTC-07:00`)

1. Confirmed the assessment workspace was initially not a Git repository.
2. Validated the two authorized GitHub remotes only:
   - Destination: `https://github.com/ashtonmoraes07/juniper-salon-temporal.git`
   - Official starter: `https://github.com/john-b-yang/temporal-waitlist-assessment-starter`
3. Observed that the destination had no advertised `HEAD`, while the starter advertised `refs/heads/main` at commit `7c92727fa8398d1229cca152b5e6e8982e97cae1`.
4. Preserved discovery documentation that appeared in the shared workspace during setup; it remains untracked and was not overwritten.
5. Initialized Git locally, configured the destination as `origin`, and retained the official source as `starter`.
6. Fetched and checked out `starter/main` without using GitHub's Fork mechanism.
7. Established local branch `main` at the starter baseline:
   - Commit: `7c92727fa8398d1229cca152b5e6e8982e97cae1`
   - Subject: `Add Temporal assessment starter`
   - Current tracking branch: `starter/main`
8. Confirmed local prerequisites:
   - Node.js `v24.17.0` (starter requires Node.js 20 or newer)
   - npm `11.13.0`
   - Docker `28.5.2`
   - Docker Compose `v2.40.3-desktop.1`
9. Installed the exact lockfile dependency graph with `npm ci`:
   - 231 packages added
   - 232 packages audited
   - 0 vulnerabilities reported
10. Ran `npm run typecheck`; it completed successfully with exit code 0.
11. Ran `git diff --check`; it reported no tracked-file whitespace errors.

## Validation blockers

### Workflow test

`npm test` could not be completed in the managed Windows environment.

- The first sandboxed attempt could not download Temporal's official ephemeral test server because DNS access was blocked.
- A permitted retry successfully passed the download stage but failed while Webpack loaded `@swc/core`.
- Exact terminal cause: `Error: Failed to load native binding` with `ERR_SWC_NATIVE_CACHE`; SWC rejected the sandbox-managed native cache directory because of its Windows DACL. Redirecting `SWC_NATIVE_BINDING_CACHE` to a workspace path did not resolve the load failure.
- A diagnostic confirmed that `@swc/core-win32-x64-msvc@1.16.13` and its native binary were installed. Temporarily placing that already-installed binary beside `@swc/core` bypassed the SWC cache layer without changing tracked source; the test then advanced to Temporal's ephemeral-server download and stopped only on sandbox DNS resolution.
- A further approved out-of-sandbox retry could reach the network layer, but its isolated execution environment did not see the temporary native-binary placement and therefore reproduced the SWC binding error. These two environment restrictions could not be eliminated simultaneously in this managed session.
- The failure occurred before the workflow test executed, so it is an environment/toolchain blocker and is not evidence of either passing or failing workflow behavior.

### Docker-backed demo

The neutral browser demo could not be launched because Docker Desktop's Linux engine was not running.

A subsequent `docker desktop start` attempt was allowed to run for about 90 seconds but produced no completion output. A fresh `docker desktop status`/`docker info` check still found no running Linux engine, so the hanging start command was stopped and no demo validation was claimed.

`docker info` returned:

```text
error during connect: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
```

Because the Temporal service could not start, the app at `http://localhost:3000` and Temporal UI at `http://localhost:8233` were not claimed as validated.

## Current repository state

- `origin` points to the provided destination repository.
- `starter` points to the official starter repository.
- Local `main` is at the official starter commit and currently tracks `starter/main` until the first authorized destination push establishes `origin/main`.
- Starter application files are unchanged.
- Discovery and coordination files remain preserved as untracked workspace content.
- No commit or push was performed in this setup step.
- No public deployment was performed.

## Recommended next validation

Once Docker Desktop is running and the SWC native binding can load outside the managed cache restriction:

```powershell
npm test
npm run typecheck
npm run dev
```

Then open `http://localhost:3000`, complete the neutral demo, and inspect the resulting execution at `http://localhost:8233`.

## Juniper MVP implementation — 2026-10-06

1. Replaced the neutral starter with the approved `OpenSlotWorkflow` vertical slice and stable `open-slot/{slotId}` identity.
2. Added fixture eligibility filtering by service, stylist, and availability, ordered by `joinedAt` then client ID.
3. Added one-active-offer orchestration, configurable durable timer (15-minute rule / 10-second demo), accept, decline, skip, manual retry, and terminal filled/unfilled state.
4. Added retryable simulated `sendOffer` and idempotent simulated `bookSlot` Activities.
5. Added command-ID deduplication and a pending-command guard so competing accepts cannot both be acknowledged.
6. Added full status Query state/history/error, explicit already-filled API handling, and duplicate-start reuse behavior.
7. Rebuilt the browser as a responsive staff dashboard with client-response preview, failure injection, recovery controls, countdown, queue, and audit timeline.
8. Replaced README with verified quick-start instructions and an Implemented/Simulated/Excluded truth table.
9. Validation completed:
   - `npm run typecheck`: PASS
   - `npm run test:offline`: PASS (4 tests)
   - `node --check public/app.js`: PASS
   - API process startup: PASS (`http://localhost:3000` listener reported)
   - Local HTTP probe: BLOCKED by managed socket permissions
   - Temporal time-skipping suite: PASS after compiling Workflow source to JavaScript and setting `TEMPORAL_WORKFLOWS_PATH`
   - Docker end-to-end demo: NOT RUN; Docker Desktop Linux engine unavailable
10. No deployment was performed.

## Focused MVP validation and defect correction — 2026-10-06

Validation was repeated against `BUSINESS_NEEDS.md`, `REQUIREMENTS_HANDOFF.md`, and `docs/approved-mvp-spec.md` after the MVP implementation was available.

### Verified commands

- `npm run typecheck`: **PASS** with exit code 0.
- `npm run test:offline`: **PASS**, 4 tests passed and 0 failed.
- `node --check public/app.js`: **PASS** with exit code 0.
- `git diff --check`: **PASS** with no whitespace errors; Git reported only LF-to-CRLF conversion warnings.
- Targeted repository secret-pattern scan: **PASS**, no matching private-key or obvious credential assignments found.

### Temporal and HTTP validation

- The initial `npm test` attempts were blocked first by test-server download access and then by the managed Windows SWC native-cache policy. After the official Temporal test server was available, the Workflow source was compiled to JavaScript and supplied through `TEMPORAL_WORKFLOWS_PATH`, bypassing only the SWC transpilation step. All nine tests then passed: four offline and five Temporal Workflow scenarios.
- A local API launch printed `Juniper Salon prototype is available at http://localhost:3000`, but managed loopback probes were denied or timed out and the launched process did not remain available to the probe. Static/HTTP behavior is therefore **BLOCKED**, not passed.
- `docker info` still could not connect to `//./pipe/dockerDesktopLinuxEngine`. No Docker-backed Temporal execution or browser end-to-end result is claimed.

### Defects corrected during focused review

1. Replaced locale-sensitive client-ID tie-breaking with deterministic lexical comparison for equal `joinedAt` values.
2. Corrected in-flight command deduplication so a repeated `commandId` waits for and returns the original result instead of receiving a competing-command result.
3. Aligned the simulated booking idempotency key with the approved `booking:{slotId}` contract.
4. Added a recoverable `booking-failed` state: exhausted booking retries preserve the accepted client's claim, expose the error, and allow a new accept command to retry with the same key.
5. Added focused Workflow tests for in-flight command deduplication and booking-failure recovery, plus dashboard controls that expose booking retry. The Workflow suite now executes successfully through Temporal's official time-skipping test server.

### Resumed validation — 2026-10-06

1. Downloaded and launched Temporal's official ephemeral test server through the TypeScript test environment.
2. Added the optional `TEMPORAL_WORKFLOWS_PATH` test override so managed hosts can bundle precompiled JavaScript when native SWC loading is restricted.
3. Increased phase polling from about one second to about ten seconds so the recovery test can observe the configured three-attempt Activity retry sequence.
4. Re-ran the complete suite: **9 passed, 0 failed**.
5. Updated the validation matrix, README capability claims, and presentation evidence boundary to match the executed result.

The concise evidence status is maintained in `VALIDATION_STRATEGY.md`. No deployment was performed during validation.
