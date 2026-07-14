import type { PlayerProfile, ScoutReport } from "@scoutpass/backend/contracts";

export interface RuntimeSnapshot {
  readonly qvac: "not_checked" | "unavailable" | "ready";
  readonly pears: "not_started" | "disconnected" | "connected";
  readonly wallet: "not_initialized" | "ready" | "error";
}

export const runtimeSnapshot: RuntimeSnapshot = {
  qvac: "not_checked",
  pears: "not_started",
  wallet: "not_initialized"
};

export const demoPlayerProfile: PlayerProfile = {
  id: "player_demo_emir_yenikale",
  football: {
    fullName: "Emir Yenikale",
    age: 22,
    country: "Turkiye",
    city: "Izmir",
    currentTeam: "Independent Amateur Player",
    primaryPosition: "Right Winger",
    secondaryPosition: "Attacking Midfielder",
    positionGroup: "forward",
    dominantFoot: "right",
    heightCm: 178,
    preferredPlayingStyle: "Direct wide attacker who creates space and attacks the defensive line.",
    careerObjective: "Earn a fair professional tryout through transparent performance evaluation."
  },
  performance: {
    common: {
      matchesPlayed: 18,
      minutesPlayed: 1260,
      goals: 7,
      assists: 6,
      passCompletionPercentage: 81,
      shotsOnTarget: 24,
      yellowCards: 2,
      redCards: 0,
      availability: "available",
      trainingFrequencyPerWeek: 4
    },
    positionSpecific: {
      positionGroup: "forward",
      goals: 7,
      shots: 46,
      shotsOnTarget: 24,
      assists: 6,
      successfulDribblesPerMatch: 3.1
    }
  },
  qualitative: {
    strongestQualities:
      "Acceleration, off-ball runs, creating space and one-versus-one situations.",
    developmentGoals: "Improve final-pass consistency and defensive positioning.",
    coachFeedback:
      "Creates attacking opportunities and makes frequent runs behind the defensive line.",
    preferredFormation: "4-3-3",
    matchExperience: "Regional amateur league and organized training matches.",
    personalStatement:
      "I want scouts to assess my football information while I remain in control of what I share."
  },
  selfReported: true,
  isDemo: true,
  createdAt: "2026-07-14T08:00:00.000Z",
  updatedAt: "2026-07-14T08:00:00.000Z"
};

export const createLocalPreviewReport = (player: PlayerProfile, now = new Date()): ScoutReport => ({
  playerSummary: `${player.football.fullName} is a ${player.football.primaryPosition} profile prepared for local QVAC analysis.`,
  positionalProfile: `The structured data will be evaluated as a ${player.football.positionGroup} before any scout package is shared.`,
  strengths: [
    {
      title: "QVAC-ready structured profile",
      explanation:
        "The player has supplied football context, self-entered performance numbers and qualitative notes.",
      evidence: [
        `${player.performance.common.matchesPlayed} matches and ${player.performance.common.minutesPlayed} minutes entered by the player`,
        player.qualitative.strongestQualities
      ],
      confidence: "medium"
    }
  ],
  developmentAreas: [
    {
      title: "Needs human scout verification",
      explanation:
        "ScoutPass treats the numbers as self-reported until a coach, club or tournament record verifies them.",
      evidence: [player.qualitative.developmentGoals],
      confidence: "low"
    }
  ],
  playingStyle: player.football.preferredPlayingStyle,
  suitableSystems: [player.qualitative.preferredFormation, "Scout review required"],
  scoutQuestions: [
    "Can the player reproduce these outputs against stronger opposition?",
    "Which parts of the profile can be independently verified before a trial?"
  ],
  dataLimitations: ["This is a UI preview. The final report must be generated locally by QVAC."],
  generatedAt: now.toISOString(),
  modelInfo: "UI preview pending QVAC desktop runtime"
});
