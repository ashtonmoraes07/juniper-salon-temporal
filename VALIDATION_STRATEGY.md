# Juniper Salon MVP — Validation Evidence Matrix

Updated: 2026-10-06 (America/Los_Angeles)  
Scope: local validation only; no deployment or production integration

## Status meanings

- **PASS** — the stated command or assertion executed successfully in this environment.
- **CODE-REVIEWED** — the implementation and focused test coverage were inspected, but the Temporal runtime assertion did not execute here.
- **BLOCKED** — the intended runtime check could not reach its assertions because of an environment or toolchain constraint.

## Eight-case evidence matrix

| ID | Requirement focus | Evidence and command | Result | Status |
|---|---|---|---|---|
| V-01 | Static correctness and repository diff hygiene | `npm run typecheck`; `node --check public/app.js`; `git diff --check` | TypeScript and browser JavaScript checks completed with exit code 0. The diff check found no whitespace errors; Git emitted only line-ending conversion warnings. | **PASS** |
| V-02 | Stable `open-slot/{slotId}` identity; exact eligibility; deterministic oldest-first ordering | `npm run test:offline` → `tests/domain.test.ts` | Service, stylist/“Any stylist,” and slot availability are all required. Results sort by `joinedAt`, then deterministic client ID. The stable Workflow-ID helper was asserted. | **PASS** |
| V-03 | Idempotent simulated booking boundary | `npm run test:offline` → `tests/activities.test.ts` | Repeating `bookSlot` with one idempotency key returned the same booking ID and reported the repeat. This proves only the process-local simulated Activity behavior. | **PASS** |
| V-04 | One active offer and configurable durable response timer | `npm test` → timeout-boundary Workflow scenario | Sequential control kept one active offer; the durable timer advanced from Ava to Nia; Ava's late accept was rejected without affecting Nia. | **PASS** |
| V-05 | Command deduplication and simultaneous-accept protection | `npm test` → in-flight duplicate command scenario | Two concurrent Updates with one `commandId` returned the same booked result and invoked the booking Activity exactly once. The API's completed-Workflow `already-filled` branch remains code-reviewed. | **PASS** |
| V-06 | Simulated send failure, bounded retries, and manual recovery without lost progress | `npm test` → send recovery scenario | Three Activity attempts exhausted, `send-failed` became queryable, staff Retry resumed delivery, and history retained both failure and recovery events. | **PASS** |
| V-07 | Accepted-client claim and idempotent recovery after booking failure | `npm test` → booking recovery scenario | Three automatic booking attempts failed; the accepted client remained claimed; a repeated accept retried with the stable key and completed on the fourth Activity call. | **PASS** |
| V-08 | Temporal Workflow suite and local HTTP/Docker demonstration | Precompile Workflow source with `npx tsc --outDir tmp\\test-dist`, set `TEMPORAL_WORKFLOWS_PATH`, then run `npm test`; API loopback probes; `docker info` | All 9 tests passed: 4 offline and 5 Temporal Workflow scenarios. Precompilation bypassed only the managed host's SWC native-cache restriction. The Docker-backed browser end-to-end run remains unavailable because the Linux engine pipe is absent. | **PASS WITH E2E LIMITATION** |

## Acceptance interpretation

The executed evidence supports static correctness, exact fixture matching/order, stable ID derivation, browser-script syntax, process-local booking idempotency, and five Temporal Workflow scenarios covering booking, retry recovery, command deduplication, booking recovery, and timeout/late-response isolation. A Docker-backed browser end-to-end run and crash/restart replay demonstration remain outside the evidence collected here.

Evaluator commands:

```powershell
npm ci
npm run typecheck
npm run test:offline
node --check public/app.js
npm test
npm run dev
```

Treat `npm test` and the browser demo as passing only when their Workflow assertions and HTTP interactions actually complete. No deployment is required or authorized for validation.
