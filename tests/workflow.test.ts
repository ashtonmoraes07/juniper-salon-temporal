import assert from "node:assert/strict";
import { test } from "node:test";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import type * as activities from "../src/activities";
import type {
  SlotAction,
  SlotActionResult,
  SlotWorkflowInput,
  SlotWorkflowState,
} from "../src/types";
import { slotWaitlistWorkflow } from "../src/workflows";

const workflowsPath =
  process.env.TEMPORAL_WORKFLOWS_PATH ?? require.resolve("../src/workflows");

const input: SlotWorkflowInput = {
  slot: {
    id: "test-slot",
    startsAt: "2026-10-08T14:30:00-07:00",
    service: "Color refresh",
    stylist: "Maya",
  },
  candidates: [
    {
      id: "ava",
      name: "Ava",
      phone: "masked",
      services: ["Color refresh"],
      stylists: ["Maya"],
      availableSlotIds: ["test-slot"],
      joinedAt: "2026-10-01T09:00:00Z",
    },
  ],
  offerTimeoutMs: 10_000,
  simulateSendFailure: false,
};

function createTestEnvironment(): Promise<TestWorkflowEnvironment> {
  const executablePath = process.env.TEMPORAL_TEST_SERVER_PATH;
  return TestWorkflowEnvironment.createTimeSkipping(
    executablePath
      ? {
          server: {
            executable: { type: "existing-path", path: executablePath },
          },
        }
      : undefined,
  );
}

