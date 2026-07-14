import { resolve } from "node:path";

import type { AppRole } from "../../domain/models/common.js";

export const resolveInstanceDataFile = (rootDirectory: string, role: AppRole): string =>
  resolve(rootDirectory, role, "scoutpass-data.json");
