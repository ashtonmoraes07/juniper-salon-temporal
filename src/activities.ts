import { activityInfo } from "@temporalio/activity";
import type {
  BookSlotInput,
  BookSlotResult,
  SendOfferInput,
  SendOfferResult,
} from "./types";

const simulatedBookings = new Map<string, BookSlotResult>();

export async function sendOffer(input: SendOfferInput): Promise<SendOfferResult> {
  const attempt = activityInfo().attempt;
  if (input.failUntilManualRetry && input.deliveryRound === 1) {
    throw new Error(
      `Simulated SMS provider outage for ${input.candidate.id} (attempt ${attempt}).`,
    );
  }
  return {
    providerMessageId: `sim-${input.slot.id}-${input.candidate.id}-${input.offerNumber}`,
    attempt,
    channel: "simulated-sms",
  };
}

export async function bookSlot(input: BookSlotInput): Promise<BookSlotResult> {
  const existing = simulatedBookings.get(input.idempotencyKey);
  if (existing) return { ...existing, alreadyBooked: true };
  const result = {
    bookingId: `booking-${input.slot.id}-${input.candidate.id}`,
    alreadyBooked: false,
  };
  simulatedBookings.set(input.idempotencyKey, result);
  return result;
}
