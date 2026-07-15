interface WelcomePanelProps {
  readonly role: "player" | "scout";
  readonly onRoleChange: (role: "player" | "scout") => void;
}

export function WelcomePanel({ role, onRoleChange }: WelcomePanelProps) {
  return (
    <section className="welcome-panel" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <p className="eyebrow">Private football scouting</p>
        <h1 id="welcome-title">ScoutPass</h1>
        <p className="tagline">
          {role === "player"
            ? "Turn your football data into a private scouting profile you control."
            : "Review player-controlled profiles and move from discovery to tryout privately."}
        </p>
        <div className="product-points" aria-label="ScoutPass product flow">
          <span>On-device report</span>
          <span>Direct sharing</span>
          <span>Testnet travel support</span>
        </div>
      </div>
      <div className="role-picker">
        <p>I am joining as</p>
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
        <p className="role-note">
          {role === "player"
            ? "Create your profile and approve every share."
            : "Connect directly and keep your assessment local."}
        </p>
      </div>
    </section>
  );
}
