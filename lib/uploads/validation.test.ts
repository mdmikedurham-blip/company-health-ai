import { describe, expect, it } from "vitest";
import {
  buildStoragePath,
  sanitizeUploadFilename,
  validateUploadRequest,
} from "./validation";
import { MAX_UPLOAD_BYTES } from "./constants";

describe("manual upload validation", () => {
  it("accepts supported document types", () => {
    const result = validateUploadRequest({
      filename: "Board Pack.pdf",
      mimeType: "application/pdf",
      byteSize: 1024,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filename).toBe("Board Pack.pdf");
      expect(result.mimeType).toBe("application/pdf");
    }
  });

  it("infers mime type from extension when browser sends octet-stream", () => {
    const result = validateUploadRequest({
      filename: "pipeline.xlsx",
      mimeType: "application/octet-stream",
      byteSize: 2048,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toContain("spreadsheetml");
    }
  });

  it("rejects unsupported types and oversized files", () => {
    expect(
      validateUploadRequest({
        filename: "photo.png",
        mimeType: "image/png",
        byteSize: 100,
      }).ok,
    ).toBe(false);
    expect(
      validateUploadRequest({
        filename: "huge.pdf",
        mimeType: "application/pdf",
        byteSize: MAX_UPLOAD_BYTES + 1,
      }).ok,
    ).toBe(false);
  });

  it("sanitizes filenames and builds tenant-scoped storage paths", () => {
    expect(sanitizeUploadFilename("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(
      buildStoragePath({
        companyId: "co-1",
        documentId: "doc-1",
        filename: "Q1 Report.docx",
      }),
    ).toBe("co-1/doc-1/Q1 Report.docx");
  });
});
