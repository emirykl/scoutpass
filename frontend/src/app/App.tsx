import { useCallback, useEffect, useState } from "react";

import type {
  PaymentReference,
  RuntimeEvent,
  SharedPlayerPackage,
  TryoutInvitation,
  WalletPublicMetadata
} from "@scoutpass/backend/contracts";
import type { PreparedPlayerShare } from "@scoutpass/backend/sharing";

import "./app.css";
import { ConnectionPanel } from "../features/connections/ConnectionPanel.js";
import { PlayerProfileForm } from "../features/player-profile/PlayerProfileForm.js";
import { ScoutReportPanel } from "../features/scout-report/ScoutReportPanel.js";
import { ReceivedPackagePanel, SharingPanel } from "../features/sharing/SharingPanel.js";
import { TryoutPanel } from "../features/invitations/TryoutPanel.js";
import { WalletPanel } from "../features/wallet/WalletPanel.js";
import { PaymentPanel } from "../features/wallet/PaymentPanel.js";
import { SettingsPanel } from "../features/settings/SettingsPanel.js";
import { createLocalPreviewReport, demoPlayerProfile } from "../runtime/local-runtime.js";
import {
  createRuntimeRequest,
  isDesktopRuntimeAvailable,
  requestRuntime,
  subscribeRuntimeEvents
} from "../runtime/runtime-bridge.js";
import { runtimeFailureError } from "../runtime/user-facing-errors.js";

const RELATIONSHIP_ID = "relationship_demo_001";

type Role = "player" | "scout";
type WorkspaceStep = "profile" | "report" | "connect" | "share" | "player" | "invite" | "wallet";

type PeerConnectionStatus = Extract<
  RuntimeEvent,
  { readonly type: "connection.status" }
>["payload"]["status"];

const initialRole: Role =
  new URLSearchParams(globalThis.location.search).get("role") === "scout" ? "scout" : "player";

const WORKSPACE_STEPS: Record<
  Role,
  ReadonlyArray<{ readonly id: WorkspaceStep; readonly label: string }>
> = {
  player: [
    { id: "profile", label: "Profile" },
    { id: "report", label: "AI report" },
    { id: "connect", label: "Connect" },
    { id: "share", label: "Share" },
    { id: "invite", label: "Tryout" },
    { id: "wallet", label: "Wallet & payment" }
  ],
  scout: [
    { id: "connect", label: "Connect" },
    { id: "player", label: "Player" },
    { id: "invite", label: "Tryout" },
    { id: "wallet", label: "Wallet & payment" }
  ]
};

const ROLE_INTRO: Record<Role, { readonly title: string; readonly summary: string }> = {
  player: {
    title: "Your football profile, under your control",
    summary: "Build your profile, generate a local report and choose what reaches a scout."
  },
  scout: {
    title: "A direct path from player to tryout",
    summary: "Connect privately, review approved player data and manage the tryout."
  }
};

