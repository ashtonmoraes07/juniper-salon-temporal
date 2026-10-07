# Business Needs — Juniper Salon

## Status and Evidence

- Customer: Juniper Salon
- Primary discovery participant: Lena
- Evidence status: Customer evidence supplied by the user from the Lena discovery conversation
- Last updated: 2026-10-05
- Technical decisions requested from Lena: None

> This is the authoritative, customer-readable record of business needs. Customer evidence, unresolved questions, and prototype assumptions are kept distinct.

## Business Problem

Last-minute appointment cancellations create gaps in salon schedules. Staff currently track interested clients in a spreadsheet and manually text them, producing time-consuming back-and-forth while an open slot may remain unfilled.

## Current Process

1. A last-minute cancellation creates an open appointment slot.
2. Staff consult a spreadsheet containing the waitlist.
3. Staff determine which clients could take the slot based on the service, stylist/time fit, and the client's stated availability.
4. Staff manually contact prospective clients.
5. Staff manage replies and continue outreach until the slot is filled or no suitable client accepts.

## Users and Stakeholders

| Group | Need |
|---|---|
| Salon staff | Fill cancellation gaps quickly with less manual texting and back-and-forth. |
| Eligible waitlisted clients | Receive a fair opportunity, enough time to respond, and respectful, unambiguous communication. |
| Salon staff responsible for the opening | Preserve visibility and control when outreach fails or needs recovery. |

## Business Rules

1. A client is eligible only when the requested service, stylist/time fit, and client availability match the open slot.
2. Among eligible clients, fairness is determined by earliest waitlist join time.
3. Clients are contacted one at a time, in fair order.
4. For a same-day opening, the contacted client ordinarily has about 15 minutes to respond.
5. Only one client may believe they currently hold or have secured a particular slot.
6. If a client replies after the slot has been filled, they are told that the slot is no longer available and may remain on the waitlist.
7. Staff must be able to see failures and recover without losing completed progress.

## Failure and Exception Cases

| Situation | Required business response |
|---|---|
| Contact attempt or related processing fails | Make the failure visible to staff and allow recovery without losing prior progress. |
| Client does not respond within the same-day response window | Continue to the next eligible client in fair order. |
| Client replies after another client has filled the slot | Clearly state that the slot is taken; allow the late client to remain on the waitlist. |
| Multiple clients might infer they hold the same slot | Prevent ambiguous or conflicting promises; no more than one client may believe the slot is theirs. |
| No eligible client accepts | Leave the outcome visible to staff for appropriate follow-up. |

## Information Needs

Staff need a clear view of:

- The open slot, including service, stylist, and time.
- Waitlist join time.
- The eligibility factors used for each client: service, stylist/time fit, and availability.
- Which client, if any, is currently being contacted.
- The response deadline for the current offer.
- Client responses and whether the slot has been filled.
- Failures, completed progress, and the point from which work can safely resume.

Clients need clear communication about:

- The appointment being offered.
- How long they have to respond when a deadline applies.
- Whether their acceptance secured the slot.
- Whether a late reply arrived after the slot was taken.
- Whether they remain on the waitlist.

## Desired Outcomes and Priorities

Desired outcomes from the supplied evidence (not a confirmed ranking):

1. Fill last-minute openings more quickly.
2. Reduce manual texting and staff back-and-forth.
3. Preserve fair treatment using waitlist join time among eligible clients.
4. Give clients a respectful and unambiguous experience.
5. Make failures visible and recoverable without lost progress.

## Scope for the First Useful Prototype

### In scope

- Represent an open slot and an ordered waitlist.
- Determine the ordered set of eligible clients from the available evidence.
- Contact one eligible client at a time.
- Apply the same-day response-window rule.
- Handle acceptance, decline, timeout/no response, and late reply after fill.
- Prevent conflicting ownership or promises for one slot.
- Expose failures and demonstrate recovery without losing progress.

### Not established by the customer evidence

- Production messaging provider or channel
- Production scheduling, spreadsheet, or client-system integration
- Exact staff interface design
- Rules for non-same-day response windows
- Policy for removing clients from the waitlist after repeated declines or timeouts
- Privacy, retention, reporting, and permissions details beyond the stated visibility need

## Measurable Success Criteria

The supplied evidence defines directional outcomes but does not provide numeric baselines or targets. The prototype can be accepted when it demonstrates that:

1. Eligible clients are approached one at a time in earliest-join order.
2. A same-day offer expires according to the 15-minute business rule.
3. Acceptance fills the slot without allowing another client to believe they hold it.
4. Decline or no timely response advances outreach without repeating completed work.
5. A late reply after fill receives an unambiguous “slot taken” outcome and does not displace the confirmed client.
6. A simulated failure is visible and recovery continues from preserved progress.
7. Staff effort and client response behavior can be observed sufficiently to evaluate quicker fills and reduced back-and-forth.

Quantitative production measures still requiring a baseline and target include average time to fill, staff touches per cancellation, percentage of openings filled, failure-recovery time, and client complaints or conflicting-confirmation incidents.

## Prototype Assumptions — Not Customer Decisions

These unresolved points are temporarily fixed only so a prototype can be built and tested:

1. **Eligibility data assumption:** Client availability and other matching inputs are represented by explicit eligible fixture data.
2. **Decline-policy assumption:** A decline keeps the client on the waitlist unless staff removes them.
3. **Timer assumption:** The demo timer is shortened for practical demonstration, while the production business rule remains 15 minutes for same-day offers.

## Open Questions for Later Validation

- What response window applies to openings that are not same-day?
- What exact staff action closes outreach when nobody accepts?
- When should a client be removed, paused, or deprioritized on the waitlist?
- What quantitative baselines and targets define “quicker” and “less back-and-forth”?
- What privacy, retention, reporting, access, and audit requirements apply in production?

## Confirmation Record

- Customer evidence incorporated: Yes
- Evidence source: User-supplied summary of Lena discovery evidence
- Assumptions separated from customer facts: Yes
- Direct customer confirmation of this written summary: Not recorded

