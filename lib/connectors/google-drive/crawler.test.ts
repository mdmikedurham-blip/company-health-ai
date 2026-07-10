import { describe, expect, it, vi, afterEach } from "vitest";
import { crawlGoogleDrive } from "./crawler";

describe("crawlGoogleDrive", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps Drive files into RawConnectorItem[]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
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
            },
          ],
        }),
      }),
    );

    const items = await crawlGoogleDrive("access-token");
    expect(items).toHaveLength(1);
    expect(items[0]?.externalId).toBe("file-1");
    expect(items[0]?.title).toBe("Board minutes.pdf");
    expect(items[0]?.metadata?.evidenceId).toBe("gdrive-file-1");
    expect(items[0]?.metadata?.sourceSystem).toBe("Google Drive");
  });
});
