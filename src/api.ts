import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  Client,
  Connection,
  WorkflowExecutionAlreadyStartedError,
} from "@temporalio/client";
import express, { type NextFunction, type Request, type Response } from "express";
import { slotWorkflowId } from "./domain";
import type {
  OpenSlot,
  SlotAction,
  SlotActionName,
  SlotActionResult,
  SlotWorkflowState,
  WaitlistCandidate,
} from "./types";
import { slotWaitlistWorkflow } from "./workflows";

const DEMO_TIMEOUT_MS = 10_000;
const PRODUCTION_TIMEOUT_MS = 15 * 60 * 1000;

const slot: OpenSlot = {
  id: "thu-1430-color",
  startsAt: "2026-10-08T14:30:00-07:00",
  service: "Color refresh",
  stylist: "Maya",
};

const candidates: WaitlistCandidate[] = [
  {
    id: "client-ava",
    name: "Ava R.",
    phone: "••• ••• 0184",
    services: ["Color refresh"],
    stylists: ["Maya"],
    availableSlotIds: [slot.id],
    joinedAt: "2026-10-02T09:15:00-07:00",
  },
  {
    id: "client-nia",
    name: "Nia K.",
    phone: "••• ••• 7742",
    services: ["Color refresh", "Gloss"],
    stylists: ["Any stylist"],
    availableSlotIds: [slot.id],
    joinedAt: "2026-10-03T11:40:00-07:00",
  },
  {
    id: "client-jules",
    name: "Jules M.",
    phone: "••• ••• 5910",
    services: ["Haircut"],
    stylists: ["Maya"],
    availableSlotIds: [slot.id],
    joinedAt: "2026-09-30T08:05:00-07:00",
  },
  {
    id: "client-remy",
    name: "Remy S.",
    phone: "••• ••• 2209",
    services: ["Color refresh"],
    stylists: ["Maya"],
    availableSlotIds: [],
    joinedAt: "2026-10-01T16:20:00-07:00",
  },
];

const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

let clientPromise: Promise<Client> | undefined;
function getClient(): Promise<Client> {
  clientPromise ??= Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  }).then((connection) => new Client({ connection, namespace: "default" }));
  return clientPromise;
}

function assertKnownSlot(slotId: string): void {
  if (slotId !== slot.id) throw new Error(`Unknown slot: ${slotId}`);
}

app.get("/api/fixture", (_request, response) => {
  response.json({
    slot,
    candidates,
    demoTimeoutMs: DEMO_TIMEOUT_MS,
    productionTimeoutMs: PRODUCTION_TIMEOUT_MS,
  });
});

app.post("/api/slots/:slotId/start", async (request, response) => {
  assertKnownSlot(request.params.slotId);
  const workflowId = slotWorkflowId(slot.id);
  const client = await getClient();
  let reused = false;
  try {
    await client.workflow.start(slotWaitlistWorkflow, {
      workflowId,
      workflowIdReusePolicy: "REJECT_DUPLICATE",
      taskQueue: "juniper-salon",
      args: [
        {
          slot,
          candidates,
          offerTimeoutMs:
            request.body?.demo === false
              ? PRODUCTION_TIMEOUT_MS
              : DEMO_TIMEOUT_MS,
          simulateSendFailure: request.body?.simulateSendFailure === true,
        },
      ],
    });
  } catch (error) {
    if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error;
    reused = true;
  }
  response.status(reused ? 200 : 201).json({ workflowId, reused });
});

app.get("/api/slots/:slotId", async (request, response) => {
  assertKnownSlot(request.params.slotId);
  const client = await getClient();
  const state = await client.workflow
    .getHandle(slotWorkflowId(slot.id))
    .query<SlotWorkflowState>("getOpenSlotStatus");
  response.json(state);
});

app.post("/api/slots/:slotId/actions/:action", async (request, response) => {
  assertKnownSlot(request.params.slotId);
  const allowedActions: SlotActionName[] = ["accept", "decline", "skip", "retry"];
  const action = request.params.action as SlotActionName;
  if (!allowedActions.includes(action)) {
    response.status(400).json({ error: `Unknown action: ${request.params.action}` });
    return;
  }
  const payload: SlotAction = {
    action,
    commandId:
      typeof request.body?.commandId === "string"
        ? request.body.commandId
        : randomUUID(),
    candidateId:
      typeof request.body?.candidateId === "string"
        ? request.body.candidateId
        : undefined,
    actor: request.body?.actor === "client" ? "client" : "staff",
  };
  const client = await getClient();
  const handle = client.workflow.getHandle(slotWorkflowId(slot.id));
  const current = await handle.query<SlotWorkflowState>("getOpenSlotStatus");
  if (action === "accept" && current.terminalState === "filled") {
    response.json({
      result: {
        outcome: "already-filled",
        message: `${current.bookedCandidate?.name ?? "Another client"} already filled this opening. You remain on the waitlist.`,
      },
    });
    return;
  }
  try {
    const result = await handle.executeUpdate<SlotActionResult, [SlotAction]>(
      "takeSlotAction",
      { args: [payload] },
    );
    response.json({ result });
  } catch (updateError) {
    if (action === "accept") {
      try {
        const finalState = await handle.query<SlotWorkflowState>(
          "getOpenSlotStatus",
        );
        if (finalState.terminalState === "filled") {
          response.json({
            result: {
              outcome: "already-filled",
              message: `${finalState.bookedCandidate?.name ?? "Another client"} already filled this opening. You remain on the waitlist.`,
            },
          });
          return;
        }
      } catch {
        // Preserve the original Update error if terminal state cannot be read.
      }
    }
    throw updateError;
  }
});

app.use(
  (error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    console.error(error);
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected error",
    });
  },
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () =>
  console.log(`Juniper Salon prototype is available at http://localhost:${port}`),
);
