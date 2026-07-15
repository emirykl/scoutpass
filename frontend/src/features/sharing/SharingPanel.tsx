import { useState } from "react";

import type {
  PlayerProfile,
  ScoutReport,
  SharedPlayerPackage,
  ShareSelection
} from "@scoutpass/backend/contracts";
import {
  DEFAULT_SHARE_SELECTION,
  preparePlayerShare,
  type PreparedPlayerShare
} from "@scoutpass/backend/sharing";
import { toUserFacingMessage } from "../../runtime/user-facing-errors.js";

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
          <div data-testid="share-json-preview">
            <h3>The scout will receive</h3>
            <SharedDataView playerPackage={prepared.package} />
          </div>
          <label className="approval-row">
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            I approve sharing exactly the information shown above with this scout.
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
            <p className="success">Profile shared with the connected scout.</p>
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
      <p className="eyebrow">Player-approved information</p>
      <h2 id="received-profile-title">Player profile</h2>
      {playerPackage === undefined ? (
        <p className="summary">Waiting for the player to choose and share their information.</p>
      ) : (
        <SharedDataView playerPackage={playerPackage} />
      )}
    </section>
  );
}

function SharedDataView({ playerPackage }: { readonly playerPackage: SharedPlayerPackage }) {
  const sections = [
    ...Object.entries(playerPackage.selectedProfileFields),
    ...Object.entries(playerPackage.selectedReportSections)
  ];

  if (sections.length === 0) {
    return <p className="summary">No information selected.</p>;
  }

  return (
    <div className="shared-data-preview">
      {sections.map(([label, value]) => (
        <section className="shared-section" key={label}>
          <h4>{humanize(label)}</h4>
          <ReadableValue value={value} />
        </section>
      ))}
    </div>
  );
}

function ReadableValue({ value }: { readonly value: unknown }) {
  if (value === null || value === undefined) return <span>Not provided</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    return (
      <ul className="shared-value-list">
        {items.map((item, index) => (
          <li key={index}>
            <ReadableValue value={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const fields = Object.entries(value as Record<string, unknown>);
    return (
      <dl className="shared-fields">
        {fields.map(([label, nestedValue]) => (
          <div key={label}>
            <dt>{humanize(label)}</dt>
            <dd>
              <ReadableValue value={nestedValue} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>Not provided</span>;
}

const humanize = (value: string): string =>
  value
    .replaceAll(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase());

const toMessage = (error: unknown): string =>
  toUserFacingMessage(error, "The profile package could not be shared.");
