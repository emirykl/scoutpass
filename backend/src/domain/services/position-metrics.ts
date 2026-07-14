import type { CommonPerformance, PositionMetrics } from "../models/player-profile.js";

export interface NormalizedPerformance {
  readonly assistsPer90: number;
  readonly goalsPer90: number;
  readonly minutesPerMatch: number;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export const calculateNormalizedPerformance = (
  performance: Pick<CommonPerformance, "assists" | "goals" | "matchesPlayed" | "minutesPlayed">
): NormalizedPerformance => {
  if (performance.minutesPlayed === 0 || performance.matchesPlayed === 0) {
    return { assistsPer90: 0, goalsPer90: 0, minutesPerMatch: 0 };
  }

  return {
    assistsPer90: round((performance.assists * 90) / performance.minutesPlayed),
    goalsPer90: round((performance.goals * 90) / performance.minutesPlayed),
    minutesPerMatch: round(performance.minutesPlayed / performance.matchesPlayed)
  };
};

export type PositionIndicators =
  | {
      readonly positionGroup: "goalkeeper";
      readonly savePercentage: number;
      readonly distributionAccuracy: number;
    }
  | {
      readonly positionGroup: "defender";
      readonly defensiveActionsPerMatch: number;
      readonly aerialDuelsWonPercentage: number;
    }
  | {
      readonly positionGroup: "midfielder";
      readonly involvementPerMatch: number;
      readonly passCompletionPercentage: number;
    }
  | {
      readonly positionGroup: "forward";
      readonly shootingAccuracy: number;
      readonly goalConversion: number;
    };

export const calculatePositionIndicators = (metrics: PositionMetrics): PositionIndicators => {
  switch (metrics.positionGroup) {
    case "goalkeeper":
      return {
        positionGroup: metrics.positionGroup,
        savePercentage: metrics.savePercentage,
        distributionAccuracy: metrics.distributionAccuracy
      };
    case "defender":
      return {
        positionGroup: metrics.positionGroup,
        defensiveActionsPerMatch: round(
          metrics.tacklesPerMatch + metrics.interceptionsPerMatch + metrics.clearancesPerMatch
        ),
        aerialDuelsWonPercentage: metrics.aerialDuelsWonPercentage
      };
    case "midfielder":
      return {
        positionGroup: metrics.positionGroup,
        involvementPerMatch: round(metrics.keyPassesPerMatch + metrics.ballRecoveriesPerMatch),
        passCompletionPercentage: metrics.passCompletionPercentage
      };
    case "forward": {
      const hasShots = metrics.shots > 0;
      return {
        positionGroup: metrics.positionGroup,
        shootingAccuracy: hasShots ? round((metrics.shotsOnTarget / metrics.shots) * 100) : 0,
        goalConversion: hasShots ? round((metrics.goals / metrics.shots) * 100) : 0
      };
    }
  }
};
