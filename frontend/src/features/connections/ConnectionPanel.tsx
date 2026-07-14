import type { RuntimeSnapshot } from "../../runtime/local-runtime.js";

interface ConnectionPanelProps {
  readonly snapshot: RuntimeSnapshot;
}

export function ConnectionPanel({ snapshot }: ConnectionPanelProps) {
  return (
    <section className="panel compact-panel" aria-labelledby="connection-title">
      <p className="eyebrow">Integration status</p>
      <h2 id="connection-title">Pears relationship</h2>
      <div className="status-grid">
        <Status label="QVAC" value={snapshot.qvac} />
        <Status label="Pears" value={snapshot.pears} />
        <Status label="Wallet" value={snapshot.wallet} />
      </div>
      <div className="notice">
        Create invite and peer-transfer controls are implemented in the local runtime adapter path.
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
