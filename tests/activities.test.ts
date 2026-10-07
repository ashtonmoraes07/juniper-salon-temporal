import assert from "node:assert/strict";
import { test } from "node:test";
import { bookSlot } from "../src/activities";

test("booking Activity returns one booking for a repeated idempotency key", async () => {
  const input = {
    slot: {
      id: "idempotent-slot",
      startsAt: "2026-10-08T14:30:00-07:00",
      service: "Color refresh",
      stylist: "Maya",
    },
    candidate: {
      id: "ava",
      name: "Ava",
      phone: "masked",
      services: ["Color refresh"],
      stylists: ["Maya"],
      availableSlotIds: ["idempotent-slot"],
      joinedAt: "2026-10-01T09:00:00Z",
    },
    idempotencyKey: "booking:idempotent-slot",
  };

  const first = await bookSlot(input);
  const repeated = await bookSlot(input);
  assert.equal(first.bookingId, repeated.bookingId);
  assert.equal(first.alreadyBooked, false);
  assert.equal(repeated.alreadyBooked, true);
});
