const elements = {
  start: document.querySelector("#start-workflow"),
  failure: document.querySelector("#failure-toggle"),
  notice: document.querySelector("#notice"),
  phase: document.querySelector("#phase-metric"),
  eligible: document.querySelector("#eligible-metric"),
  current: document.querySelector("#current-metric"),
  countdown: document.querySelector("#countdown-metric"),
  title: document.querySelector("#slot-title"),
  time: document.querySelector("#slot-time"),
  status: document.querySelector("#status-pill"),
  errorCard: document.querySelector("#error-card"),
  errorTitle: document.querySelector("#error-title"),
  errorMessage: document.querySelector("#error-message"),
  errorRetry: document.querySelector("#error-retry"),
  errorSkip: document.querySelector("#error-skip"),
  candidates: document.querySelector("#candidate-list"),
  timeline: document.querySelector("#timeline"),
  clientName: document.querySelector("#client-name"),
  clientCopy: document.querySelector("#client-copy"),
  clientService: document.querySelector("#client-service"),
  clientTime: document.querySelector("#client-time"),
  clientStylist: document.querySelector("#client-stylist"),
  clientActions: document.querySelector("#client-actions"),
  clientResult: document.querySelector("#client-result"),
  lateAccept: document.querySelector("#late-accept"),
};

let fixture;
let state;
let pollTimer;
let countdownTimer;

function formatSlotTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function showNotice(message, danger = false) {
  elements.notice.hidden = false;
  elements.notice.textContent = message;
  elements.notice.style.background = danger ? "#fff0ed" : "#fff3d8";
  elements.notice.style.color = danger ? "#7d3131" : "#704d18";
}

function eligibleCandidateIds() {
  return new Set((state?.eligibleCandidates ?? []).map(({ id }) => id));
}

function renderFixture() {
  const { slot, candidates } = fixture;
  elements.title.textContent = `${slot.service} with ${slot.stylist}`;
  elements.time.textContent = `${formatSlotTime(slot.startsAt)} · cancellation opening`;
  elements.clientService.textContent = slot.service;
  elements.clientTime.textContent = formatSlotTime(slot.startsAt);
  elements.clientStylist.textContent = `with ${slot.stylist}`;

  const eligibleIds = eligibleCandidateIds();
  const ordered = state
    ? [...state.eligibleCandidates, ...candidates.filter(({ id }) => !eligibleIds.has(id))]
    : candidates;
  elements.candidates.innerHTML = ordered
    .map((candidate, index) => {
      const serviceMatch = candidate.services.includes(slot.service);
      const stylistMatch =
        candidate.stylists.includes(slot.stylist) ||
        candidate.stylists.includes("Any stylist");
      const availabilityMatch = candidate.availableSlotIds.includes(slot.id);
      const eligible = eligibleIds.has(candidate.id);
      const current =
        state?.activeOffer?.candidate.id === candidate.id ||
        (state?.phase === "send-failed" &&
          state.eligibleCandidates[state.currentCandidateIndex]?.id === candidate.id);
      const booked = state?.bookedCandidate?.id === candidate.id;
      const label = booked ? "Booked" : current ? "Active" : eligible ? "Eligible" : "Filtered out";
      return `<div class="candidate ${eligible ? "eligible" : ""} ${current ? "current" : ""}">
        <span class="rank">${eligible ? index + 1 : "—"}</span>
        <div class="candidate-main">
          <strong>${candidate.name}</strong>
          <span>${candidate.phone} · joined ${new Date(candidate.joinedAt).toLocaleDateString()}</span>
          <span class="match-factors" aria-label="Eligibility factors">
            <em class="${serviceMatch ? "match" : "no-match"}">${serviceMatch ? "✓" : "×"} service</em>
            <em class="${stylistMatch ? "match" : "no-match"}">${stylistMatch ? "✓" : "×"} stylist</em>
            <em class="${availabilityMatch ? "match" : "no-match"}">${availabilityMatch ? "✓" : "×"} available</em>
          </span>
        </div>
        <span class="candidate-state">${label}</span>
      </div>`;
    })
    .join("");
}

function stageIndex(phase) {
  if (["matching"].includes(phase)) return 0;
  if (["sending", "send-failed"].includes(phase)) return 1;
  if (["offered"].includes(phase)) return 2;
  return 3;
}

function renderRail() {
  const active = state ? stageIndex(state.phase) : 0;
  document.querySelectorAll(".rail-step").forEach((step, index) => {
    step.classList.toggle("active", index === active);
    step.classList.toggle("done", index < active);
  });
}

function renderTimeline() {
  if (!state?.history.length) return;
  elements.timeline.innerHTML = [...state.history]
    .reverse()
    .map(
      (event) => `<li class="${event.tone}">
        <div class="event-top"><strong>${event.type.replaceAll("-", " ")}</strong><time>${new Date(event.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</time></div>
        <p>${event.message}</p>
      </li>`,
    )
    .join("");
}

function updateCountdown() {
  if (!state?.activeOffer || state.phase !== "offered") {
    elements.countdown.textContent = state?.phase === "filled" ? "Complete" : "—";
    return;
  }
  const remaining = Math.max(0, new Date(state.activeOffer.expiresAt).getTime() - Date.now());
  elements.countdown.textContent = `${Math.ceil(remaining / 1000)} sec`;
}

