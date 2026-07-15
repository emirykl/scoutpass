import { useEffect, useState } from "react";

import type { RuntimeEvent } from "@scoutpass/backend/contracts";

import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime,
  subscribeRuntimeEvents
} from "../../runtime/runtime-bridge.js";
import { runtimeFailureError, toUserFacingMessage } from "../../runtime/user-facing-errors.js";

interface ConnectionPanelProps {
  readonly role: "player" | "scout";
  readonly relationshipId: string;
  readonly onStatusChange?: ((status: PeerConnectionStatus) => void) | undefined;
}

type PeerConnectionStatus = Extract<
  RuntimeEvent,
  { readonly type: "connection.status" }
>["payload"]["status"];

export function ConnectionPanel({ role, relationshipId, onStatusChange }: ConnectionPanelProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [, setConnectionStatus] = useState<PeerConnectionStatus>("idle");
  const [error, setError] = useState<string>();
  const runtimeAvailable = isDesktopRuntimeAvailable();

  useEffect(
    () =>
      subscribeRuntimeEvents((event) => {
        if (event.type === "connection.status") {
          setConnectionStatus(event.payload.status);
          onStatusChange?.(event.payload.status);
        }
      }),
    [onStatusChange]
  );

  const createInvite = async () => {
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "connection.invite.create",
        payload: { relationshipId }
      });
      if (event.type !== "connection.invite.created") {
        throw new Error("Desktop runtime returned an unexpected invite response.");
      }
      setInviteCode(event.payload.inviteCode);
      setConnectionStatus("invite_ready");
      onStatusChange?.("invite_ready");
    } catch (caught) {
      setConnectionStatus("error");
      setError(toMessage(caught));
    }
  };

  const connectFromInvite = async () => {
    setError(undefined);
    setConnectionStatus("connecting");
    onStatusChange?.("connecting");
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "connection.connect",
        payload: { inviteCode }
      });
      if (event.type === "operation.failed") {
        throw runtimeFailureError(event.payload, "The scouting connection could not be opened.");
      }
    } catch (caught) {
      setConnectionStatus("error");
      setError(toMessage(caught));
    }
  };

  return (
    <section className="panel compact-panel" aria-labelledby="connection-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Private connection</p>
          <h2 id="connection-title">
            {role === "scout" ? "Invite a player" : "Connect with a scout"}
          </h2>
        </div>
      </div>
      <p className="summary">
        {role === "scout"
          ? "Create one connection code and send it directly to the player."
          : "Paste the connection code you received from the scout."}
      </p>
      <div className="connection-actions">
        {role === "scout" ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void createInvite()}
            disabled={!runtimeAvailable}
          >
            Create connection code
          </button>
        ) : null}
        <label>
          Connection code
          <textarea
            rows={4}
            value={inviteCode}
            placeholder="scoutpass:..."
            onChange={(event) => setInviteCode(event.target.value)}
            readOnly={role === "scout"}
          />
        </label>
        {role === "player" ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => void connectFromInvite()}
            disabled={!runtimeAvailable || inviteCode.trim().length === 0}
          >
            Connect privately
          </button>
        ) : null}
      </div>
      {!runtimeAvailable ? <div className="warning">Available in the desktop app.</div> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

const toMessage = (error: unknown): string =>
  toUserFacingMessage(error, "The local runtime operation failed.");
