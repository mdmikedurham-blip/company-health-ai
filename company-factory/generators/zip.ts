/**
 * Shared store-compressed ZIP builder for minimal XLSX fixtures.
 */

export function buildStoreZip(files: Record<string, string>): Uint8Array {
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
    view.setUint16(8, 0, true);
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

/** Label/value sheet as shared-string XLSX (extractor-friendly). */
export function buildLabelValueXlsx(
  sheetName: string,
  rows: Array<[string, string]>,
): Uint8Array {
  const shared: string[] = [];
  const index = (s: string) => {
    shared.push(s);
    return shared.length - 1;
  };

  const pairs = rows.map(([a, b]) => [index(a), index(b)] as const);
  const sst = `<sst>${shared.map((t) => `<si><t>${escapeXml(t)}</t></si>`).join("")}</sst>`;
  const sheetData = pairs
    .map(
      ([a, b], i) =>
        `<row r="${i + 1}"><c r="A${i + 1}" t="s"><v>${a}</v></c><c r="B${i + 1}" t="s"><v>${b}</v></c></row>`,
    )
    .join("");

  const safeName = escapeXml(sheetName);
  return buildStoreZip({
    "xl/workbook.xml": `<workbook><sheets><sheet name="${safeName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": sst,
    "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${sheetData}</sheetData></worksheet>`,
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