function renderClientView() {
  const candidate = state?.activeOffer?.candidate;
  elements.clientActions.hidden = state?.phase !== "offered";
  elements.lateAccept.hidden = state?.phase !== "filled";
  if (state?.phase === "filled") {
    elements.clientName.textContent = `Booked for ${state.bookedCandidate.name}`;
    elements.clientCopy.textContent = "The opening is filled. A later response cannot replace the confirmed client.";
    return;
  }
  if (state?.phase === "booking-failed") {
    elements.clientName.textContent = `${state.currentClient.name}'s acceptance is preserved`;
    elements.clientCopy.textContent = "The simulated booking failed after retries. Staff can retry it with the same idempotency key; no other client is contacted.";
    return;
  }
  if (candidate) {
    elements.clientName.textContent = `Hi ${candidate.name.split(" ")[0]}, this could be yours.`;
    elements.clientCopy.textContent = `A ${state.slot.service.toLowerCase()} opening just became available. Respond before the durable timer closes the offer.`;
    return;
  }
  const queued = state?.eligibleCandidates[state.currentCandidateIndex];
  elements.clientName.textContent = queued ? `Preparing ${queued.name}'s offer` : "Waiting for an offer";
  elements.clientCopy.textContent = state ? "Juniper is coordinating the next durable step." : "Start the workflow to preview the client response experience.";
}

function renderState() {
  elements.phase.textContent = state.phase.replace("-", " ");
  elements.eligible.textContent = String(state.eligibleCandidates.length);
  elements.current.textContent = state.activeOffer?.candidate.name ?? state.bookedCandidate?.name ?? state.currentClient?.name ?? "None";
  elements.status.textContent = state.phase.replace("-", " ");
  elements.status.className = `status-pill ${["send-failed", "booking-failed"].includes(state.phase) ? "danger" : state.phase === "filled" ? "success" : ""}`;
  elements.errorCard.hidden = !["send-failed", "booking-failed"].includes(state.phase);
  const bookingFailed = state.phase === "booking-failed";
  elements.errorTitle.textContent = bookingFailed ? "Simulated booking failure" : "Simulated delivery failure";
  elements.errorRetry.textContent = bookingFailed ? "Retry booking" : "Retry delivery";
  elements.errorRetry.dataset.action = bookingFailed ? "accept" : "retry";
  elements.errorRetry.dataset.actor = bookingFailed ? "client" : "staff";
  elements.errorSkip.hidden = bookingFailed;
  elements.errorMessage.textContent = state.error?.message ?? "";
  elements.start.textContent = "Workflow running";
  elements.start.disabled = true;
  elements.failure.disabled = true;
  renderFixture();
  renderRail();
  renderTimeline();
  renderClientView();
  updateCountdown();
}

async function refresh() {
  if (!fixture) return;
  const response = await fetch(`/api/slots/${fixture.slot.id}`);
  if (!response.ok) return;
  state = await response.json();
  renderState();
  if (["filled", "exhausted"].includes(state.phase)) clearInterval(pollTimer);
}

async function takeAction(action, actor, candidateId) {
  document.querySelectorAll("button").forEach((button) => (button.disabled = true));
  try {
    const response = await fetch(`/api/slots/${fixture.slot.id}/actions/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor,
        candidateId: candidateId ?? state?.activeOffer?.candidate.id,
        commandId: crypto.randomUUID(),
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Action failed");
    elements.clientResult.textContent = body.result.message;
    if (body.result.outcome === "already-filled") showNotice(body.result.message);
    await refresh();
  } catch (error) {
    showNotice(error.message, true);
  } finally {
    document.querySelectorAll("button").forEach((button) => (button.disabled = false));
    if (state) elements.start.disabled = true;
  }
}

elements.start.addEventListener("click", async () => {
  elements.start.disabled = true;
  elements.start.textContent = "Starting durable workflow…";
  try {
    const response = await fetch(`/api/slots/${fixture.slot.id}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        demo: true,
        simulateSendFailure: elements.failure.checked,
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Could not start workflow");
    if (body.reused) showNotice("The stable slot ID already exists, so the existing workflow was reused.");
    pollTimer = setInterval(() => refresh().catch(console.error), 500);
    countdownTimer = setInterval(updateCountdown, 250);
    await refresh();
  } catch (error) {
    elements.start.disabled = false;
    elements.start.textContent = "Start 10-second demo";
    showNotice(error.message, true);
  }
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  takeAction(button.dataset.action, button.dataset.actor);
});

elements.lateAccept.addEventListener("click", () => {
  const lateCandidate = state.eligibleCandidates.find(({ id }) => id !== state.bookedCandidate?.id);
  takeAction("accept", "client", lateCandidate?.id ?? state.bookedCandidate?.id);
});

async function initialize() {
  const response = await fetch("/api/fixture");
  fixture = await response.json();
  renderFixture();
  elements.title.textContent = `${fixture.slot.service} with ${fixture.slot.stylist}`;
  elements.time.textContent = `${formatSlotTime(fixture.slot.startsAt)} · cancellation opening`;
  elements.clientService.textContent = fixture.slot.service;
  elements.clientTime.textContent = formatSlotTime(fixture.slot.startsAt);
  elements.clientStylist.textContent = `with ${fixture.slot.stylist}`;
}

initialize().catch((error) => showNotice(error.message, true));
