/**
 * Pipeline stage logger — timestamps + duration for every upload→snapshot stage.
 * Never logs file contents or secrets.
 */

import { logUploadProcessingEvent } from "./logging";

export type PipelineStageLogger = {
  stage: (
    stage: string,
    fields?: Record<string, string | number | boolean | undefined>,
  ) => void;
  timed: <T>(
    stage: string,
    fn: () => Promise<T>,
    fields?: Record<string, string | number | boolean | undefined>,
  ) => Promise<T>;
  elapsedMs: () => number;
};

export function createPipelineStageLogger(base: {
  documentId?: string;
  companyId: string;
  eventPrefix?: string;
}): PipelineStageLogger {
  const startedAt = Date.now();
  const eventPrefix = base.eventPrefix ?? "pipeline";

  const stage: PipelineStageLogger["stage"] = (stageName, fields = {}) => {
    logUploadProcessingEvent(`${eventPrefix}_stage`, {
      documentId: base.documentId,
      companyId: base.companyId,
      stage: stageName,
      elapsedMs: Date.now() - startedAt,
      ...fields,
    });
  };

  const timed: PipelineStageLogger["timed"] = async (
    stageName,
    fn,
    fields = {},
  ) => {
    const t0 = Date.now();
    stage(`${stageName}:start`, fields);
    try {
      const result = await fn();
      stage(`${stageName}:ok`, {
        ...fields,
        durationMs: Date.now() - t0,
        outcome: "ok",
      });
      return result;
    } catch (error) {
      stage(`${stageName}:fail`, {
        ...fields,
        durationMs: Date.now() - t0,
        outcome: "fail",
        errorMessage:
          error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  return {
    stage,
    timed,
    elapsedMs: () => Date.now() - startedAt,
  };
}
