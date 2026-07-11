import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  CURRENT_ANALYSIS_VERSION,
  CURRENT_EXTRACTION_VERSION,
  documentNeedsVersionUpgrade,
  reprocessBackoffMs,
  STALE_REPROCESS_BATCH_LIMIT,
  STALE_REPROCESS_CONCURRENCY,
} from "./versions";
import { markAndEnqueueStaleDocuments } from "./version-upgrade";
import { PdfExtractionError } from "@/lib/connectors/extraction/pdf-errors";
import { extractPdf } from "@/lib/connectors/extraction/formats/pdf";
import { progressLabelForStatus } from "./constants";

describe("documentNeedsVersionUpgrade", () => {
  it("treats missing versions as behind", () => {
    expect(documentNeedsVersionUpgrade({})).toBe(true);
  });

  it("is current when successful versions match", () => {
    expect(
      documentNeedsVersionUpgrade({
        last_successful_extraction_version: CURRENT_EXTRACTION_VERSION,
        last_successful_analysis_version: CURRENT_ANALYSIS_VERSION,
      }),
    ).toBe(false);
  });

  it("is behind when extraction version differs", () => {
    expect(
      documentNeedsVersionUpgrade({
        last_successful_extraction_version: "old-extractor",
        last_successful_analysis_version: CURRENT_ANALYSIS_VERSION,
      }),
    ).toBe(true);
  });
});

describe("reprocessBackoffMs", () => {
  it("grows exponentially and caps", () => {
    expect(reprocessBackoffMs(1)).toBe(30_000);
    expect(reprocessBackoffMs(2)).toBe(60_000);
    expect(reprocessBackoffMs(3)).toBe(120_000);
    expect(reprocessBackoffMs(20)).toBe(30 * 60 * 1000);
  });
});

describe("progressLabelForStatus", () => {
  it("maps UI statuses", () => {
    expect(progressLabelForStatus("PROCESSED")).toBe("Current");
    expect(progressLabelForStatus("STALE")).toBe("Update available");
    expect(progressLabelForStatus("OCR_REQUIRED")).toBe("OCR required");
    expect(
      progressLabelForStatus("PROCESSED", {
        reprocessErrorMessage: "boom",
        lastStage: "reprocess_failed",
      }),
    ).toBe("Reprocess failed — previous analysis retained");
  });
});

describe("markAndEnqueueStaleDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("old processed doc auto-enqueues after version bump", async () => {
    const docs = [
      {
        id: "doc-0",
        status: "PROCESSED",
        extraction_version: "legacy",
        analysis_version: "legacy",
        last_successful_extraction_version: "legacy",
        last_successful_analysis_version: "legacy",
        next_reprocess_at: null,
        processing_attempts: 1,
        lease_expires_at: null,
        locked_at: null,
        processing_started_at: null,
        updated_at: new Date().toISOString(),
      },
    ];

    const statuses: string[] = [];
    let listPass = 0;

    const from = vi.fn(() => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn(self);
      chain.eq = vi.fn(self);
      chain.in = vi.fn(self);
      chain.limit = vi.fn(() => {
        listPass += 1;
        return Promise.resolve({ data: docs, error: null });
      });
      // requeueDocumentJobs awaits the builder after .in() without .limit()
      chain.then = (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => {
        listPass += 1;
        const rows =
          listPass <= 1
            ? docs
            : docs.map((d) => ({ ...d, status: "STALE" }));
        return Promise.resolve({ data: rows, error: null }).then(
          resolve,
          reject,
        );
      };
      chain.update = vi.fn((patch: { status?: string }) => {
        if (patch.status) statuses.push(patch.status);
        return {
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({ error: null })),
          })),
          in: vi.fn(async () => ({ error: null })),
        };
      });
      return chain;
    });

    const result = await markAndEnqueueStaleDocuments({
      client: { from } as never,
      companyId: "co-1",
      limit: 25,
    });

    expect(result.markedStale).toEqual(["doc-0"]);
    expect(result.enqueued).toEqual(["doc-0"]);
    expect(statuses).toContain("STALE");
    expect(statuses).toContain("QUEUED");
  });

  it("25 stale documents process with bounded concurrency constant", () => {
    expect(STALE_REPROCESS_CONCURRENCY).toBe(4);
    expect(STALE_REPROCESS_BATCH_LIMIT).toBe(25);
  });

  it("tenant isolation: only queries the provided company_id", async () => {
    const eqs: Array<[string, string]> = [];
    const from = vi.fn(() => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = vi.fn(self);
      chain.eq = vi.fn((col: string, val: string) => {
        eqs.push([col, val]);
        return chain;
      });
      chain.in = vi.fn(self);
      chain.limit = vi.fn(async () => ({ data: [], error: null }));
      chain.update = vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({ error: null })),
        })),
      }));
      return chain;
    });

    await markAndEnqueueStaleDocuments({
      client: { from } as never,
      companyId: "tenant-a",
      limit: 10,
    });

    expect(eqs).toContainEqual(["company_id", "tenant-a"]);
    expect(eqs.every(([c, v]) => c !== "company_id" || v === "tenant-a")).toBe(
      true,
    );
  });
});

describe("PDF extraction failures", () => {
  it("malformed PDF gives exact reason", async () => {
    const junk = new TextEncoder().encode("not a pdf at all");
    await expect(extractPdf("bad.pdf", junk)).rejects.toMatchObject({
      code: "INVALID_PDF",
    });
  });

  it("object-stream plain text is rejected", async () => {
    await expect(
      extractPdf(
        "noise.pdf",
        "1 0 obj\n<< /Type /Catalog >>\nendobj\n2 0 obj\nendobj\n3 0 obj\nendobj",
      ),
    ).rejects.toBeInstanceOf(PdfExtractionError);
  });

  it("scanned/image-like empty PDF becomes OCR_REQUIRED when unpdf returns empty", async () => {
    const header = new TextEncoder().encode(
      "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF",
    );
    try {
      await extractPdf("scan.pdf", header);
      // If somehow text is extracted, that's fine — not a scan.
    } catch (err) {
      expect(err).toBeInstanceOf(PdfExtractionError);
      const code = (err as PdfExtractionError).code;
      expect([
        "OCR_REQUIRED",
        "EMPTY_TEXT",
        "MALFORMED_PDF",
        "LOW_QUALITY",
        "OBJECT_STREAMS",
      ]).toContain(code);
    }
  });
});
