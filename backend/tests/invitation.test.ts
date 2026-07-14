import { describe, expect, it } from "vitest";

import { tryoutInvitationSchema } from "../src/domain/models/invitation.js";
import {
  InvalidInvitationTransitionError,
  transitionInvitation
} from "../src/domain/services/invitation-state-machine.js";
import { createInvitation, NOW } from "./fixtures.js";

describe("tryout invitation", () => {
  it("validates chronological invitation details", () => {
    expect(tryoutInvitationSchema.safeParse(createInvitation()).success).toBe(true);
    expect(
      tryoutInvitationSchema.safeParse(createInvitation({ endsAt: "2026-07-20T06:00:00.000Z" }))
        .success
    ).toBe(false);
  });

  it("moves only through allowed states", () => {
    const sent = transitionInvitation(createInvitation(), "sent", NOW);
    const received = transitionInvitation(sent, "received", NOW);
    const accepted = transitionInvitation(received, "accepted", NOW);
    const paid = transitionInvitation(accepted, "travel_support_sent", NOW);
    expect(paid.status).toBe("travel_support_sent");
  });

  it("rejects invalid state transitions", () => {
    expect(() => transitionInvitation(createInvitation(), "accepted", NOW)).toThrow(
      InvalidInvitationTransitionError
    );
  });

  it("rejects acceptance after expiration", () => {
    const received = createInvitation({ status: "received" });
    expect(() =>
      transitionInvitation(received, "accepted", new Date("2026-07-19T08:00:00Z"))
    ).toThrow(InvalidInvitationTransitionError);
  });
});
