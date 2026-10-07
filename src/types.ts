export type WaitlistCandidate = {
  id: string;
  name: string;
  phone: string;
  services: string[];
  stylists: string[];
  availableSlotIds: string[];
  joinedAt: string;
};

export type OpenSlot = {
  id: string;
  startsAt: string;
  service: string;
  stylist: string;
};

export type SlotWorkflowInput = {
  slot: OpenSlot;
  candidates: WaitlistCandidate[];
  offerTimeoutMs: number;
  simulateSendFailure: boolean;
};

export type HistoryTone = "neutral" | "success" | "warning" | "danger";
export type SlotHistoryEvent = {
  id: number;
  at: string;
  type: string;
  message: string;
  tone: HistoryTone;
};

export type ActiveOffer = {
  candidate: WaitlistCandidate;
  sentAt: string;
  expiresAt: string;
  deliveryAttempts: number;
};

export type SlotPhase =
  | "matching"
  | "sending"
  | "send-failed"
  | "offered"
  | "booking"
  | "booking-failed"
  | "filled"
  | "exhausted";

export type SlotWorkflowState = {
  workflowId: string;
  slot: OpenSlot;
  phase: SlotPhase;
  offerTimeoutMs: number;
  eligibleCandidates: WaitlistCandidate[];
  currentCandidateIndex: number;
  activeOffer: ActiveOffer | null;
  bookedCandidate: WaitlistCandidate | null;
  error: { code: string; message: string } | null;
  currentClient: WaitlistCandidate | null;
  offerDeadline: string | null;
  lastError: { code: string; message: string } | null;
  terminalState: "filled" | "unfilled" | null;
  handledCommands: Record<string, SlotActionResult>;
  history: SlotHistoryEvent[];
};

export type SlotActionName = "accept" | "decline" | "skip" | "retry";
export type SlotAction = {
  action: SlotActionName;
  commandId: string;
  candidateId?: string;
  actor: "client" | "staff";
};

export type SlotActionResult = {
  outcome:
    | "accepted"
    | "booked"
    | "already-filled"
    | "not-active"
    | "booking-failed"
    | "offer-closed"
    | "invalid-action";
  message: string;
};

export type SendOfferInput = {
  slot: OpenSlot;
  candidate: WaitlistCandidate;
  offerNumber: number;
  deliveryRound: number;
  failUntilManualRetry: boolean;
};

export type SendOfferResult = {
  providerMessageId: string;
  attempt: number;
  channel: "simulated-sms";
};

export type BookSlotInput = {
  slot: OpenSlot;
  candidate: WaitlistCandidate;
  idempotencyKey: string;
};

export type BookSlotResult = {
  bookingId: string;
  alreadyBooked: boolean;
};
