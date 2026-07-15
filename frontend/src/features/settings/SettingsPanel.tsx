import { useState } from "react";

import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime
} from "../../runtime/runtime-bridge.js";
import { runtimeFailureError, toUserFacingMessage } from "../../runtime/user-facing-errors.js";

type DataCounts = Extract<
  Awaited<ReturnType<typeof requestRuntime>>,
  { readonly type: "settings.data.previewed" }
>["payload"]["counts"];

export function SettingsPanel() {
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
      if (event.type === "operation.failed") {
        throw runtimeFailureError(event.payload, "The local data scope could not be read.");
      }
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
      if (event.type === "operation.failed") {
        throw runtimeFailureError(event.payload, "Local app data could not be cleared.");
      }
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

  return (
    <section className="panel" aria-labelledby="settings-title">
      <div>
        <p className="eyebrow">Your device</p>
        <h2 id="settings-title">Privacy & local data</h2>
        <p className="summary">
          Review what ScoutPass stores on this device before permanently removing it.
        </p>
      </div>

      <section className="settings-section danger-zone" aria-labelledby="clear-title">
        <h3 id="clear-title">Delete local app data</h3>
        <p className="muted">
          Your wallet recovery remains protected separately in macOS Keychain.
        </p>
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
              I understand that the reviewed app data will be permanently deleted.
            </label>
            <button
              type="button"
              className="danger-button"
              disabled={busy || !clearConfirmed}
              onClick={() => void clearData()}
            >
              Delete reviewed data
            </button>
          </>
        )}
        {cleared ? <p className="success">Local app data deleted.</p> : null}
      </section>
      {!runtimeAvailable ? (
        <div className="warning">Data controls are available in the desktop app.</div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

const toMessage = (error: unknown): string =>
  toUserFacingMessage(error, "The settings operation failed.");
