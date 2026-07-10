import { inflateRawSync } from "node:zlib";

export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

/**
 * Minimal ZIP local-file reader supporting store (0) and deflate (8).
 * Sufficient for OOXML (DOCX/XLSX/PPTX) without external deps.
 */
export function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    if (
      bytes[offset] !== 0x50 ||
      bytes[offset + 1] !== 0x4b ||
      bytes[offset + 2] !== 0x03 ||
      bytes[offset + 3] !== 0x04
    ) {
      break;
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 30);
    const flags = view.getUint16(6, true);
    const compression = view.getUint16(8, true);
    let compSize = view.getUint32(18, true);
    const nameLen = view.getUint16(26, true);
    const extraLen = view.getUint16(28, true);
    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > bytes.length) break;

    const name = new TextDecoder("utf-8", { fatal: false }).decode(
      bytes.subarray(nameStart, nameEnd),
    );
    const dataStart = nameEnd + extraLen;
    let dataEnd = dataStart + compSize;

    // Data descriptor (bit 3): sizes follow the compressed data — uncommon for OOXML.
    if ((flags & 0x08) !== 0 && compSize === 0) {
      const descriptor = findDataDescriptor(bytes, dataStart);
      if (!descriptor) break;
      compSize = descriptor.compSize;
      dataEnd = dataStart + compSize;
      const next = descriptor.descriptorEnd;
      const compressed = bytes.subarray(dataStart, dataEnd);
      const data = inflateEntry(compressed, compression);
      if (data && !name.endsWith("/")) {
        entries.push({ name, data });
      }
      offset = next;
      continue;
    }

    if (dataEnd > bytes.length) break;
    const compressed = bytes.subarray(dataStart, dataEnd);
    const data = inflateEntry(compressed, compression);
    if (data && !name.endsWith("/")) {
      entries.push({ name, data });
    }
    offset = dataEnd;
  }

  return entries;
}

export function zipEntryText(
  entries: ZipEntry[],
  path: string,
): string | null {
  const entry = entries.find((e) => e.name === path);
  if (!entry) return null;
  return new TextDecoder("utf-8", { fatal: false }).decode(entry.data);
}

export function zipEntriesMatching(
  entries: ZipEntry[],
  pattern: RegExp,
): ZipEntry[] {
  return entries
    .filter((e) => pattern.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

function inflateEntry(
  compressed: Uint8Array,
  compression: number,
): Uint8Array | null {
  if (compression === 0) return compressed;
  if (compression === 8) {
    try {
      return new Uint8Array(inflateRawSync(compressed));
    } catch {
      return null;
    }
  }
  return null;
}

function findDataDescriptor(
  bytes: Uint8Array,
  dataStart: number,
): { compSize: number; descriptorEnd: number } | null {
  // Signature PK\x07\x08 optional; then crc32, comp, uncomp
  for (let i = dataStart; i + 16 <= bytes.length; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x07 &&
      bytes[i + 3] === 0x08
    ) {
      const view = new DataView(bytes.buffer, bytes.byteOffset + i, 16);
      return {
        compSize: view.getUint32(8, true),
        descriptorEnd: i + 16,
      };
    }
  }
  return null;
}
