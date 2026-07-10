import { describe, expect, it, vi, afterEach } from "vitest";
import { GOOGLE_DRIVE_SUPPORTED_MIME_TYPES } from "./constants";
import { crawlGoogleDrive } from "./crawler";

describe("crawlGoogleDrive", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Drive files into RawConnectorItem[]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [
          {
            id: "file-1",
            name: "Board minutes.pdf",
            mimeType: "application/pdf",
            modifiedTime: "2026-05-22T12:00:00.000Z",
            webViewLink: "https://drive.google.com/file/d/file-1",
            owners: [{ emailAddress: "ceo@acme.test" }],
            parents: ["folder-board"],
            md5Checksum: "abc123def456",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const items = await crawlGoogleDrive("access-token");
    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("file-1");
    expect(items[0]?.title).toBe("Board minutes.pdf");
    expect(items[0]?.path).toBe("folder-board/Board minutes.pdf");
    expect(items[0]?.modifiedAt).toBe("2026-05-22T12:00:00.000Z");
    expect(items[0]?.owner).toBe("ceo@acme.test");
    expect(items[0]?.mimeType).toBe("application/pdf");
    expect(items[0]?.contentHash).toBe("md5:abc123def456");
    expect(items[0]?.metadata?.evidenceId).toBe("gdrive-file-1");
    expect(items[0]?.metadata?.sourceSystem).toBe("Google Drive");

    const url = String(fetchMock.mock.calls[0]?.[0]);
    const q = new URL(url).searchParams.get("q") ?? "";
    for (const mime of GOOGLE_DRIVE_SUPPORTED_MIME_TYPES) {
      expect(q).toContain(`mimeType = '${mime}'`);
    }
  });

  it("allows overriding mimeTypes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await crawlGoogleDrive("access-token", {
      mimeTypes: ["text/csv"],
    });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    const q = new URL(url).searchParams.get("q") ?? "";
    expect(q).toContain("mimeType = 'text/csv'");
    expect(q).not.toContain("application/pdf");
  });
});
