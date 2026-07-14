import { useCallback, useEffect, useState } from "react";

import type { SharedPlayerPackage } from "@scoutpass/backend/contracts";
import { getRuntimeInfo } from "@scoutpass/backend/runtime";
import type { PreparedPlayerShare } from "@scoutpass/backend/sharing";

import "./app.css";
import { ConnectionPanel } from "../features/connections/ConnectionPanel.js";
import { WelcomePanel } from "../features/onboarding/WelcomePanel.js";
import { PlayerProfileForm } from "../features/player-profile/PlayerProfileForm.js";
import { ScoutReportPanel } from "../features/scout-report/ScoutReportPanel.js";
import { ReceivedPackagePanel, SharingPanel } from "../features/sharing/SharingPanel.js";
import {
  createLocalPreviewReport,
  demoPlayerProfile,
  runtimeSnapshot
} from "../runtime/local-runtime.js";
import {
  createRuntimeRequest,
  requestRuntime,
  subscribeRuntimeEvents
} from "../runtime/runtime-bridge.js";

const runtime = getRuntimeInfo();
const RELATIONSHIP_ID = "relationship_demo_001";

export function App() {
  const [role, setRole] = useState<"player" | "scout">("player");
  const [player, setPlayer] = useState(demoPlayerProfile);
  const [report, setReport] = useState(() => createLocalPreviewReport(demoPlayerProfile));
  const [receivedPackage, setReceivedPackage] = useState<SharedPlayerPackage>();

  useEffect(
    () =>
      subscribeRuntimeEvents((event) => {
        if (event.type === "share.received") {
          setReceivedPackage(event.payload.package);
        }
      }),
    []
  );

  const loadDemo = useCallback(() => {
    setPlayer(demoPlayerProfile);
    setReport(createLocalPreviewReport(demoPlayerProfile));
  }, []);

  const updateReportPreview = useCallback(() => {
    setReport(createLocalPreviewReport(player));
  }, [player]);

  const sendPreparedShare = useCallback(async (prepared: PreparedPlayerShare) => {
    const event = await requestRuntime({
      ...createRuntimeRequest(),
      type: "share.send",
      payload: {
        relationshipId: RELATIONSHIP_ID,
        package: prepared.package,
        serializedPayload: prepared.serializedPayload,
        payloadBytes: prepared.payloadBytes,
        playerApproved: true
      }
    });
    if (event.type === "operation.failed") {
      throw new Error(event.payload.message);
    }
    if (event.type !== "share.sent" || event.payload.packageId !== prepared.package.packageId) {
      throw new Error("Desktop runtime did not confirm the selected package.");
    }
  }, []);

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
            <SharingPanel player={player} report={report} onSend={sendPreparedShare} />
          </>
        ) : (
          <ReceivedPackagePanel playerPackage={receivedPackage} />
        )}
        <ConnectionPanel snapshot={runtimeSnapshot} role={role} relationshipId={RELATIONSHIP_ID} />
      </div>
    </main>
  );
}
