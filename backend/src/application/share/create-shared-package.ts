import { SCHEMA_VERSION } from "../../domain/constants.js";
import { createId } from "../../domain/identity.js";
import type { PlayerProfile } from "../../domain/models/player-profile.js";
import type { ScoutReport } from "../../domain/models/scout-report.js";
import type { SharedPlayerPackage, ShareSelection } from "../../domain/models/sharing.js";
import { sharedPlayerPackageSchema } from "../../domain/models/sharing.js";

export interface CreateSharedPackageInput {
  readonly player: PlayerProfile;
  readonly report: ScoutReport;
  readonly selection: ShareSelection;
  readonly playerPublicKey: string;
  readonly now?: Date;
  readonly expiresAt?: string;
}

export const createSharedPackage = (input: CreateSharedPackageInput): SharedPlayerPackage => {
  const profile: Record<string, unknown> = {};
  const report: Record<string, unknown> = {};

  if (input.selection.basicFootballProfile) {
    profile.football = input.player.football;
  }
  if (input.selection.contactInformation && input.player.contact !== undefined) {
    profile.contact = input.player.contact;
  }
  if (input.selection.statistics) {
    profile.performance = input.player.performance;
  }
  if (input.selection.coachNotes) {
    profile.coachFeedback = input.player.qualitative.coachFeedback;
  }
  if (input.selection.playerSummary) {
    report.playerSummary = input.report.playerSummary;
  }
  if (input.selection.strengths) {
    report.strengths = input.report.strengths;
  }
  if (input.selection.developmentAreas) {
    report.developmentAreas = input.report.developmentAreas;
  }
  if (input.selection.playingStyle) {
    report.playingStyle = input.report.playingStyle;
  }
  if (input.selection.scoutQuestions) {
    report.scoutQuestions = input.report.scoutQuestions;
  }

  const packageCandidate = {
    packageId: createId("package"),
    playerPublicKey: input.playerPublicKey,
    selectedProfileFields: profile,
    selectedReportSections: report,
    createdAt: (input.now ?? new Date()).toISOString(),
    ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    schemaVersion: SCHEMA_VERSION
  };

  return sharedPlayerPackageSchema.parse(packageCandidate);
};
