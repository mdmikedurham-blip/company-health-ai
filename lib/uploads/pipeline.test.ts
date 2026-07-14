import { describe, expect, it } from "vitest";
import { progressLabelForStatus } from "./constants";
import {
  PIPELINE_STEPS,
  categorizePipelineError,
  nextPipelineStep,
  pipelineUiStateFromDocument,
  resumePipelineStep,
  shouldSkipPipelineStep,
} from "./pipeline";

describe("document processing pipeline", () => {
  it("defines the full ordered pipeline", () => {
    expect(PIPELINE_STEPS).toEqual([
      "upload",
      "storage",
      "text_extraction",
      "ocr",
      "classification",
      "structured_fact_extraction",
      "finding_generation",
      "company_assessment_update",
      "complete",
    ]);
  });

  it("resumes from the failed step only", () => {
    expect(
      resumePipelineStep({
        failedStep: "structured_fact_extraction",
        lastSuccessfulStep: "classification",
      }),
    ).toBe("structured_fact_extraction");
    expect(
      resumePipelineStep({
        failedStep: null,
        lastSuccessfulStep: "storage",
      }),
    ).toBe("text_extraction");
  });

  it("skips steps at or before last success", () => {
    expect(shouldSkipPipelineStep("storage", "classification")).toBe(true);
    expect(shouldSkipPipelineStep("finding_generation", "classification")).toBe(
      false,
    );
  });

  it("categorizes retryable failures", () => {
    expect(
      categorizePipelineError("storage_download timed out", "text_extraction"),
    ).toEqual({ category: "timeout", retryable: true });
    expect(categorizePipelineError("download failed", "storage")).toEqual({
      category: "storage",
      retryable: true,
    });
    expect(
      categorizePipelineError("cancelled_by_user", "text_extraction"),
    ).toEqual({ category: "cancelled", retryable: false });
  });

  it("surfaces pipeline step labels instead of opaque PROCESSING/ANALYZING", () => {
    expect(
      progressLabelForStatus("PROCESSING", { pipelineStep: "text_extraction" }),
    ).toBe("Text extraction");
    expect(
      progressLabelForStatus("ANALYZING", {
        pipelineStep: "company_assessment_update",
      }),
    ).toBe("Company assessment update");
    expect(
      progressLabelForStatus("FAILED", {
        failedStep: "structured_fact_extraction",
      }),
    ).toBe("Failed at Structured fact extraction");
  });

  it("explains why a step is waiting", () => {
    const ui = pipelineUiStateFromDocument({
      status: "EXTRACTED",
      pipeline_step: "finding_generation",
    });
    expect(ui.label).toBe("Finding generation");
    expect(ui.waitingReason).toMatch(/findings/i);
  });

  it("advances next step after last success", () => {
    expect(nextPipelineStep("ocr")).toBe("classification");
    expect(nextPipelineStep("complete")).toBe("complete");
  });
});