export function App() {
  const [role, setRole] = useState<Role>(initialRole);
  const [activeStep, setActiveStep] = useState<WorkspaceStep>(
    WORKSPACE_STEPS[initialRole][0]?.id ?? "profile"
  );
  const [player, setPlayer] = useState(demoPlayerProfile);
  const [report, setReport] = useState(() => createLocalPreviewReport(demoPlayerProfile));
  const [receivedPackage, setReceivedPackage] = useState<SharedPlayerPackage>();
  const [invitation, setInvitation] = useState<TryoutInvitation>();
  const [payment, setPayment] = useState<PaymentReference>();
  const [, setWallet] = useState<WalletPublicMetadata>();
  const [connectionStatus, setConnectionStatus] = useState<PeerConnectionStatus>("idle");
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const handleRuntimeEvent = useCallback((event: RuntimeEvent) => {
    if (event.type === "share.received") setReceivedPackage(event.payload.package);
    if (event.type === "invitation.updated") setInvitation(event.payload.invitation);
    if (event.type === "payment.updated") setPayment(event.payload.payment);
    if (event.type === "wallet.updated") setWallet(event.payload.wallet);
    if (event.type === "report.updated") setReport(event.payload.report.content);
    if (event.type === "connection.status") setConnectionStatus(event.payload.status);
    if (event.type === "workspace.snapshot") {
      const snapshotPlayer = event.payload.profiles.at(-1);
      const snapshotReport = event.payload.reports.at(-1);
      if (snapshotPlayer) setPlayer(snapshotPlayer);
      if (snapshotReport) setReport(snapshotReport.content);
      setReceivedPackage(event.payload.receivedPackages.at(-1));
      setInvitation(event.payload.invitations.at(-1));
      setPayment(event.payload.payments.at(-1));
    }
  }, []);

  useEffect(() => subscribeRuntimeEvents(handleRuntimeEvent), [handleRuntimeEvent]);

  useEffect(() => {
    if (!isDesktopRuntimeAvailable()) return;
    void requestRuntime({ ...createRuntimeRequest(), type: "workspace.snapshot.get" })
      .then(handleRuntimeEvent)
      .catch(() => undefined);
  }, [handleRuntimeEvent]);

  const generateReport = useCallback(async () => {
    const saved = await requestRuntime({
      ...createRuntimeRequest(),
      type: "profile.save",
      payload: player
    });
    if (saved.type === "operation.failed") {
      throw runtimeFailureError(saved.payload, "The player profile could not be saved.");
    }

    const generated = await requestRuntime({
      ...createRuntimeRequest(),
      type: "report.generate",
      payload: { playerId: player.id }
    });
    if (generated.type === "operation.failed") {
      throw runtimeFailureError(generated.payload, "The local QVAC report could not be generated.");
    }
    if (generated.type !== "report.updated" || generated.payload.report.playerId !== player.id) {
      throw new Error("Desktop runtime returned an unexpected QVAC report response.");
    }
    setReport(generated.payload.report.content);
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
      throw runtimeFailureError(event.payload, "The selected profile could not be shared.");
    }
    if (event.type !== "share.sent" || event.payload.packageId !== prepared.package.packageId) {
      throw new Error("Desktop runtime did not confirm the selected package.");
    }
  }, []);

  const changeRole = (nextRole: Role) => {
    setRole(nextRole);
    setPrivacyOpen(false);
    setActiveStep(WORKSPACE_STEPS[nextRole][0]?.id ?? "profile");
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
        <div className="role-switch" aria-label="Choose role">
          <button
            type="button"
            className={role === "player" ? "active" : ""}
            onClick={() => changeRole("player")}
          >
            Player
          </button>
          <button
            type="button"
            className={role === "scout" ? "active" : ""}
            onClick={() => changeRole("scout")}
          >
            Scout
          </button>
        </div>
        <div className="header-status">Testnet environment</div>
      </header>

      <section className={`role-intro role-intro-${role}`} aria-labelledby="workspace-title">
        <div>
          <p className="eyebrow">{role === "player" ? "Player workspace" : "Scout workspace"}</p>
          <h1 id="workspace-title">{ROLE_INTRO[role].title}</h1>
          <p>{ROLE_INTRO[role].summary}</p>
        </div>
        <img src="/logo.png" alt="Football player striking a ball" />
      </section>

      <section className="workflow" id="workspace" aria-label={`${role} workspace`}>
        <div className="workflow-heading">
          <div>
            <p className="eyebrow">
              {privacyOpen
                ? "Your privacy"
                : `${role === "player" ? "Player journey" : "Scout journey"} · Step ${activeStepIndex + 1}`}
            </p>
            <h2>{privacyOpen ? "Privacy & data" : steps[activeStepIndex]?.label}</h2>
          </div>
          <div className={`connection-state status-${connectionStatus}`}>
            <span
              className={connectionStatus === "connected" ? "status-dot ready" : "status-dot"}
            />
            {connectionStatus.replaceAll("_", " ")}
          </div>
        </div>

        {!privacyOpen ? (
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
        ) : null}

        {!privacyOpen && activeStep === "invite" ? (
          <div className="identity-warning" role="note">
            Scout and club identity is not verified. Confirm travel details independently.
          </div>
        ) : null}

        <div className="workspace-panel">
          {privacyOpen ? <SettingsPanel /> : null}
          {!privacyOpen && role === "player" && activeStep === "profile" ? (
            <PlayerProfileForm value={player} onChange={setPlayer} />
          ) : null}
          {!privacyOpen && role === "player" && activeStep === "report" ? (
            <ScoutReportPanel
              report={report}
              desktopRuntimeAvailable={desktopRuntimeAvailable}
              onGenerate={generateReport}
            />
          ) : null}
          {!privacyOpen && activeStep === "connect" ? (
            <ConnectionPanel
              role={role}
              relationshipId={RELATIONSHIP_ID}
              onStatusChange={setConnectionStatus}
            />
          ) : null}
          {!privacyOpen && role === "player" && activeStep === "share" ? (
            <SharingPanel player={player} report={report} onSend={sendPreparedShare} />
          ) : null}
          {!privacyOpen && role === "scout" && activeStep === "player" ? (
            <ReceivedPackagePanel playerPackage={receivedPackage} />
          ) : null}
          {!privacyOpen && activeStep === "invite" ? (
            <TryoutPanel
              role={role}
              relationshipId={RELATIONSHIP_ID}
              receivedPackage={role === "scout" ? receivedPackage : undefined}
              onInvitationChange={setInvitation}
            />
          ) : null}
          {!privacyOpen && activeStep === "wallet" ? (
            <>
              <WalletPanel
                role={role}
                relationshipId={RELATIONSHIP_ID}
                onWalletChange={setWallet}
              />
              <PaymentPanel
                role={role}
                invitation={invitation}
                payment={payment}
                onPaymentChange={setPayment}
              />
            </>
          ) : null}
        </div>

        <div className="workflow-actions">
          {privacyOpen ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setPrivacyOpen(false)}
            >
              Back to workflow
            </button>
          ) : (
            <>
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
                <span className="flow-complete">Workflow complete</span>
              )}
            </>
          )}
        </div>
      </section>

      <footer className="app-footer">
        <span>Private football scouting · Testnet funds only</span>
        <button type="button" onClick={() => setPrivacyOpen(true)}>
          Privacy & data
        </button>
      </footer>
    </main>
  );
}
