import { getRuntimeInfo } from "@scoutpass/backend/runtime";

import "./app.css";

const runtime = getRuntimeInfo();

export function App() {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="product-title">
        <p className="eyebrow">Private football scouting</p>
        <h1 id="product-title">ScoutPass</h1>
        <p className="tagline">Own your game. Share your potential.</p>
        <p className="summary">
          On-device scouting reports, direct player–scout sharing, and optional testnet travel
          support in one local-first workflow.
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" />
          Local runtime {runtime.status} · Protocol {runtime.protocolVersion}
        </div>
        <div className="warning">Testnet only · Never use real funds</div>
      </section>
    </main>
  );
}
