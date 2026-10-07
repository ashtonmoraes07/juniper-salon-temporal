# Juniper Salon cancellation concierge

A local Temporal prototype that fills one cancellation opening by offering it to eligible waitlisted clients, one at a time, in fair oldest-first order. Temporal owns the offer sequence, response deadline, retries, operator recovery, exclusive booking, and audit history.

This repository is intentionally a thin vertical slice. It is not deployed and does not connect to salon production systems.

## Fast quick-start

Prerequisites:

- Node.js 20 or newer
- Docker Desktop with the Linux engine running

From the repository root:

```powershell
npm ci
npm run typecheck
npm run test:offline
npm run dev
```

Open:

- Staff dashboard and client-response preview: <http://localhost:3000>
- Temporal Web UI: <http://localhost:8233>

Click **Start 10-second demo**. The default path sends an offer to the oldest eligible fixture. Accept, decline, skip, or let the ten-second durable timer expire.

To demonstrate failure recovery, check **Simulate send outage** before starting. The simulated `sendOffer` Activity exhausts its three automatic attempts, the dashboard preserves the error and history, and staff can Retry or Skip. Retry starts a new delivery round that succeeds while retaining the original failure trail.

Stop the local services with:

```powershell
npm run stop
```

The production business rule is a 15-minute offer window (`900000` ms). The browser starts the same Workflow with a 10-second demo value so evaluators can see expiration without waiting.

## Demo reset

The Workflow uses the stable business ID `open-slot/thu-1430-color` and rejects duplicate executions. Repeated Start requests therefore return the existing Workflow status rather than creating another cancellation process.

To replay the demo from the beginning, stop the stack and remove only this prototype's local Temporal volume:

```powershell
npm run stop
docker volume rm post_assessment_temporal-data
```

If Compose generated a different project prefix, list volumes with `docker volume ls` and remove only the volume associated with this checkout. Do not use a broad prune command.

## What to inspect

The staff Query returns the complete durable view used by the UI:

- slot and phase;
- eligible candidates in deterministic order;
- current client and offer deadline;
- active offer and confirmed client;
- ordered business history;
- last durable error and terminal outcome;
- handled command IDs and their recorded results.

Temporal Web UI shows the corresponding Workflow Updates, durable timer, Activity attempts, retry backoff, and booking Activity.

## Temporal design

- **Workflow:** `OpenSlotWorkflow`, one execution per open slot.
- **Workflow ID:** `open-slot/{slotId}` with duplicate reuse rejected.
- **Eligibility:** pure Workflow-side filtering by service, stylist, and availability; sorted by `joinedAt`, then client ID.
- **One active offer:** the Workflow never advances until the active client declines, staff skips, the timer expires, or the client accepts.
- **Commands:** accept, decline, skip, and retry are durable Workflow Updates with command IDs. Duplicate command IDs return the stored result, while a competing command is rejected when another response is pending.
- **Delivery:** `sendOffer` is an Activity with a five-second per-attempt timeout, three attempts, one-second initial backoff, and exponential retry.
- **Booking:** `bookSlot` is an Activity keyed by `booking:{slotId}`. Its in-process simulated store returns the existing booking on a repeated Activity call within the same Worker process rather than creating a second booking. Exhausted retries preserve the accepted client's claim in `booking-failed`; a new accept command retries with the same key. A production integration would enforce the key in durable storage.
- **Late accept:** after completion, the API reads terminal Workflow state and returns `already-filled`; it does not start another execution or displace the booked client.
- **Query:** `getOpenSlotStatus` performs no external I/O and returns the complete staff-visible state.

## Verification

```powershell
npm run typecheck   # TypeScript static check
npm run test:offline # Offline domain and Activity-idempotency tests
npm test            # Domain plus Temporal time-skipping Workflow tests
```

The Temporal tests cover booking, timeout progression, command deduplication, and failure recovery. They require Temporal's official ephemeral test server and a working native SWC binding. On this managed Windows host, the suite was also verified by compiling the Workflow source to JavaScript and setting `TEMPORAL_WORKFLOWS_PATH` to that compiled entry point; this avoided a host-specific SWC native-cache restriction without changing Workflow behavior.

## Capability truth table

`Implemented; Temporal-tested` means the path executed against Temporal's official time-skipping test server. `Implemented; offline-tested` or `Activity-tested` identifies evidence that executed without a Temporal server. These labels are scope statements, not production-readiness claims.

| Capability | Scope classification | Evidence boundary |
|---|---|---|
| One Workflow per cancellation opening | Implemented; Temporal-tested | A stable slot-derived ID is used, and each test starts one Workflow for one opening. API duplicate-start reuse is implemented but remains browser end-to-end work. |
| Eligibility and fair ordering | Implemented; offline-tested | Four offline tests include exact fixture filtering, oldest-first order, deterministic ties, and stable ID derivation. |
| One active offer | Implemented; Temporal-tested | Sequential offer control and a stale-response boundary passed the time-skipping suite. |
| Response deadline | Implemented; Temporal-tested | A Temporal durable condition timeout uses 10 seconds in demo or 15 minutes in production configuration; timeout progression passed. |
| Accept, decline, staff skip, and retry | Implemented; Temporal-tested | Accept and retry Updates executed successfully; decline and staff skip remain code-reviewed. |
| Activity retry and manual recovery | Implemented; Temporal-tested | Automatic retry exhaustion, visible failure state, and staff Retry recovery passed. |
| Duplicate/competing command protection | Implemented; Temporal-tested | An in-flight duplicate command returned the original result and produced one booking call. |
| Exclusive booking | Implemented; Activity-tested with process-local simulation | The stable-key Activity passed its offline idempotency test; durable external uniqueness remains production work. |
| Staff status and history | Implemented; Temporal-tested | The status Query exposed phases, active offers, terminal state, errors, and preserved recovery history in the Workflow tests. |
| Client communication | Simulated | The SMS Activity returns a fixture provider message ID; no message leaves the machine. |
| Calendar booking | Simulated | The Activity records a local fixture result; no salon calendar is changed. |
| Waitlist data | Simulated | Names, masked phone numbers, preferences, and availability are explicit local fixtures. |
| Real SMS, calendar, or spreadsheet integration | Excluded | No credentials, provider calls, or external data sources are present. |
| Authentication and authorization | Excluded | The local demo has no identity or role enforcement. |
| Persistent application database | Excluded | Temporal persists orchestration locally; simulated booking state is in Worker memory. |
| Optimization/rules engine | Excluded | Eligibility is a narrow deterministic predicate. |
| Child Workflows | Excluded | The entire bounded slot lifecycle stays in one Workflow. |
| Deployment and production readiness | Excluded | No public deployment, scale, privacy, HA, or operational claims are made. |

## Repository map

- `src/workflows.ts` — durable slot orchestration, Query, and Updates
- `src/activities.ts` — simulated retryable send and idempotent booking effects
- `src/domain.ts` — pure eligibility, ordering, and Workflow-ID helpers
- `src/api.ts` — fixture API and Temporal Client boundary
- `src/types.ts` — shared domain and state contract
- `public/` — responsive staff dashboard and client-response preview
- `tests/` — offline domain and Temporal time-skipping tests
- `docs/approved-mvp-spec.md` — approved implementation contract

No public deployment is required or performed.
