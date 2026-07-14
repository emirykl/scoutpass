import { useState } from "react";

import type {
  PlayerProfile,
  ScoutReport,
  SharedPlayerPackage,
  ShareSelection
} from "@scoutpass/backend/contracts";
import {
  DEFAULT_SHARE_SELECTION,
  MAX_SHARED_PACKAGE_BYTES,
  preparePlayerShare,
  type PreparedPlayerShare
} from "@scoutpass/backend/sharing";

interface SharingPanelProps {
  readonly player: PlayerProfile;
  readonly report: ScoutReport;
  readonly onSend: (prepared: PreparedPlayerShare) => Promise<void>;
}

const PLAYER_PUBLIC_KEY = "a".repeat(64);

const SHARE_OPTIONS: ReadonlyArray<{
  key: keyof ShareSelection;
  label: string;
  sensitive: boolean;
}> = [
  { key: "basicFootballProfile", label: "Basic football profile", sensitive: false },
  { key: "playerSummary", label: "Player summary", sensitive: false },
  { key: "strengths", label: "Strengths", sensitive: false },
  { key: "contactInformation", label: "Contact information", sensitive: true },
  { key: "statistics", label: "Performance statistics", sensitive: true },
  { key: "developmentAreas", label: "Development areas", sensitive: true },
  { key: "playingStyle", label: "Playing style", sensitive: true },
  { key: "coachNotes", label: "Coach notes", sensitive: true },
  { key: "scoutQuestions", label: "Scout questions", sensitive: true }
];

export function SharingPanel({ player, report, onSend }: SharingPanelProps) {
  const [selection, setSelection] = useState<ShareSelection>({ ...DEFAULT_SHARE_SELECTION });
  const [preparedState, setPreparedState] = useState<{
    readonly sourceFingerprint: string;
    readonly share: PreparedPlayerShare;
  }>();
  const [approved, setApproved] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>();
  const sourceFingerprint = JSON.stringify({ player, report });
  const prepared =
    preparedState?.sourceFingerprint === sourceFingerprint ? preparedState.share : undefined;

  const updateSelection = (key: keyof ShareSelection, checked: boolean) => {
    setSelection((current) => ({ ...current, [key]: checked }));
    setPreparedState(undefined);
    setApproved(false);
    setStatus("idle");
  };

  const preparePreview = () => {
    setError(undefined);
    try {
      setPreparedState({
        sourceFingerprint,
        share: preparePlayerShare({
          player,
          report,
          selection,
          playerPublicKey: PLAYER_PUBLIC_KEY
        })
      });
      setApproved(false);
      setStatus("idle");
    } catch (caught) {
      setError(toMessage(caught));
    }
  };

  const send = async () => {
    if (prepared === undefined || !approved) {
      return;
    }
    setStatus("sending");
    setError(undefined);
    try {
      await onSend(prepared);
      setStatus("sent");
    } catch (caught) {
      setStatus("error");
      setError(toMessage(caught));
    }
  };

  return (
    <section className="panel" aria-labelledby="sharing-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Selective sharing</p>
          <h2 id="sharing-title">Player-controlled package</h2>
        </div>
        <button type="button" className="secondary-button" onClick={preparePreview}>
          Prepare preview
        </button>
      </div>

      <div className="share-options">
        {SHARE_OPTIONS.map((option) => (
          <label key={option.key} className="check-row">
            <input
              type="checkbox"
              checked={selection[option.key]}
              onChange={(event) => updateSelection(option.key, event.target.checked)}
            />
            <span>{option.label}</span>
            {option.sensitive ? <small>Sensitive</small> : <small>Default</small>}
          </label>
        ))}
      </div>

      {prepared ? (
        <div className="share-preview">
          <div className="size-line">
            <strong>{formatBytes(prepared.payloadBytes)}</strong>
            <span>Limit {formatBytes(MAX_SHARED_PACKAGE_BYTES)}</span>
          </div>
          <pre data-testid="share-json-preview">{JSON.stringify(prepared.package, null, 2)}</pre>
          <label className="approval-row">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            I approve sharing exactly the package shown above with this scout.
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={!approved || status === "sending"}
            onClick={() => void send()}
          >
            {status === "sending" ? "Sending" : "Send to scout"}
          </button>
          {status === "sent" ? (
            <p className="success">Package sent to the Pears connection.</p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

export function ReceivedPackagePanel({
  playerPackage
}: {
  readonly playerPackage: SharedPlayerPackage | undefined;
}) {
  return (
    <section className="panel" aria-labelledby="received-profile-title">
      <p className="eyebrow">Received via Pears</p>
      <h2 id="received-profile-title">Shared player package</h2>
      {playerPackage === undefined ? (
        <p className="summary">No player package has been received for this relationship.</p>
      ) : (
        <>
          <div className="report-grid">
            <article>
              <h3>Profile</h3>
              <p>{Object.keys(playerPackage.selectedProfileFields).join(", ") || "None"}</p>
            </article>
            <article>
              <h3>Report</h3>
              <p>{Object.keys(playerPackage.selectedReportSections).join(", ") || "None"}</p>
            </article>
          </div>
          <pre>{JSON.stringify(playerPackage, null, 2)}</pre>
        </>
      )}
    </section>
  );
}

const formatBytes = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;
const toMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The profile package could not be shared.";