async function waitForPhase(
  handle: { query<R>(query: string): Promise<R> },
  phase: SlotWorkflowState["phase"],
): Promise<SlotWorkflowState> {
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const state = await handle.query<SlotWorkflowState>("getOpenSlotStatus");
    if (state.phase === phase) return state;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Workflow did not reach ${phase}.`);
}

test("accepts an offer and books the slot once", async () => {
  const environment = await createTestEnvironment();
  try {
    const activityImplementations: typeof activities = {
      sendOffer: async () => ({
        providerMessageId: "test-message",
        attempt: 1,
        channel: "simulated-sms",
      }),
      bookSlot: async ({ slot, candidate }) => ({
        bookingId: `booking-${slot.id}-${candidate.id}`,
        alreadyBooked: false,
      }),
    };
    const worker = await Worker.create({
      connection: environment.nativeConnection,
      taskQueue: "slot-test",
      workflowsPath,
      activities: activityImplementations,
    });
    await worker.runUntil(async () => {
      const handle = await environment.client.workflow.start(slotWaitlistWorkflow, {
        workflowId: "slot-test-accept",
        taskQueue: "slot-test",
        args: [input],
      });
      const offered = await waitForPhase(handle, "offered");
      assert.equal(offered.activeOffer?.candidate.id, "ava");
      const accepted = await handle.executeUpdate("takeSlotAction", {
        args: [{ action: "accept", commandId: "accept-1", candidateId: "ava", actor: "client" }],
      });
      assert.deepEqual(accepted, {
        outcome: "booked",
        message: "Ava is booked for the opening.",
      });
      const filled = await waitForPhase(handle, "filled");
      assert.equal(filled.bookedCandidate?.id, "ava");
      assert.equal(filled.terminalState, "filled");
    });
  } finally {
    await environment.teardown();
  }
});

test("preserves failure history and recovers after staff retry", async () => {
  const environment = await createTestEnvironment();
  try {
    const activityImplementations: typeof activities = {
      sendOffer: async ({ deliveryRound }) => {
        if (deliveryRound === 1) throw new Error("simulated outage");
        return {
          providerMessageId: "recovered-message",
          attempt: 1,
          channel: "simulated-sms",
        };
      },
      bookSlot: async () => ({ bookingId: "unused", alreadyBooked: false }),
    };
    const worker = await Worker.create({
      connection: environment.nativeConnection,
      taskQueue: "recovery-test",
      workflowsPath,
      activities: activityImplementations,
    });
    await worker.runUntil(async () => {
      const handle = await environment.client.workflow.start(slotWaitlistWorkflow, {
        workflowId: "slot-test-recovery",
        taskQueue: "recovery-test",
        args: [{ ...input, simulateSendFailure: true }],
      });
      const failed = await waitForPhase(handle, "send-failed");
      assert.equal(failed.error?.code, "SIMULATED_SEND_FAILURE");
      await handle.executeUpdate("takeSlotAction", {
        args: [{ action: "retry", commandId: "retry-1", actor: "staff" }],
      });
      const recovered = await waitForPhase(handle, "offered");
      assert.ok(recovered.history.some(({ type }) => type === "send-failed"));
      assert.ok(recovered.history.some(({ type }) => type === "send-recovered"));
    });
  } finally {
    await environment.teardown();
  }
});

test("deduplicates an in-flight accept command and books exactly once", async () => {
  const environment = await createTestEnvironment();
  try {
    let bookingCalls = 0;
    const activityImplementations: typeof activities = {
      sendOffer: async () => ({
        providerMessageId: "test-message",
        attempt: 1,
        channel: "simulated-sms",
      }),
      bookSlot: async ({ slot, candidate }) => {
        bookingCalls += 1;
        return {
          bookingId: `booking-${slot.id}-${candidate.id}`,
          alreadyBooked: bookingCalls > 1,
        };
      },
    };
    const worker = await Worker.create({
      connection: environment.nativeConnection,
      taskQueue: "dedup-test",
      workflowsPath,
      activities: activityImplementations,
    });
    await worker.runUntil(async () => {
      const handle = await environment.client.workflow.start(slotWaitlistWorkflow, {
        workflowId: "slot-test-dedup",
        taskQueue: "dedup-test",
        args: [input],
      });
      await waitForPhase(handle, "offered");
      const request = {
        action: "accept" as const,
        commandId: "same-accept",
        candidateId: "ava",
        actor: "client" as const,
      };
      const [first, duplicate] = await Promise.all([
        handle.executeUpdate<SlotActionResult, [SlotAction]>("takeSlotAction", { args: [request] }),
        handle.executeUpdate<SlotActionResult, [SlotAction]>("takeSlotAction", { args: [request] }),
      ]);
      assert.deepEqual(first, duplicate);
      assert.equal(first.outcome, "booked");
      assert.equal(bookingCalls, 1);
    });
  } finally {
    await environment.teardown();
  }
});

test("preserves an accepted claim after booking failure and retries safely", async () => {
  const environment = await createTestEnvironment();
  try {
    let bookingCalls = 0;
    const activityImplementations: typeof activities = {
      sendOffer: async () => ({
        providerMessageId: "test-message",
        attempt: 1,
        channel: "simulated-sms",
      }),
      bookSlot: async ({ slot, candidate }) => {
        bookingCalls += 1;
        if (bookingCalls <= 3) throw new Error("simulated booking outage");
        return {
          bookingId: `booking-${slot.id}-${candidate.id}`,
          alreadyBooked: false,
        };
      },
    };
    const worker = await Worker.create({
      connection: environment.nativeConnection,
      taskQueue: "booking-recovery-test",
      workflowsPath,
      activities: activityImplementations,
    });
    await worker.runUntil(async () => {
      const handle = await environment.client.workflow.start(slotWaitlistWorkflow, {
        workflowId: "slot-test-booking-recovery",
        taskQueue: "booking-recovery-test",
        args: [input],
      });
      await waitForPhase(handle, "offered");
      const failed = await handle.executeUpdate<SlotActionResult, [SlotAction]>("takeSlotAction", {
        args: [{ action: "accept", commandId: "accept-fails", candidateId: "ava", actor: "client" }],
      });
      assert.equal(failed.outcome, "booking-failed");
      const failedState = await waitForPhase(handle, "booking-failed");
      assert.equal(failedState.currentClient?.id, "ava");
      assert.equal(failedState.lastError?.code, "BOOKING_FAILED");
      const recovered = await handle.executeUpdate<SlotActionResult, [SlotAction]>("takeSlotAction", {
        args: [{ action: "accept", commandId: "accept-retry", candidateId: "ava", actor: "client" }],
      });
      assert.equal(recovered.outcome, "booked");
      const filled = await waitForPhase(handle, "filled");
      assert.equal(filled.bookedCandidate?.id, "ava");
      assert.equal(bookingCalls, 4);
    });
  } finally {
    await environment.teardown();
  }
});

test("expires one offer without applying its response to the next client", async () => {
  const environment = await createTestEnvironment();
  try {
    const secondCandidate = {
      id: "nia",
      name: "Nia",
      phone: "masked",
      services: ["Color refresh"],
      stylists: ["Maya"],
      availableSlotIds: ["test-slot"],
      joinedAt: "2026-10-02T09:00:00Z",
    };
    const activityImplementations: typeof activities = {
      sendOffer: async ({ candidate }) => ({
        providerMessageId: `message-${candidate.id}`,
        attempt: 1,
        channel: "simulated-sms",
      }),
      bookSlot: async ({ slot, candidate }) => ({
        bookingId: `booking-${slot.id}-${candidate.id}`,
        alreadyBooked: false,
      }),
    };
    const worker = await Worker.create({
      connection: environment.nativeConnection,
      taskQueue: "timeout-boundary-test",
      workflowsPath,
      activities: activityImplementations,
    });
    await worker.runUntil(async () => {
      const handle = await environment.client.workflow.start(slotWaitlistWorkflow, {
        workflowId: "slot-test-timeout-boundary",
        taskQueue: "timeout-boundary-test",
        args: [{ ...input, candidates: [...input.candidates, secondCandidate] }],
      });
      const firstOffer = await waitForPhase(handle, "offered");
      assert.equal(firstOffer.activeOffer?.candidate.id, "ava");

      await environment.sleep(input.offerTimeoutMs);
      const secondOffer = await waitForPhase(handle, "offered");
      assert.equal(secondOffer.activeOffer?.candidate.id, "nia");

      const staleAccept = await handle.executeUpdate<SlotActionResult, [SlotAction]>(
        "takeSlotAction",
        {
          args: [
            {
              action: "accept",
              commandId: "late-ava-accept",
              candidateId: "ava",
              actor: "client",
            },
          ],
        },
      );
      assert.equal(staleAccept.outcome, "not-active");

      const current = await handle.query<SlotWorkflowState>("getOpenSlotStatus");
      assert.equal(current.activeOffer?.candidate.id, "nia");
      assert.equal(current.bookedCandidate, null);
    });
  } finally {
    await environment.teardown();
  }
});
