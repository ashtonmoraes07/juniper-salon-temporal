import assert from "node:assert/strict";
import { test } from "node:test";
import { selectEligibleCandidates, slotWorkflowId } from "../src/domain";
import type { OpenSlot, WaitlistCandidate } from "../src/types";

const slot: OpenSlot = {
  id: "slot-1",
  startsAt: "2026-10-08T14:30:00-07:00",
  service: "Color refresh",
  stylist: "Maya",
};

function candidate(
  id: string,
  joinedAt: string,
  overrides: Partial<WaitlistCandidate> = {},
): WaitlistCandidate {
  return {
    id,
    name: id,
    phone: "masked",
    services: [slot.service],
    stylists: [slot.stylist],
    availableSlotIds: [slot.id],
    joinedAt,
    ...overrides,
  };
}

test("filters by service, stylist, and availability then orders oldest first", () => {
  const result = selectEligibleCandidates(slot, [
    candidate("newer", "2026-10-03T10:00:00Z"),
    candidate("wrong-service", "2026-09-01T10:00:00Z", {
      services: ["Haircut"],
    }),
    candidate("oldest", "2026-10-01T10:00:00Z"),
    candidate("unavailable", "2026-09-02T10:00:00Z", {
      availableSlotIds: [],
    }),
    candidate("any-stylist", "2026-10-02T10:00:00Z", {
      stylists: ["Any stylist"],
    }),
  ]);
  assert.deepEqual(
    result.map(({ id }) => id),
    ["oldest", "any-stylist", "newer"],
  );
});

test("derives a stable workflow ID from the slot business key", () => {
  assert.equal(slotWorkflowId("slot-1"), "open-slot/slot-1");
  assert.equal(slotWorkflowId("slot-1"), slotWorkflowId("slot-1"));
});

test("breaks equal joinedAt timestamps deterministically by client ID", () => {
  const sameTime = "2026-10-01T10:00:00Z";
  const result = selectEligibleCandidates(slot, [
    candidate("client-z", sameTime),
    candidate("client-a", sameTime),
  ]);
  assert.deepEqual(result.map(({ id }) => id), ["client-a", "client-z"]);
});
