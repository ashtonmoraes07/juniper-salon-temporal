import type { OpenSlot, WaitlistCandidate } from "./types";

export function selectEligibleCandidates(
  slot: OpenSlot,
  candidates: WaitlistCandidate[],
): WaitlistCandidate[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.services.includes(slot.service) &&
        (candidate.stylists.includes(slot.stylist) ||
          candidate.stylists.includes("Any stylist")) &&
        candidate.availableSlotIds.includes(slot.id),
    )
    .sort((left, right) => {
      const joinedDifference =
        new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();
      if (joinedDifference) return joinedDifference;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
}

export function slotWorkflowId(slotId: string): string {
  return `open-slot/${slotId}`;
}
