import {
  allHandlersFinished,
  condition,
  defineQuery,
  defineUpdate,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import type * as activities from "./activities";
import { selectEligibleCandidates, slotWorkflowId } from "./domain";
import type {
  SlotAction,
  SlotActionResult,
  SlotHistoryEvent,
  SlotWorkflowInput,
  SlotWorkflowState,
} from "./types";

const { sendOffer, bookSlot } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 seconds",
  retry: {
    initialInterval: "1 second",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export const getOpenSlotStatus =
  defineQuery<SlotWorkflowState>("getOpenSlotStatus");
export const takeSlotAction = defineUpdate<SlotActionResult, [SlotAction]>(
  "takeSlotAction",
);

export async function OpenSlotWorkflow(
  input: SlotWorkflowInput,
): Promise<SlotWorkflowState> {
  let eventId = 0;
  let offerSequence = 0;
  let pendingCommand:
    | {
        request: SlotAction;
        targetCandidateId: string;
        offerSequence: number;
      }
    | undefined;
  const eligibleCandidates = selectEligibleCandidates(input.slot, input.candidates);
  const state: SlotWorkflowState = {
    workflowId: slotWorkflowId(input.slot.id),
    slot: input.slot,
    phase: "matching",
    offerTimeoutMs: input.offerTimeoutMs,
    eligibleCandidates,
    currentCandidateIndex: 0,
    activeOffer: null,
    bookedCandidate: null,
    error: null,
    currentClient: null,
    offerDeadline: null,
    lastError: null,
    terminalState: null,
    handledCommands: {},
    history: [],
  };

  const record = (
    type: string,
    message: string,
    tone: SlotHistoryEvent["tone"] = "neutral",
  ) => {
    state.history.push({
      id: ++eventId,
      at: new Date(Date.now()).toISOString(),
      type,
      message,
      tone,
    });
  };

  const consumePendingCommand = () => {
    const command = pendingCommand;
    pendingCommand = undefined;
    return command;
  };

  setHandler(getOpenSlotStatus, () => state);
  setHandler(takeSlotAction, async (request): Promise<SlotActionResult> => {
    const previous = state.handledCommands[request.commandId];
    if (previous) return previous;

    if (pendingCommand?.request.commandId === request.commandId) {
      await condition(() => Boolean(state.handledCommands[request.commandId]));
      return state.handledCommands[request.commandId];
    }

    if (state.phase === "filled") {
      const message = `${request.actor === "client" ? "Client" : "Staff"} ${request.action} arrived after the slot was filled. The client remains on the waitlist.`;
      record("already-filled", message, "warning");
      const result = { outcome: "already-filled" as const, message };
      state.handledCommands[request.commandId] = result;
      return result;
    }

    const activeCandidate =
      state.activeOffer?.candidate ??
      state.eligibleCandidates[state.currentCandidateIndex];
    if (request.candidateId && request.candidateId !== activeCandidate?.id) {
      const message = "That offer is no longer active.";
      record("offer-closed", message, "warning");
      const result = { outcome: "not-active" as const, message };
      state.handledCommands[request.commandId] = result;
      return result;
    }

    if (pendingCommand) {
      const message = "Another response is already being processed for this offer.";
      const result = { outcome: "not-active" as const, message };
      state.handledCommands[request.commandId] = result;
      record("competing-command", message, "warning");
      return result;
    }

    const valid =
      (state.phase === "offered" &&
        ["accept", "decline", "skip"].includes(request.action)) ||
      (state.phase === "send-failed" &&
        ["retry", "skip"].includes(request.action)) ||
      (state.phase === "booking-failed" && request.action === "accept");
    if (!valid) {
      const message = `${request.action} is not available while the slot is ${state.phase}.`;
      record("invalid-action", message, "warning");
      const result = { outcome: "invalid-action" as const, message };
      state.handledCommands[request.commandId] = result;
      return result;
    }

    pendingCommand = {
      request,
      targetCandidateId: activeCandidate.id,
      offerSequence,
    };
    record(
      `${request.actor}-${request.action}`,
      `${request.actor === "client" ? activeCandidate.name : "Staff"} chose ${request.action}.`,
      request.action === "accept" ? "success" : "neutral",
    );
    await condition(() => Boolean(state.handledCommands[request.commandId]));
    return state.handledCommands[request.commandId];
  });

  record(
    "workflow-started",
    `Matched ${eligibleCandidates.length} eligible clients for ${input.slot.service} with ${input.slot.stylist}; oldest waitlist entry goes first.`,
  );

  for (
    state.currentCandidateIndex = 0;
    state.currentCandidateIndex < eligibleCandidates.length;
    state.currentCandidateIndex += 1
  ) {
    const candidate = eligibleCandidates[state.currentCandidateIndex];
    state.currentClient = candidate;
    const offerNumber = state.currentCandidateIndex + 1;
    let deliveryRound = 1;
    let skipCandidate = false;

    while (true) {
      state.phase = "sending";
      state.error = null;
      state.lastError = null;
      state.activeOffer = null;
      state.offerDeadline = null;
      record(
        "send-started",
        `Scheduling offer ${offerNumber} for ${candidate.name} through the simulated SMS Activity.`,
      );

      try {
        const delivery = await sendOffer({
          slot: input.slot,
          candidate,
          offerNumber,
          deliveryRound,
          failUntilManualRetry: input.simulateSendFailure,
        });
        const sentAt = new Date(Date.now()).toISOString();
        state.activeOffer = {
          candidate,
          sentAt,
          expiresAt: new Date(Date.now() + input.offerTimeoutMs).toISOString(),
          deliveryAttempts: delivery.attempt,
        };
        state.offerDeadline = state.activeOffer.expiresAt;
        state.phase = "offered";
        offerSequence += 1;
        record(
          deliveryRound > 1 ? "send-recovered" : "offer-sent",
          deliveryRound > 1
            ? `Offer delivery recovered for ${candidate.name}; the original failure remains in this history.`
            : `Offer sent to ${candidate.name}. The response window is ${input.offerTimeoutMs / 1000} seconds.`,
          "success",
        );
        break;
      } catch (error) {
        state.phase = "send-failed";
        state.error = {
          code: "SIMULATED_SEND_FAILURE",
          message:
            error instanceof Error ? error.message : "Offer delivery failed.",
        };
        state.lastError = state.error;
        record(
          "send-failed",
          `Offer delivery exhausted automatic retries for ${candidate.name}. Staff can retry or skip; no history was lost.`,
          "danger",
        );
        await condition(
          () =>
            pendingCommand?.targetCandidateId === candidate.id &&
            (pendingCommand.request.action === "retry" ||
              pendingCommand.request.action === "skip"),
        );
        const command = consumePendingCommand()?.request;
        if (!command) throw new Error("A send recovery command was lost.");
        state.handledCommands[command.commandId] = {
          outcome: "accepted",
          message: `${command.action} was durably recorded.`,
        };
        if (command.action === "skip") {
          record(
            "candidate-skipped",
            `${candidate.name} was skipped after the send failure.`,
          );
          skipCandidate = true;
          break;
        }
        deliveryRound += 1;
        record("manual-retry", `Staff retried delivery for ${candidate.name}.`);
      }
    }

    if (skipCandidate) continue;

    const responded = await condition(
      () =>
        pendingCommand?.targetCandidateId === candidate.id &&
        pendingCommand.offerSequence === offerSequence &&
        (pendingCommand.request.action === "accept" ||
          pendingCommand.request.action === "decline" ||
          pendingCommand.request.action === "skip"),
      input.offerTimeoutMs,
    );
    if (!responded) {
      const staleCommand = pendingCommand?.request;
      if (staleCommand) {
        state.handledCommands[staleCommand.commandId] = {
          outcome: "not-active",
          message: "That offer is no longer active.",
        };
        pendingCommand = undefined;
      }
      state.phase = "matching";
      record(
        "offer-expired",
        `${candidate.name}'s offer expired. Moving to the next eligible client.`,
        "warning",
      );
      state.activeOffer = null;
      state.offerDeadline = null;
      continue;
    }

    const command = consumePendingCommand()?.request;
    if (!command) continue;
    if (command.action === "decline" || command.action === "skip") {
      record(
        command.action === "decline" ? "offer-declined" : "candidate-skipped",
        `${candidate.name}'s offer was ${command.action === "decline" ? "declined" : "skipped"}. Moving to the next eligible client.`,
      );
      state.handledCommands[command.commandId] = {
        outcome: "accepted",
        message: `${command.action} was durably recorded.`,
      };
      state.activeOffer = null;
      state.offerDeadline = null;
      continue;
    }

    let bookingCommand = command;
    while (true) {
      state.phase = "booking";
      state.error = null;
      state.lastError = null;
      state.activeOffer = null;
      state.offerDeadline = null;
      record("booking-started", `Creating the booking for ${candidate.name}.`);
      try {
        const booking = await bookSlot({
          slot: input.slot,
          candidate,
          idempotencyKey: `booking:${input.slot.id}`,
        });
        state.bookedCandidate = candidate;
        state.phase = "filled";
        state.terminalState = "filled";
        record(
          "slot-filled",
          `${candidate.name} filled the slot (${booking.bookingId}). The booking Activity is idempotent.`,
          "success",
        );
        state.handledCommands[bookingCommand.commandId] = {
          outcome: "booked",
          message: `${candidate.name} is booked for the opening.`,
        };
        await condition(allHandlersFinished);
        return state;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Booking failed.";
        state.phase = "booking-failed";
        state.error = { code: "BOOKING_FAILED", message };
        state.lastError = state.error;
        record(
          "booking-failed",
          `Booking attempts were exhausted for ${candidate.name}. Their claim is preserved and a repeated accept can retry safely.`,
          "danger",
        );
        state.handledCommands[bookingCommand.commandId] = {
          outcome: "booking-failed",
          message: `Booking could not be completed for ${candidate.name}; retry accept to recover.`,
        };
        await condition(
          () =>
            pendingCommand?.request.action === "accept" &&
            pendingCommand.targetCandidateId === candidate.id &&
            pendingCommand.request.candidateId === candidate.id,
        );
        const retryCommand = consumePendingCommand()?.request;
        if (!retryCommand) throw new Error("A booking retry command was lost.");
        bookingCommand = retryCommand;
        record(
          "booking-retry",
          `Retrying the idempotent booking for ${candidate.name}.`,
        );
      }
    }
  }

  state.phase = "exhausted";
  state.terminalState = "unfilled";
  state.currentClient = null;
  state.activeOffer = null;
  state.offerDeadline = null;
  record("waitlist-exhausted", "No eligible waitlist candidates remain.", "warning");
  await condition(allHandlersFinished);
  return state;
}

export const slotWaitlistWorkflow = OpenSlotWorkflow;
