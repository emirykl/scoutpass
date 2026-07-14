import { useState } from "react";

import type { RuntimeSnapshot } from "../../runtime/local-runtime.js";

interface ConnectionPanelProps {
  readonly snapshot: RuntimeSnapshot;
}

export function ConnectionPanel({ snapshot }: ConnectionPanelProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<
    | "idle"
    | "invite_ready"
    | "connecting"
    | "connected"
    | "timeout"
    | "peer_not_found"
    | "reconnecting"
    | "error"
  >("idle");
  const [testEventStatus, setTestEventStatus] = useState<"not_sent" | "sent" | "received">(
    "not_sent"
  );

  const createDemoInvite = () => {
    setInviteCode("scoutpass:runtime-generated-invite-pending");
    setConnectionStatus("invite_ready");
  };

  const connectFromInvite = () => {
    setConnectionStatus(inviteCode.trim().startsWith("scoutpass:") ? "connecting" : "error");
  };

  const markPeerNotFound = () => {
    setConnectionStatus("timeout");
    window.setTimeout(() => setConnectionStatus("peer_not_found"), 250);
  };

  return (
    <section className="panel compact-panel" aria-labelledby="connection-title">
      <p className="eyebrow">Integration status</p>
      <h2 id="connection-title">Pears relationship</h2>
      <div className="status-grid">
        <Status label="QVAC" value={snapshot.qvac} />
        <Status label="Pears" value={snapshot.pears} />
        <Status label="Wallet" value={snapshot.wallet} />
        <Status label="Connection" value={connectionStatus} />
        <Status label="Test event" value={testEventStatus} />
      </div>
      <div className="connection-actions">
        <button type="button" className="secondary-button" onClick={createDemoInvite}>
          Create invite
        </button>
        <label>
          Invite code
          <textarea
            rows={4}
            value={inviteCode}
            placeholder="scoutpass:..."
            onChange={(event) => setInviteCode(event.target.value)}
          />
        </label>
        <button type="button" className="primary-button" onClick={connectFromInvite}>
          Connect
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setConnectionStatus("connected");
            setTestEventStatus("sent");
          }}
        >
          Send test event
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setTestEventStatus("received")}
        >
          Mark received
        </button>
        <button type="button" className="secondary-button" onClick={markPeerNotFound}>
          Mark peer not found
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setConnectionStatus("reconnecting")}
        >
          Reconnect
        </button>
      </div>
      <div className="notice">
        Pears invite and test-event commands are defined for the runtime bridge.
      </div>
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
