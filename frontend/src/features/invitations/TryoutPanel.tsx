import { useEffect, useState } from "react";

import {
  scoutPrivateNoteSchema,
  tryoutInvitationSchema,
  type SharedPlayerPackage,
  type TryoutInvitation
} from "@scoutpass/backend/contracts";

import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime,
  subscribeRuntimeEvents
} from "../../runtime/runtime-bridge.js";
import { runtimeFailureError, toUserFacingMessage } from "../../runtime/user-facing-errors.js";

interface TryoutPanelProps {
  readonly role: "player" | "scout";
  readonly relationshipId: string;
  readonly receivedPackage?: SharedPlayerPackage | undefined;
  readonly onInvitationChange?: ((invitation: TryoutInvitation) => void) | undefined;
}

const DEFAULT_FORM = {
  clubName: "Izmir Football Club",
  scoutName: "Demo Scout",
  trialTitle: "First Team Winger Trial",
  startsAt: "2026-07-20T10:00",
  endsAt: "2026-07-20T12:00",
  city: "Izmir",
  venue: "Demo Training Ground",
  positionEvaluated: "Right Winger",
  instructions: "Arrive 30 minutes early with standard training equipment.",
  contactDetails: "scout@example.test",
  expiresAt: "2026-07-19T10:00",
  travelSupportAmount: "25.50"
};

export function TryoutPanel({
  role,
  relationshipId,
  receivedPackage,
  onInvitationChange
}: TryoutPanelProps) {
  const [invitation, setInvitation] = useState<TryoutInvitation>();

  useEffect(
    () =>
      subscribeRuntimeEvents((event) => {
        if (
          event.type === "invitation.updated" &&
          event.payload.invitation.relationshipId === relationshipId
        ) {
          setInvitation(event.payload.invitation);
          onInvitationChange?.(event.payload.invitation);
        }
      }),
    [onInvitationChange, relationshipId]
  );

  return role === "scout" ? (
    <ScoutTryoutComposer
      relationshipId={relationshipId}
      receivedPackage={receivedPackage}
      invitation={invitation}
      onInvitationChange={(next) => {
        setInvitation(next);
        onInvitationChange?.(next);
      }}
    />
  ) : (
    <PlayerInvitation
      relationshipId={relationshipId}
      invitation={invitation}
      onInvitationChange={(next) => {
        setInvitation(next);
        onInvitationChange?.(next);
      }}
    />
  );
}

