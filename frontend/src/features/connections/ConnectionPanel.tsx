import { useEffect, useState } from "react";

import type { RuntimeEvent } from "@scoutpass/backend/contracts";

import type { RuntimeSnapshot } from "../../runtime/local-runtime.js";
import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime,
  subscribeRuntimeEvents
} from "../../runtime/runtime-bridge.js";

interface ConnectionPanelProps {
  readonly snapshot: RuntimeSnapshot;
  readonly role: "player" | "scout";
  readonly relationshipId: string;
}

type PeerConnectionStatus = Extract<
  RuntimeEvent,
  { readonly type: "connection.status" }
>["payload"]["status"];

export function ConnectionPanel({ snapshot, role, relationshipId }: ConnectionPanelProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<PeerConnectionStatus>("idle");
  const [testEventStatus, setTestEventStatus] = useState<"not_sent" | "sent">("not_sent");
  const [error, setError] = useState<string>();
  const runtimeAvailable = isDesktopRuntimeAvailable();

  useEffect(
    () =>
      subscribeRuntimeEvents((event) => {
        if (event.type === "connection.status") {
          setConnectionStatus(event.payload.status);
        }
      }),
    []
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
    } catch (caught) {
      setConnectionStatus("error");
      setError(toMessage(caught));
    }
  };

  const connectFromInvite = async () => {
    setError(undefined);
    setConnectionStatus("connecting");
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "connection.connect",
        payload: { inviteCode }
      });
      if (event.type === "operation.failed") {
        throw new Error(event.payload.message);
      }
    } catch (caught) {
      setConnectionStatus("error");
      setError(toMessage(caught));
    }
  };

  const sendTestEvent = async () => {
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "connection.test_event.send",
        payload: { relationshipId }
      });
      if (event.type === "operation.failed") {
        throw new Error(event.payload.message);
      }
      setTestEventStatus("sent");
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  return (
    <section className="panel compact-panel" aria-labelledby="connection-title">
      <p className="eyebrow">Pears network</p>
      <h2 id="connection-title">Scouting connection</h2>
      <div className="status-grid">
        <Status label="QVAC" value={snapshot.qvac} />
        <Status label="Pears" value={runtimeAvailable ? snapshot.pears : "desktop_required"} />
        <Status label="Wallet" value={snapshot.wallet} />
        <Status label="Connection" value={connectionStatus} />
        <Status label="Test event" value={testEventStatus} />
      </div>
      <div className="connection-actions">
        {role === "scout" ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void createInvite()}
            disabled={!runtimeAvailable}
          >
            Create invite
          </button>
        ) : null}
        <label>
          Invite code
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
            Connect
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={() => void sendTestEvent()}
          disabled={!runtimeAvailable || connectionStatus !== "connected"}
        >
          Send test event
        </button>
      </div>
      {!runtimeAvailable ? (
        <div className="warning">Desktop runtime required for real Pears networking.</div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function Status({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="status-card">
      <span>{label}</span>
      <strong>{value.replaceAll("_", " ")}</strong>
    </div>
  );
}

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The local runtime operation failed.";
