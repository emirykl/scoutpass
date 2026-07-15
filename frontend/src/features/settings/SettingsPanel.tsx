import { useState } from "react";

import type { RuntimeSnapshot } from "../../runtime/local-runtime.js";
import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime
} from "../../runtime/runtime-bridge.js";

interface SettingsPanelProps {
  readonly snapshot: RuntimeSnapshot;
  readonly connectionStatus: string;
}

type DataCounts = Extract<
  Awaited<ReturnType<typeof requestRuntime>>,
  { readonly type: "settings.data.previewed" }
>["payload"]["counts"];

export function SettingsPanel({ snapshot, connectionStatus }: SettingsPanelProps) {
  const [counts, setCounts] = useState<DataCounts>();
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const runtimeAvailable = isDesktopRuntimeAvailable();

  const previewClear = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "settings.data.preview"
      });
      if (event.type === "operation.failed") throw new Error(event.payload.message);
      if (event.type !== "settings.data.previewed") throw new Error("Data scope is unavailable.");
      setCounts(event.payload.counts);
      setCleared(false);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const clearData = async () => {
    if (!clearConfirmed) return;
    setBusy(true);
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "settings.data.clear",
        payload: { userConfirmed: true }
      });
      if (event.type === "operation.failed") throw new Error(event.payload.message);
      if (event.type !== "settings.data.previewed" || !event.payload.cleared) {
        throw new Error("Local data was not cleared.");
      }
      setCleared(true);
      setCounts(undefined);
      setClearConfirmed(false);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const exportDebug = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const event = await requestRuntime({
        ...createRuntimeRequest(),
        type: "settings.debug.export"
      });
      if (event.type === "operation.failed") throw new Error(event.payload.message);
      if (event.type !== "settings.debug.exported") throw new Error("Debug export is unavailable.");
      downloadDebugExport(event.payload.content);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="settings-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local runtime</p>
          <h2 id="settings-title">Settings</h2>
        </div>
        <span className="testnet-badge">Ethereum Sepolia · Testnet only</span>
      </div>
      <div className="settings-status-grid">
        <Status label="QVAC model" value={snapshot.qvac} />
        <Status label="Pears" value={connectionStatus} />
        <Status label="Wallet network" value="Ethereum Sepolia" />
        <Status label="Desktop runtime" value={runtimeAvailable ? "ready" : "unavailable"} />
      </div>

      <section className="settings-section" aria-labelledby="debug-title">
        <h3 id="debug-title">Sanitized debug export</h3>
        <p className="muted">
          Excludes profile payloads, private notes, connection keys, topics and recovery material.
        </p>
        <button
          type="button"
          className="secondary-button"
          disabled={!runtimeAvailable || busy}
          onClick={() => void exportDebug()}
        >
          Download debug export
        </button>
      </section>

      <section className="settings-section danger-zone" aria-labelledby="clear-title">
        <h3 id="clear-title">Clear local app data</h3>
        {counts === undefined ? (
          <button
            type="button"
            className="secondary-button"
            disabled={!runtimeAvailable || busy}
            onClick={() => void previewClear()}
          >
            Review data scope
          </button>
        ) : (
          <>
            <dl className="data-scope">
              {Object.entries(counts).map(([label, value]) => (
                <div key={label}>
                  <dt>{label.replaceAll(/([A-Z])/g, " $1").toLowerCase()}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <label className="approval-row">
              <input
                type="checkbox"
                checked={clearConfirmed}
                onChange={(event) => setClearConfirmed(event.target.checked)}
              />
              Clear the reviewed app data. Wallet recovery material remains in macOS Keychain.
            </label>
            <button
              type="button"
              className="danger-button"
              disabled={busy || !clearConfirmed}
              onClick={() => void clearData()}
            >
              Clear reviewed data
            </button>
          </>
        )}
        {cleared ? <p className="success">Local app data cleared.</p> : null}
      </section>
      {!runtimeAvailable ? <div className="warning">Desktop runtime required.</div> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function Status({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value.replaceAll("_", " ")}</strong>
    </div>
  );
}

const downloadDebugExport = (content: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `scoutpass-debug-${new Date().toISOString().replaceAll(":", "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The settings operation failed.";
