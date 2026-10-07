# Juniper Salon Open Slot MVP Specification

The approved MVP fills one cancellation opening by offering it to eligible waitlisted clients in earliest-joined order. Temporal durably owns the sequential offers, response deadline, failure recovery, and exclusive booking. Delivery and booking are simulated boundaries, not live integrations.

## Scope and outcome

- Start one process for an open slot containing service, stylist, and appointment time plus immutable waitlist fixtures.
- Select fixtures matching the slot's service, stylist or time fit, and stated availability; order matches by `joinedAt`, then `clientId` for deterministic ties.
- Maintain one active offer. Acceptance fills the slot; decline, skip, or expiry advances once; exhausting the list ends `unfilled`.
- Keep non-winning clients on the waitlist. A late acceptance after fill returns `already-filled` and cannot displace the confirmed client.

## Temporal contract

| Element | Approved design |
| --- | --- |
| Workflow | `OpenSlotWorkflow`, one execution per opening |
| Workflow ID | `open-slot/{slotId}`; reject duplicate starts and return the existing execution status |
| Input | Immutable slot fields, fixture match and availability fields, and `offerTtlMs`; eligibility is a pure predicate, not a rules engine |
| Timer | One durable response timer after a successful send; `900000` ms production rule and about `10000` ms demo value, resolved before Workflow start |
| State | `phase`, `currentClient`, `offerDeadline`, ordered `history`, `lastError`, handled command IDs, and `terminalState` |
| Query | `getOpenSlotStatus` returns current client, deadline, history, last error, phase, and terminal state without external I/O |
| Updates | `accept`, `decline`, and `skip`, each with `clientId` and `commandId`; duplicate commands return their recorded result |
| Outcomes | `filled` or `unfilled`; command results include `booked`, `already-filled`, `not-active`, and `booking-failed` |

`sendOffer` is a simulated Activity using `offer:{slotId}:{clientId}`. It has three attempts, a five-second `StartToClose` timeout per attempt, one-second initial retry interval, and exponential backoff. A test-controlled failure mode makes recovery observable. On success it returns the successful attempt number for product history. After exhausted retries, the Workflow enters `send-failed`, exposes `lastError`, and waits for `skip`; skip records the failure and advances without losing prior history.

`bookSlot` is a simulated idempotent Activity keyed by `booking:{slotId}`. An active client's acceptance claims the offer and cancels its response timer before booking. Success records `filled` and stops all outreach. Exhausted booking retries record `booking-failed`; repeating the same client's accept safely retries with the same key. Decline records the response, leaves that client waitlisted, and advances. Timer expiry records `expired` and advances. Commands from a non-current client return `not-active`.

After a successful booking, the Workflow completes with its terminal result. A later accept endpoint reads that result and returns `already-filled` instead of sending an Update. Only `bookSlot` changes booking state, so no late or losing response removes a client from the waitlist.

Worker or API restarts do not reset Workflow state, timers, command deduplication, Activity retry progress, or history. Transient Activity failures remain visible in Temporal event history; final failures and recovery points also appear in the product Query.

## Acceptance evidence

- Fixtures prove eligibility filtering, fair ordering, and no more than one active offer.
- Decline and the ten-second demo timer each advance to the next eligible client.
- Duplicate start returns the existing Workflow; repeated commands do not repeat decisions.
- Simulated send failure demonstrates retry recovery and exhausted-failure skip recovery.
- Repeated accept or booking retry produces exactly one booking.
- Competing and late accepts preserve the original booking and return an unambiguous outcome.
- Query evidence shows the current client, deadline, response history, result, last error, and recovery point.

## Explicit exclusions

The MVP excludes real SMS, calendar or spreadsheet integration, authentication and authorization, deployment, scheduling optimization, child Workflows, and rules engines. It does not establish production scale, privacy, high availability, or operational readiness.
