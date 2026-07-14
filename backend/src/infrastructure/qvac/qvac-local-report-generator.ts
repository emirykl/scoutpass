/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { completion, loadModel, unloadModel, type CompletionRun } from "@qvac/sdk";
import * as QvacSdk from "@qvac/sdk";

import type {
  LocalReportGenerator,
  IntegrationStatus
} from "../../application/ports/integrations.js";
import type { PlayerProfile } from "../../domain/models/player-profile.js";
import type { ScoutReport } from "../../domain/models/scout-report.js";
import {
  InvalidScoutReportOutputError,
  normalizeGeneratedReportMetadata,
  parseScoutReportJson,
  SCOUT_REPORT_JSON_SCHEMA
} from "./scout-report-json.js";
import { buildScoutReportPrompt } from "./scout-report-prompt.js";

export interface QvacLocalReportGeneratorOptions {
  readonly modelSrc?: unknown;
  readonly modelLabel?: string;
  readonly now?: () => Date;
}

export class QvacModelLoadError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QvacModelLoadError";
  }
}

export class QvacLocalReportGenerator implements LocalReportGenerator {
  #status: IntegrationStatus = "not_initialized";
  #modelId: string | undefined;
  readonly #modelSrc: unknown;
  readonly #modelLabel: string;
  readonly #now: () => Date;

  public constructor(options: QvacLocalReportGeneratorOptions = {}) {
    this.#modelSrc = options.modelSrc ?? getQvacRegistryModel("QWEN3_600M_INST_Q4");
    this.#modelLabel = options.modelLabel ?? "QVAC QWEN3_600M_INST_Q4";
    this.#now = options.now ?? (() => new Date());
  }

  public getStatus(): Promise<IntegrationStatus> {
    return Promise.resolve(this.#status);
  }

  public async generate(player: PlayerProfile): Promise<ScoutReport> {
    const modelId = await this.#ensureModelLoaded();
    const prompt = buildScoutReportPrompt(player);
    let lastInvalidOutput: InvalidScoutReportOutputError | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const rawText = await this.#runCompletion(modelId, prompt);
      try {
        return normalizeGeneratedReportMetadata(
          parseScoutReportJson(rawText),
          `${this.#modelLabel} (${modelId})`,
          this.#now()
        );
      } catch (error) {
        if (!(error instanceof InvalidScoutReportOutputError)) {
          throw error;
        }
        lastInvalidOutput = error;
      }
    }

    throw new InvalidScoutReportOutputError(
      "QVAC returned invalid structured output after one retry.",
      { cause: lastInvalidOutput }
    );
  }

  public async dispose(): Promise<void> {
    if (this.#modelId !== undefined) {
      await unloadModel({ modelId: this.#modelId });
    }
    this.#modelId = undefined;
    this.#status = "not_initialized";
  }

  async #ensureModelLoaded(): Promise<string> {
    if (this.#modelId !== undefined) {
      return this.#modelId;
    }

    this.#status = "loading";
    try {
      const modelId = await loadModel({
        modelSrc: this.#modelSrc
      } as Parameters<typeof loadModel>[0]);
      this.#modelId = modelId;
      this.#status = "ready";
      return modelId;
    } catch (error) {
      this.#status = "error";
      throw new QvacModelLoadError(
        "QVAC model could not be loaded. Install the local model and retry.",
        { cause: error }
      );
    }
  }

  async #runCompletion(modelId: string, prompt: string): Promise<string> {
    const run: CompletionRun = completion({
      modelId,
      history: [
        {
          role: "user",
          content: prompt
        }
      ],
      stream: true,
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "ScoutReport",
          schema: SCOUT_REPORT_JSON_SCHEMA
        }
      }
    });

    for await (const event of run.events) {
      void event;
      // Drain the stream so QVAC can resolve the canonical final response.
    }

    const final = await run.final;
    return final.contentText;
  }
}

const getQvacRegistryModel = (name: string): unknown => {
  const registry = QvacSdk as Record<string, unknown>;
  const model = registry[name];
  if (typeof model !== "object" || model === null) {
    throw new QvacModelLoadError(`QVAC registry model was not available: ${name}.`);
  }
  return model;
};
