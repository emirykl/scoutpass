interface WelcomePanelProps {
  readonly role: "player" | "scout";
  readonly onRoleChange: (role: "player" | "scout") => void;
}

export function WelcomePanel({ role, onRoleChange }: WelcomePanelProps) {
  return (
    <section className="panel welcome-panel" aria-labelledby="welcome-title">
      <div>
        <p className="eyebrow">Private football scouting</p>
        <h1 id="welcome-title">ScoutPass</h1>
        <p className="tagline">Own your game. Share your potential.</p>
      </div>
      <div className="segmented" aria-label="Choose role">
        <button
          type="button"
          className={role === "player" ? "active" : ""}
          onClick={() => onRoleChange("player")}
        >
          Player
        </button>
        <button
          type="button"
          className={role === "scout" ? "active" : ""}
          onClick={() => onRoleChange("scout")}
        >
          Scout
        </button>
      </div>
      <p className="summary">
        QVAC reports stay on the device, Pears shares only the approved package, and WDK payments
        are testnet-only travel support after a real invitation.
      </p>
      <div className="warning">Testnet only · Never use real funds</div>
    </section>
  );
}
