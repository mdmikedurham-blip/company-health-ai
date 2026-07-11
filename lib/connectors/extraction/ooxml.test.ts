import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractDocument, extractPdf, extractPptx, extractXlsx } from "./index";
import { readZipEntries } from "./formats/zip";

/** Build a store-compressed (method 0) ZIP for fixtures. */
function buildStoreZip(files: Record<string, string>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(8, 0, true); // store
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    chunks.push(local);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total =
    offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  for (const c of central) {
    out.set(c, o);
    o += c.length;
  }
  out.set(end, o);
  return out;
}

function buildDeflateZip(files: Record<string, string>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const raw = encoder.encode(content);
    const data = new Uint8Array(deflateRawSync(raw));
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(8, 8, true); // deflate
    view.setUint32(18, data.length, true);
    view.setUint32(22, raw.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    chunks.push(local);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  for (const c of central) {
    out.set(c, o);
    o += c.length;
  }
  out.set(end, o);
  return out;
}

describe("ZIP reader", () => {
  it("reads store and deflate entries", () => {
    const store = buildStoreZip({ "a.txt": "hello" });
    expect(readZipEntries(store)[0]?.name).toBe("a.txt");

    const deflated = buildDeflateZip({ "b.txt": "world" });
    const entries = readZipEntries(deflated);
    expect(new TextDecoder().decode(entries[0]!.data)).toBe("world");
  });
});

describe("XLSX extraction", () => {
  it("extracts worksheet names and cell values", () => {
    const bytes = buildStoreZip({
      "xl/workbook.xml":
        '<workbook><sheets><sheet name="Revenue" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels":
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/sharedStrings.xml":
        "<sst><si><t>ARR</t></si><si><t>1200000</t></si></sst>",
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData></worksheet>',
    });

    const doc = extractXlsx("finance.xlsx", bytes);
    expect(doc.metadata.format).toBe("XLSX");
    expect(doc.sections[0]?.title).toBe("Revenue");
    expect(doc.text).toContain("ARR");
    expect(doc.text).toContain("1200000");
    expect(doc.sections[0]?.metadata?.sheet).toBe("Revenue");
  });

  it("routes via extractDocument mime type", async () => {
    const bytes = buildStoreZip({
      "xl/workbook.xml":
        '<workbook><sheets><sheet name="S1" sheetId="1" r:id="rId1"/></sheets></workbook>',
      "xl/_rels/workbook.xml.rels":
        '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      "xl/sharedStrings.xml": "<sst><si><t>ok</t></si></sst>",
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row><c t="s"><v>0</v></c></row></sheetData></worksheet>',
    });
    const doc = await extractDocument({
      title: "a.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes,
    });
    expect(doc.metadata.format).toBe("XLSX");
  });

  it("fails malformed XLSX instead of returning empty", () => {
    expect(() => extractXlsx("bad.xlsx", new Uint8Array([1, 2, 3]))).toThrow(
      /malformed|empty/i,
    );
  });
});

describe("PPTX extraction", () => {
  it("extracts slide text, number, and speaker notes", () => {
    const bytes = buildStoreZip({
      "ppt/slides/slide1.xml":
        "<p:sld><a:t>Q2 Overview</a:t></p:sld>",
      "ppt/slides/slide2.xml":
        "<p:sld><a:t>Risks</a:t></p:sld>",
      "ppt/notesSlides/notesSlide1.xml":
        "<p:notes><a:t>Speak slowly</a:t></p:notes>",
    });

    const doc = extractPptx("deck.pptx", bytes);
    expect(doc.metadata.format).toBe("PPTX");
    expect(doc.metadata.slideCount).toBe(2);
    expect(doc.sections[0]?.title).toBe("Slide 1");
    expect(doc.sections[0]?.text).toContain("Q2 Overview");
    expect(doc.sections[0]?.text).toContain("Speak slowly");
    expect(doc.sections[0]?.metadata?.slide).toBe(1);
    expect(doc.sections[1]?.text).toContain("Risks");
  });
});

describe("PDF extraction failure", () => {
  it("fails when binary PDF yields no extractable text", async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    await expect(extractPdf("empty.pdf", garbage)).rejects.toThrow(
      /no extractable text|object streams|not a valid PDF|INVALID|PDF header/i,
    );
  });

  it("fails when printable runs are PDF object streams", async () => {
    const junk =
      "52 0 obj\n<< /Type /Catalog /Pages 1 0 R >>\nendobj\n53 0 obj\n<< /Length 4 >>stream\n\x00\x01\x02\x03\nendstream\nendobj\n";
    await expect(extractPdf("noise.pdf", junk)).rejects.toThrow(
      /object streams|not a valid PDF|INVALID/i,
    );
  });
});
