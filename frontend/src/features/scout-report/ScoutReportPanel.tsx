import { useState } from "react";

import { REPORT_DISCLAIMER, type ScoutReport } from "@scoutpass/backend/contracts";

interface ScoutReportPanelProps {
  readonly report?: ScoutReport | undefined;
  readonly desktopRuntimeAvailable: boolean;
  readonly onGenerate: () => Promise<void>;
}

export function ScoutReportPanel({
  report,
  desktopRuntimeAvailable,
  onGenerate
}: ScoutReportPanelProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>();

  const generate = async () => {
    setStatus("loading");
    setErrorMessage(undefined);
    try {
      await onGenerate();
      setStatus("idle");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The private AI report could not be generated."
      );
      setStatus("error");
    }
  };

  return (
    <section className="panel" aria-labelledby="report-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Private AI analysis</p>
          <h2 id="report-title">Your scouting report</h2>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={!desktopRuntimeAvailable || status === "loading"}
          onClick={() => void generate()}
        >
          {status === "loading" ? "Generating on this device..." : "Generate report"}
        </button>
      </div>

      {!desktopRuntimeAvailable ? (
        <div className="notice">Open the Player desktop app to generate a private AI report.</div>
      ) : null}
      {status === "error" && errorMessage ? (
        <div className="notice" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="notice">{REPORT_DISCLAIMER}</div>

          <div className="report-grid">
            <article>
              <h3>Player summary</h3>
              <p>{report.playerSummary}</p>
            </article>
            <article>
              <h3>Positional profile</h3>
              <p>{report.positionalProfile}</p>
            </article>
          </div>

          <div className="report-list">
            <h3>Strengths</h3>
            {report.strengths.map((item) => (
              <article key={item.title}>
                <div className="confidence">{item.confidence}</div>
                <h3>{item.title}</h3>
                <p>{item.explanation}</p>
                <ul>
                  {item.evidence.map((evidence) => (
                    <li key={evidence}>{evidence}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="report-list">
            <h3>Development areas</h3>
            {report.developmentAreas.map((item) => (
              <article key={item.title}>
                <div className="confidence">{item.confidence}</div>
                <h3>{item.title}</h3>
                <p>{item.explanation}</p>
                <ul>
                  {item.evidence.map((evidence) => (
                    <li key={evidence}>{evidence}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="report-grid report-meta">
            <article>
              <h3>Playing style</h3>
              <p>{report.playingStyle}</p>
            </article>
            <article>
              <h3>Suitable systems</h3>
              <p>{report.suitableSystems.join(", ")}</p>
            </article>
            <article>
              <h3>Scout questions</h3>
              <ul>
                {report.scoutQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </article>
            <article>
              <h3>Data limitations</h3>
              <ul>
                {report.dataLimitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