function ScoutTryoutComposer({
  relationshipId,
  receivedPackage,
  invitation,
  onInvitationChange
}: {
  readonly relationshipId: string;
  readonly receivedPackage?: SharedPlayerPackage | undefined;
  readonly invitation?: TryoutInvitation | undefined;
  readonly onInvitationChange: (invitation: TryoutInvitation) => void;
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [preview, setPreview] = useState<TryoutInvitation>();
  const [privateNote, setPrivateNote] = useState(
    () => localStorage.getItem(`scoutpass.scoutNote.${relationshipId}`) ?? ""
  );
  const [noteSaved, setNoteSaved] = useState(false);
  const [error, setError] = useState<string>();
  const runtimeAvailable = isDesktopRuntimeAvailable();

  const update = (key: keyof typeof DEFAULT_FORM, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setPreview(undefined);
  };

  const prepare = () => {
    setError(undefined);
    try {
      const now = new Date();
      const candidate = tryoutInvitationSchema.parse({
        id: `invitation_${globalThis.crypto.randomUUID()}`,
        relationshipId,
        clubName: form.clubName,
        scoutName: form.scoutName,
        trialTitle: form.trialTitle,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        city: form.city,
        venue: form.venue,
        positionEvaluated: form.positionEvaluated,
        instructions: form.instructions,
        contactDetails: form.contactDetails,
        ...(form.travelSupportAmount.trim() === ""
          ? {}
          : { travelSupportAmount: form.travelSupportAmount, paymentAsset: "USD₮" as const }),
        expiresAt: new Date(form.expiresAt).toISOString(),
        status: "draft",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
      setPreview(candidate);
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  const savePrivateNote = () => {
    setError(undefined);
    try {
      const now = new Date().toISOString();
      scoutPrivateNoteSchema.parse({
        id: `scout_note_${relationshipId}`,
        relationshipId,
        packageId: receivedPackage?.packageId ?? "package_pending_share",
        note: privateNote,
        createdAt: now,
        updatedAt: now
      });
      localStorage.setItem(`scoutpass.scoutNote.${relationshipId}`, privateNote);
      setNoteSaved(true);
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  const send = async () => {
    if (preview === undefined) return;
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "invitation.send",
        payload: preview
      });
      if (event.type === "operation.failed") {
        throw runtimeFailureError(event.payload, "The invitation could not be sent.");
      }
      if (event.type !== "invitation.updated") {
        throw new Error("Desktop runtime did not confirm the invitation.");
      }
      onInvitationChange(event.payload.invitation);
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  return (
    <section className="panel" aria-labelledby="tryout-composer-title">
      <p className="eyebrow">Tryout invitation</p>
      <h2 id="tryout-composer-title">Prepare a player trial</h2>
      <label className="wide private-note">
        Private scout assessment
        <textarea
          rows={3}
          value={privateNote}
          onChange={(event) => {
            setPrivateNote(event.target.value);
            setNoteSaved(false);
          }}
        />
        <small>Saved only on this device and never shown to the player.</small>
      </label>
      <button type="button" className="secondary-button" onClick={savePrivateNote}>
        Save private note
      </button>
      {noteSaved ? <p className="success">Private note saved on this device.</p> : null}

      <div className="form-grid invitation-form">
        {Object.entries(FIELD_LABELS).map(([key, label]) => (
          <label key={key} className={WIDE_FIELDS.has(key) ? "wide" : undefined}>
            {label}
            {WIDE_FIELDS.has(key) ? (
              <textarea
                rows={3}
                value={form[key as keyof typeof form]}
                onChange={(event) => update(key as keyof typeof form, event.target.value)}
              />
            ) : (
              <input
                type={DATE_FIELDS.has(key) ? "datetime-local" : "text"}
                value={form[key as keyof typeof form]}
                onChange={(event) => update(key as keyof typeof form, event.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      <button type="button" className="secondary-button" onClick={prepare}>
        Preview invitation
      </button>

      {preview ? (
        <div className="invitation-preview">
          <h3>{preview.trialTitle}</h3>
          <p>
            {preview.clubName} · {preview.positionEvaluated}
          </p>
          <p>
            {formatDate(preview.startsAt)} · {preview.venue}, {preview.city}
          </p>
          <p>{preview.instructions}</p>
          <p>
            Travel support: {preview.travelSupportAmount ?? "Not offered"}{" "}
            {preview.paymentAsset ?? ""}
          </p>
          <button
            type="button"
            className="primary-button"
            disabled={!runtimeAvailable}
            onClick={() => void send()}
          >
            Send invitation
          </button>
        </div>
      ) : null}
      {invitation ? <p className="status-line">Status: {invitation.status}</p> : null}
      {!runtimeAvailable ? <div className="warning">Open the desktop app to send.</div> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function PlayerInvitation({
  relationshipId,
  invitation,
  onInvitationChange
}: {
  readonly relationshipId: string;
  readonly invitation?: TryoutInvitation | undefined;
  readonly onInvitationChange: (invitation: TryoutInvitation) => void;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();
  const runtimeAvailable = isDesktopRuntimeAvailable();

  const respond = async (response: "accepted" | "declined" | "clarification_requested") => {
    if (invitation === undefined) return;
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "invitation.respond",
        payload: {
          invitationId: invitation.id,
          response,
          ...(message.trim() === "" ? {} : { message })
        }
      });
      if (event.type === "operation.failed") {
        throw runtimeFailureError(event.payload, "The invitation response could not be sent.");
      }
      if (event.type !== "invitation.updated") {
        throw new Error("Desktop runtime did not confirm the invitation response.");
      }
      onInvitationChange(event.payload.invitation);
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  return (
    <section className="panel" aria-labelledby="player-invitation-title">
      <p className="eyebrow">Tryout invitation</p>
      <h2 id="player-invitation-title">Your trial opportunity</h2>
      {invitation === undefined || invitation.relationshipId !== relationshipId ? (
        <p className="summary">No tryout invitation has been received.</p>
      ) : (
        <div className="invitation-preview">
          <span className="status-pill">{invitation.status}</span>
          <h3>{invitation.trialTitle}</h3>
          <p>
            {invitation.clubName} · {invitation.positionEvaluated}
          </p>
          <p>
            {formatDate(invitation.startsAt)} · {invitation.venue}, {invitation.city}
          </p>
          <p>{invitation.instructions}</p>
          <p>Contact: {invitation.contactDetails}</p>
          <p>
            Travel support: {invitation.travelSupportAmount ?? "Not offered"}{" "}
            {invitation.paymentAsset ?? ""}
          </p>
          {invitation.status === "received" ? (
            <>
              <label>
                Response message
                <textarea
                  rows={2}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <div className="response-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!runtimeAvailable}
                  onClick={() => void respond("accepted")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!runtimeAvailable}
                  onClick={() => void respond("declined")}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!runtimeAvailable}
                  onClick={() => void respond("clarification_requested")}
                >
                  Request clarification
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

const FIELD_LABELS = {
  clubName: "Club name",
  scoutName: "Scout name",
  trialTitle: "Trial title",
  startsAt: "Starts at",
  endsAt: "Ends at",
  city: "City",
  venue: "Venue",
  positionEvaluated: "Position evaluated",
  instructions: "Instructions",
  contactDetails: "Contact details",
  expiresAt: "Response deadline",
  travelSupportAmount: "Travel support (USD₮, optional)"
} as const;
const DATE_FIELDS = new Set(["startsAt", "endsAt", "expiresAt"]);
const WIDE_FIELDS = new Set(["instructions", "contactDetails"]);
const formatDate = (value: string): string => new Date(value).toLocaleString();
const toMessage = (error: unknown): string =>
  toUserFacingMessage(error, "The invitation operation failed.");
