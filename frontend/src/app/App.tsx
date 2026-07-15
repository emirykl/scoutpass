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
import { TryoutPanel } from "../features/invitations/TryoutPanel.js";
import { WalletPanel } from "../features/wallet/WalletPanel.js";
import {
  createLocalPreviewReport,
  demoPlayerProfile,
  runtimeSnapshot
} from "../runtime/local-runtime.js";
import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime,
  subscribeRuntimeEvents
} from "../runtime/runtime-bridge.js";

const runtime = getRuntimeInfo();
const RELATIONSHIP_ID = "relationship_demo_001";

type Role = "player" | "scout";
type WorkspaceStep = "profile" | "report" | "connect" | "share" | "player" | "invite" | "wallet";

const WORKSPACE_STEPS: Record<
  Role,
  ReadonlyArray<{ readonly id: WorkspaceStep; readonly label: string }>
> = {
  player: [
    { id: "profile", label: "Profile" },
    { id: "report", label: "Local report" },
    { id: "connect", label: "Connect" },
    { id: "share", label: "Share" },
    { id: "invite", label: "Tryout" },
    { id: "wallet", label: "Wallet" }
  ],
  scout: [
    { id: "connect", label: "Connect" },
    { id: "player", label: "Player" },
    { id: "invite", label: "Tryout" },
    { id: "wallet", label: "Wallet" }
  ]
};

export function App() {
  const [role, setRole] = useState<Role>("player");
  const [activeStep, setActiveStep] = useState<WorkspaceStep>("profile");
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

  const changeRole = (nextRole: Role) => {
    setRole(nextRole);
    setActiveStep(WORKSPACE_STEPS[nextRole][0]?.id ?? "connect");
  };

  const steps = WORKSPACE_STEPS[role];
  const activeStepIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeStep)
  );
  const previousStep = steps[activeStepIndex - 1];
  const nextStep = steps[activeStepIndex + 1];
  const desktopRuntimeAvailable = isDesktopRuntimeAvailable();

  return (
    <main className="shell">
      <header className="app-header">
        <a className="brand" href="#workspace" aria-label="ScoutPass home">
          ScoutPass
        </a>
        <div className="header-status" role="status">
          <span className={desktopRuntimeAvailable ? "status-dot ready" : "status-dot"} />
          <span>{desktopRuntimeAvailable ? "Desktop ready" : "Browser preview"}</span>
          <span className="header-divider" />
          <span>Sepolia testnet</span>
        </div>
      </header>

      <WelcomePanel role={role} onRoleChange={changeRole} />

      <section className="workflow" id="workspace" aria-label={`${role} workspace`}>
        <div className="workflow-heading">
          <div>
            <p className="eyebrow">{role === "player" ? "Player journey" : "Scout journey"}</p>
            <h2>{role === "player" ? "Your next steps" : "Scouting workflow"}</h2>
          </div>
          <p>
            Step {activeStepIndex + 1} of {steps.length}
          </p>
        </div>

        <nav className="workflow-nav" aria-label={`${role} steps`}>
          {steps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={step.id === activeStep ? "active" : ""}
              aria-current={step.id === activeStep ? "step" : undefined}
              onClick={() => setActiveStep(step.id)}
            >
              <span>{index + 1}</span>
              {step.label}
            </button>
          ))}
        </nav>

        <div className="workspace-panel">
          {role === "player" && activeStep === "profile" ? (
            <PlayerProfileForm value={player} onChange={setPlayer} onLoadDemo={loadDemo} />
          ) : null}
          {role === "player" && activeStep === "report" ? (
            <ScoutReportPanel
              player={player}
              report={report}
              onGeneratePreview={updateReportPreview}
            />
          ) : null}
          {activeStep === "connect" ? (
            <ConnectionPanel
              snapshot={runtimeSnapshot}
              role={role}
              relationshipId={RELATIONSHIP_ID}
            />
          ) : null}
          {role === "player" && activeStep === "share" ? (
            <SharingPanel player={player} report={report} onSend={sendPreparedShare} />
          ) : null}
          {role === "scout" && activeStep === "player" ? (
            <ReceivedPackagePanel playerPackage={receivedPackage} />
          ) : null}
          {activeStep === "invite" ? (
            <TryoutPanel
              role={role}
              relationshipId={RELATIONSHIP_ID}
              receivedPackage={role === "scout" ? receivedPackage : undefined}
            />
          ) : null}
          {activeStep === "wallet" ? (
            <WalletPanel role={role} relationshipId={RELATIONSHIP_ID} />
          ) : null}
        </div>

        <div className="workflow-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={previousStep === undefined}
            onClick={() => previousStep && setActiveStep(previousStep.id)}
          >
            Previous
          </button>
          {nextStep ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setActiveStep(nextStep.id)}
            >
              Continue to {nextStep.label}
            </button>
          ) : (
            <span className="flow-complete">Workflow overview complete</span>
          )}
        </div>
      </section>

      <footer className="app-footer">
        Local-first · Protocol {runtime.protocolVersion} · Testnet funds only
      </footer>
    </main>
  );
}
