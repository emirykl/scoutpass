import type { InvitationStatus, TryoutInvitation } from "../models/invitation.js";

const ALLOWED_TRANSITIONS: Readonly<Record<InvitationStatus, readonly InvitationStatus[]>> = {
  draft: ["sent"],
  sent: ["received", "expired"],
  received: ["accepted", "declined", "clarification_requested", "expired"],
  clarification_requested: ["sent", "expired"],
  accepted: ["travel_support_sent"],
  declined: [],
  expired: [],
  travel_support_sent: []
};

export class InvalidInvitationTransitionError extends Error {
  public constructor(from: InvitationStatus, to: InvitationStatus) {
    super(`Invitation cannot transition from ${from} to ${to}.`);
    this.name = "InvalidInvitationTransitionError";
  }
}

export const transitionInvitation = (
  invitation: TryoutInvitation,
  nextStatus: InvitationStatus,
  now = new Date()
): TryoutInvitation => {
  const nowIso = now.toISOString();
  const hasExpired = Date.parse(invitation.expiresAt) <= now.getTime();

  if (hasExpired && nextStatus !== "expired") {
    throw new InvalidInvitationTransitionError(invitation.status, nextStatus);
  }

  if (!ALLOWED_TRANSITIONS[invitation.status].includes(nextStatus)) {
    throw new InvalidInvitationTransitionError(invitation.status, nextStatus);
  }

  return { ...invitation, status: nextStatus, updatedAt: nowIso };
};
