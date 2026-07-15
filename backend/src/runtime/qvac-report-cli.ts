import { mapErrorToUserFacingFailure } from "../application/errors/user-facing-error.js";
import { QvacLocalReportGenerator } from "../infrastructure/qvac/qvac-local-report-generator.js";
import { DEMO_PLAYER } from "../seed/demo-player.js";

const generator = new QvacLocalReportGenerator();

try {
  const report = await generator.generate(DEMO_PLAYER);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  const failure = mapErrorToUserFacingFailure(error);
  process.stderr.write(`${failure.code}: ${failure.message}\n`);
  process.exitCode = 1;
} finally {
  await generator.dispose();
}
