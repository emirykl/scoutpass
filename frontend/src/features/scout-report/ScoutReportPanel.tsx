import {
  REPORT_DISCLAIMER,
  type PlayerProfile,
  type ScoutReport
} from "@scoutpass/backend/contracts";

interface ScoutReportPanelProps {
  readonly player: PlayerProfile;
  readonly report: ScoutReport;
  readonly onGeneratePreview: () => void;
}

export function ScoutReportPanel({ player, report, onGeneratePreview }: ScoutReportPanelProps) {
  return (
    <section className="panel" aria-labelledby="report-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">QVAC report</p>
          <h2 id="report-title">Local scouting report</h2>
        </div>
        <button type="button" className="primary-button" onClick={onGeneratePreview}>
          Preview QVAC payload
        </button>
      </div>

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

      <details>
        <summary>Exact data preview for QVAC</summary>
        <pre>
          {JSON.stringify(
            {
              football: player.football,
              performance: player.performance,
              qualitative: player.qualitative
            },
            null,
            2
          )}
        </pre>
      </details>
    </section>
  );
}
