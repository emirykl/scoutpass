import { REPORT_DISCLAIMER } from "../src/domain/constants.js";
import type { TryoutInvitation } from "../src/domain/models/invitation.js";
import type { PlayerProfile } from "../src/domain/models/player-profile.js";
import type { ScoutReport, StoredScoutReport } from "../src/domain/models/scout-report.js";
import { DEMO_PLAYER } from "../src/seed/demo-player.js";

export const NOW = new Date("2026-07-14T10:00:00.000Z");
export const PUBLIC_KEY = "a".repeat(64);

export const createPlayer = (overrides: Partial<PlayerProfile> = {}): PlayerProfile => ({
  ...structuredClone(DEMO_PLAYER),
  ...overrides
});

export const createReport = (): ScoutReport => ({
  playerSummary: "A direct right winger with self-reported attacking output.",
  positionalProfile: "Wide forward who attacks space behind the defensive line.",
  strengths: [
    {
      title: "Direct attacking contribution",
      explanation: "The supplied numbers indicate regular goal involvement.",
      evidence: ["7 goals and 6 assists in 1,260 self-reported minutes"],
      confidence: "medium"
    }
  ],
  developmentAreas: [
    {
      title: "Defensive positioning",
      explanation: "The player identifies defensive positioning as a development goal.",
      evidence: ["Player-provided development goal"],
      confidence: "low"
    }
  ],
  playingStyle: "Direct winger who uses acceleration and off-ball movement.",
  suitableSystems: ["4-3-3", "4-2-3-1"],
  scoutQuestions: ["How consistently does the player contribute out of possession?"],
  dataLimitations: ["All statistics are self-entered and independently unverified."],
  generatedAt: NOW.toISOString(),
  modelInfo: "QVAC test fixture"
});

export const createStoredReport = (): StoredScoutReport => ({
  id: "report_demo_001",
  playerId: DEMO_PLAYER.id,
  content: createReport(),
  disclaimer: REPORT_DISCLAIMER,
  editedByPlayer: false,
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString()
});

export const createInvitation = (overrides: Partial<TryoutInvitation> = {}): TryoutInvitation => ({
  id: "invitation_demo_001",
  relationshipId: "relationship_demo_001",
  clubName: "İzmir Football Club",
  scoutName: "Demo Scout",
  trialTitle: "First Team Winger Trial",
  startsAt: "2026-07-20T07:00:00.000Z",
  endsAt: "2026-07-20T09:00:00.000Z",
  city: "İzmir",
  venue: "Demo Training Ground",
  positionEvaluated: "Right Winger",
  instructions: "Arrive 30 minutes early with standard training equipment.",
  contactDetails: "scout@example.test",
  travelSupportAmount: "25.50",
  paymentAsset: "spUSD",
  expiresAt: "2026-07-19T07:00:00.000Z",
  status: "draft",
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  ...overrides
});
