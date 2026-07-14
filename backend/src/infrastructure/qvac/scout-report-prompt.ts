import { REPORT_DISCLAIMER, SELF_REPORTED_DATA_NOTICE } from "../../domain/constants.js";
import type { PlayerProfile } from "../../domain/models/player-profile.js";

export const buildScoutReportPrompt = (player: PlayerProfile): string => {
  const payload = {
    football: player.football,
    performance: player.performance,
    qualitative: player.qualitative,
    notices: {
      selfReported: SELF_REPORTED_DATA_NOTICE,
      disclaimer: REPORT_DISCLAIMER
    }
  };

  return [
    "You are ScoutPass, a local football scouting report generator.",
    "Return ONLY valid JSON matching the provided schema. Do not wrap the JSON in markdown.",
    "Use the player's self-entered football data to support human scouting review.",
    "Do not claim that the player will become professional.",
    "Do not provide medical advice or injury-risk diagnosis.",
    "Do not make final recruitment decisions.",
    "Do not rank the player's human value.",
    "Always explain that the supplied statistics are self-entered and independently unverified.",
    "Keep confidence levels conservative when evidence is only qualitative.",
    "The output must include playerSummary, positionalProfile, strengths, developmentAreas, playingStyle, suitableSystems, scoutQuestions, dataLimitations, generatedAt and modelInfo.",
    "Player data:",
    JSON.stringify(payload, null, 2)
  ].join("\n\n");
};
