import { PROTOCOL_VERSION } from "../../domain/constants.js";
import { createId } from "../../domain/identity.js";
import type {
  InvitationResponseEvent,
  ScoutPassEvent,
  TryoutInvitationEvent
} from "../../domain/models/events.js";
import type { InvitationStatus, TryoutInvitation } from "../../domain/models/invitation.js";
import { tryoutInvitationSchema } from "../../domain/models/invitation.js";
import { transitionInvitation } from "../../domain/services/invitation-state-machine.js";
import type { ScoutingConnectionService } from "../connections/scouting-connection-service.js";
import type { InvitationRepository } from "../ports/repositories.js";

type InvitationResponse = InvitationResponseEvent["payload"]["response"];

export interface TryoutInvitationServiceOptions {
  readonly connectionService: ScoutingConnectionService;
  readonly invitations: InvitationRepository;
  readonly senderPublicKey: string;
  readonly now?: () => Date;
}

export class TryoutInvitationService {
  readonly #connectionService: ScoutingConnectionService;
  readonly #invitations: InvitationRepository;
  readonly #senderPublicKey: string;
  readonly #now: () => Date;
  readonly #listeners = new Set<(invitation: TryoutInvitation) => void>();
  readonly #unsubscribe: () => void;

  public constructor(options: TryoutInvitationServiceOptions) {
    this.#connectionService = options.connectionService;
    this.#invitations = options.invitations;
    this.#senderPublicKey = options.senderPublicKey;
    this.#now = options.now ?? (() => new Date());
    this.#unsubscribe = this.#connectionService.onIncomingEvent(async (event, relationshipId) => {
      await this.#handleIncomingEvent(event, relationshipId);
    });
  }

  public async saveDraft(invitation: TryoutInvitation): Promise<TryoutInvitation> {
    const draft = tryoutInvitationSchema.parse(invitation);
    if (draft.status !== "draft") {
      throw new Error("Only draft invitations can be saved as drafts.");
    }
    await this.#invitations.save(draft);
    return draft;
  }

  public async sendDraft(invitation: TryoutInvitation): Promise<TryoutInvitationEvent> {
    const draft = tryoutInvitationSchema.parse(invitation);
    const sent = transitionInvitation(draft, "sent", this.#now());
    const event: TryoutInvitationEvent = {
      id: createId("event_tryout"),
      type: "tryout.invitation",
      senderPublicKey: this.#senderPublicKey,
      createdAt: this.#now().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      payload: { invitation: sent }
    };

    await this.#connectionService.sendEvent(sent.relationshipId, event);
    await this.#invitations.save(sent);
    this.#emit(sent);
    return event;
  }

  public async respond(
    invitationId: string,
    response: InvitationResponse,
    message?: string
  ): Promise<InvitationResponseEvent> {
    const invitation = await this.#requireInvitation(invitationId);
    const nextStatus = responseToStatus(response);
    const updated = transitionInvitation(invitation, nextStatus, this.#now());
    const event: InvitationResponseEvent = {
      id: createId("event_invitation_response"),
      type: "invitation.response",
      senderPublicKey: this.#senderPublicKey,
      createdAt: this.#now().toISOString(),
      protocolVersion: PROTOCOL_VERSION,
      payload: {
        invitationId,
        response,
        ...(message === undefined ? {} : { message })
      }
    };

    await this.#connectionService.sendEvent(invitation.relationshipId, event);
    await this.#invitations.save(updated);
    this.#emit(updated);
    return event;
  }

  public async expire(invitationId: string): Promise<TryoutInvitation> {
    const invitation = await this.#requireInvitation(invitationId);
    const expired = transitionInvitation(invitation, "expired", this.#now());
    await this.#invitations.save(expired);
    this.#emit(expired);
    return expired;
  }

  public canStartTravelSupport(invitation: TryoutInvitation): boolean {
    return (
      invitation.status === "accepted" && Date.parse(invitation.expiresAt) > this.#now().getTime()
    );
  }

  public async markTravelSupportSent(invitationId: string): Promise<TryoutInvitation> {
    const invitation = await this.#requireInvitation(invitationId);
    const updated = transitionInvitation(invitation, "travel_support_sent", this.#now());
    await this.#invitations.save(updated);
    this.#emit(updated);
    return updated;
  }

  public onInvitationChanged(listener: (invitation: TryoutInvitation) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  public dispose(): void {
    this.#unsubscribe();
    this.#listeners.clear();
  }

  async #handleIncomingEvent(event: ScoutPassEvent, relationshipId: string): Promise<void> {
    if (event.type === "tryout.invitation") {
      const sent = tryoutInvitationSchema.parse(event.payload.invitation);
      if (sent.relationshipId !== relationshipId || sent.status !== "sent") {
        throw new Error("Received invitation does not match the active scouting relationship.");
      }
      const nextStatus: InvitationStatus =
        Date.parse(sent.expiresAt) <= this.#now().getTime() ? "expired" : "received";
      const received = transitionInvitation(sent, nextStatus, this.#now());
      await this.#invitations.save(received);
      this.#emit(received);
      return;
    }

    if (event.type === "invitation.response") {
      const invitation = await this.#requireInvitation(event.payload.invitationId);
      if (invitation.relationshipId !== relationshipId) {
        throw new Error("Invitation response does not match the active scouting relationship.");
      }
      const received =
        invitation.status === "sent"
          ? transitionInvitation(invitation, "received", this.#now())
          : invitation;
      const updated = transitionInvitation(
        received,
        responseToStatus(event.payload.response),
        this.#now()
      );
      await this.#invitations.save(updated);
      this.#emit(updated);
    }
  }

  async #requireInvitation(invitationId: string): Promise<TryoutInvitation> {
    const invitation = await this.#invitations.get(invitationId);
    if (invitation === undefined) {
      throw new Error("Tryout invitation was not found in local storage.");
    }
    return invitation;
  }

  #emit(invitation: TryoutInvitation): void {
    for (const listener of this.#listeners) {
      listener(structuredClone(invitation));
    }
  }
}

const responseToStatus = (response: InvitationResponse): InvitationStatus => {
  switch (response) {
    case "accepted":
      return "accepted";
    case "declined":
      return "declined";
    case "clarification_requested":
      return "clarification_requested";
  }
};
