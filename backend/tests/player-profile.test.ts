import { describe, expect, it } from "vitest";

import { playerProfileSchema } from "../src/domain/models/player-profile.js";
import {
  calculateNormalizedPerformance,
  calculatePositionIndicators
} from "../src/domain/services/position-metrics.js";
import { createPlayer } from "./fixtures.js";

describe("player profile", () => {
  it("accepts a valid position-specific demo profile", () => {
    expect(playerProfileSchema.safeParse(createPlayer()).success).toBe(true);
  });

  it("rejects players younger than 18", () => {
    const player = createPlayer({
      football: { ...createPlayer().football, age: 17 }
    });
    expect(playerProfileSchema.safeParse(player).success).toBe(false);
  });

  it("rejects performance data for a different position group", () => {
    const player = createPlayer({
      football: { ...createPlayer().football, positionGroup: "defender" }
    });
    expect(playerProfileSchema.safeParse(player).success).toBe(false);
  });

  it("calculates normalized per-90 and per-match performance without floating point noise", () => {
    expect(
      calculateNormalizedPerformance({
        assists: 6,
        goals: 7,
        matchesPlayed: 18,
        minutesPlayed: 1260
      })
    ).toEqual({ assistsPer90: 0.43, goalsPer90: 0.5, minutesPerMatch: 70 });
  });

  it("returns zero normalized values when no minutes were played", () => {
    expect(
      calculateNormalizedPerformance({ assists: 0, goals: 0, matchesPlayed: 0, minutesPlayed: 0 })
    ).toEqual({ assistsPer90: 0, goalsPer90: 0, minutesPerMatch: 0 });
  });

  it("calculates position-specific indicators for every position group", () => {
    expect(
      calculatePositionIndicators({
        positionGroup: "goalkeeper",
        saves: 50,
        savePercentage: 76.5,
        cleanSheets: 8,
        crossesClaimed: 22,
        distributionAccuracy: 83
      })
    ).toMatchObject({ positionGroup: "goalkeeper", savePercentage: 76.5 });
    expect(
      calculatePositionIndicators({
        positionGroup: "defender",
        tacklesPerMatch: 3.2,
        interceptionsPerMatch: 1.8,
        clearancesPerMatch: 4.1,
        aerialDuelsWonPercentage: 68,
        passingAccuracy: 85
      })
    ).toMatchObject({ positionGroup: "defender", defensiveActionsPerMatch: 9.1 });
    expect(
      calculatePositionIndicators({
        positionGroup: "midfielder",
        passCompletionPercentage: 88,
        keyPassesPerMatch: 2.1,
        assists: 6,
        ballRecoveriesPerMatch: 5.4,
        chancesCreated: 31
      })
    ).toMatchObject({ positionGroup: "midfielder", involvementPerMatch: 7.5 });
    expect(
      calculatePositionIndicators({
        positionGroup: "forward",
        goals: 7,
        shots: 46,
        shotsOnTarget: 24,
        assists: 6,
        successfulDribblesPerMatch: 3.1
      })
    ).toEqual({ positionGroup: "forward", shootingAccuracy: 52.17, goalConversion: 15.22 });
  });
});
