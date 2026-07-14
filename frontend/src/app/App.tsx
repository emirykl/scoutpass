import { useCallback, useState } from "react";

import { getRuntimeInfo } from "@scoutpass/backend/runtime";

import "./app.css";
import { ConnectionPanel } from "../features/connections/ConnectionPanel.js";
import { WelcomePanel } from "../features/onboarding/WelcomePanel.js";
import { PlayerProfileForm } from "../features/player-profile/PlayerProfileForm.js";
import { ScoutReportPanel } from "../features/scout-report/ScoutReportPanel.js";
import {
  createLocalPreviewReport,
  demoPlayerProfile,
  runtimeSnapshot
} from "../runtime/local-runtime.js";

const runtime = getRuntimeInfo();

export function App() {
  const [role, setRole] = useState<"player" | "scout">("player");
  const [player, setPlayer] = useState(demoPlayerProfile);
  const [report, setReport] = useState(() => createLocalPreviewReport(demoPlayerProfile));

  const loadDemo = useCallback(() => {
    setPlayer(demoPlayerProfile);
    setReport(createLocalPreviewReport(demoPlayerProfile));
  }, []);

  const updateReportPreview = useCallback(() => {
    setReport(createLocalPreviewReport(player));
  }, [player]);

  return (
    <main className="shell">
      <div className="runtime-bar" role="status">
        <span aria-hidden="true" />
        Local runtime {runtime.status} · Protocol {runtime.protocolVersion}
      </div>
      <WelcomePanel role={role} onRoleChange={setRole} />
      <div className="workspace-grid">
        {role === "player" ? (
          <>
            <PlayerProfileForm value={player} onChange={setPlayer} onLoadDemo={loadDemo} />
            <ScoutReportPanel
              player={player}
              report={report}
              onGeneratePreview={updateReportPreview}
            />
          </>
        ) : (
          <section className="panel" aria-labelledby="scout-title">
            <p className="eyebrow">Scout workspace</p>
            <h2 id="scout-title">Create scouting connection</h2>
            <p className="summary">
              The Pears transport adapter is ready for invite-based scouting relationships. The next
              screen will expose invite creation and received package review.
            </p>
          </section>
        )}
        <ConnectionPanel snapshot={runtimeSnapshot} />
      </div>
    </main>
  );
}
