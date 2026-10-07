# Requirements Handoff — Juniper Salon Waitlist

## Purpose

This package translates the customer evidence into implementation-neutral requirements for architecture, prototype, validation, and presentation work. `BUSINESS_NEEDS.md` remains the source for business context.

## Requirements

| ID | Requirement | Acceptance evidence |
|---|---|---|
| RQ-01 | Represent a cancellation opening with service, stylist, and time information. | A demo opening exposes all three fields. |
| RQ-02 | Consider only clients whose service, stylist/time fit, and availability match the opening. | A scenario with eligible and ineligible fixtures shows only eligible clients entering outreach. |
| RQ-03 | Order eligible clients by earliest waitlist join time. | A deliberately unordered fixture produces outreach in ascending join-time order. |
| RQ-04 | Contact no more than one eligible client at a time for an opening. | During each pending offer, no second active offer exists for that opening. |
| RQ-05 | Apply a 15-minute response window to same-day offers. | Configuration or test evidence preserves the 15-minute production rule; the demo may use the documented shortened timer assumption. |
| RQ-06 | On timely acceptance, fill the slot and stop further offers. | Happy-path evidence shows one confirmed client and no later outreach. |
| RQ-07 | On decline or expiration, continue to the next eligible client without repeating completed work. | Decline and timeout scenarios show ordered progression and preserved history. |
| RQ-08 | Handle a reply received after the slot is filled by reporting that the slot is taken without displacing the confirmed client. | Late-reply scenario returns the taken outcome and preserves the original confirmation. |
| RQ-09 | Prevent two clients from believing they hold the same slot. | Concurrency or competing-response test yields at most one successful confirmation. |
| RQ-10 | Make failures visible to staff and support recovery without losing progress. | Failure/recovery scenario exposes the failure and resumes from the correct preserved point without duplicate completed outreach. |
| RQ-11 | Preserve a respectful, unambiguous client outcome for offer, expiration, acceptance, decline, and late reply. | Demo output or tests distinguish each outcome clearly. |
| RQ-12 | Provide enough observable history for staff to understand the current client, deadline, responses, result, failures, and recovery point. | Demonstration shows these facts for happy-path and recovery scenarios. |

## MVP Boundary

The first prototype must demonstrate one opening moving through eligibility, fair ordering, sequential outreach, response handling, exclusive fill, and visible failure/recovery. Fixture-based data and simulated communication are acceptable. Production integrations, a polished staff interface, and policy choices not present in customer evidence are outside the MVP.

## Prototype Assumptions

1. Availability is represented by explicit eligible fixture data.
2. A decline keeps the client on the waitlist unless staff removes them.
3. The demo timer is shortened, but the production rule is 15 minutes for same-day offers.

## Terms

- **Open slot:** Appointment availability created by a cancellation.
- **Eligible client:** A waitlisted client matching the service, stylist/time fit, and availability criteria.
- **Fair order:** Earliest waitlist join time among eligible clients.
- **Active offer:** The single current opportunity presented to one client for one open slot.
- **Late reply:** A response received after the slot has already been filled.
- **Preserved progress:** Completed decisions and outreach are not lost or incorrectly repeated after recovery.

## Constraints and Exclusions

- Do not ask the customer to select architecture or technology.
- Do not represent the three prototype assumptions as confirmed customer policy.
- Do not claim numeric business improvement without measured baselines and results.
- Do not infer production integration, privacy, retention, access-control, or non-same-day timing requirements that were not supplied.
- Public deployment is outside the assessment scope, as recorded in `EXECUTION_RECORD.md`.

## Downstream Validation Focus

- Happy path: first eligible client accepts.
- Fair progression: earlier eligible client declines; next eligible client receives the offer.
- Timer path: offer expires and outreach advances.
- Late reply: filled slot remains with the confirmed client.
- Exclusivity: competing responses cannot create two confirmations.
- Recovery: an injected failure is visible, then resumes without duplicate completed work or lost position.

