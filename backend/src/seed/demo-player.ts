import type { PlayerProfile } from "../domain/models/player-profile.js";

export const DEMO_PLAYER: PlayerProfile = {
  id: "player_demo_emir_yenikale",
  football: {
    fullName: "Emir Yenikale",
    age: 22,
    country: "Türkiye",
    city: "İzmir",
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
