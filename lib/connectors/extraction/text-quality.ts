/**
 * Detect PDF object-stream / binary junk that must never be treated as evidence text.
 */

export function looksLikeBinaryOrPdfJunk(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, 4000);
  if (/%PDF-|endobj|startxref|\/Type\s*\/|stream\s*$/m.test(sample)) return true;
  if (/[\x00-\x08\x0E-\x1F]/.test(sample)) return true;
  // High ratio of non-printable / high-bit noise
  let weird = 0;
  const n = Math.min(sample.length, 800);
  for (let i = 0; i < n; i++) {
    const c = sample.charCodeAt(i);
    if (c < 9 || (c > 13 && c < 32) || c === 127) weird++;
  }
  if (n > 0 && weird / n > 0.08) return true;

  // Structural PDF tokens dominating the sample
  const objHits = (sample.match(/\b\d+\s+\d+\s+obj\b/g) ?? []).length;
  const endobjHits = (sample.match(/\bendobj\b/g) ?? []).length;
  if (objHits + endobjHits >= 3) return true;

  return false;
}

/** Fraction of lines that look like PDF syntax rather than prose. */
export function pdfSyntaxLineRatio(text: string): number {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return 1;
  let bad = 0;
  for (const line of lines) {
    if (
      /^(?:\d+\s+\d+\s+obj|endobj|endstream|stream|xref|trailer|startxref|%%EOF)\b/i.test(
        line,
      ) ||
      /^\/[A-Za-z]+\s/.test(line) ||
      /^<<|>>$/.test(line)
    ) {
      bad++;
    }
  }
  return bad / lines.length;
}

export function isLowQualityPdfText(text: string): boolean {
  if (!text.trim()) return true;
  if (looksLikeBinaryOrPdfJunk(text)) return true;
  const syntaxRatio = pdfSyntaxLineRatio(text);
  if (syntaxRatio > 0.35) return true;

  // Short extracts are only rejected when they still look structural after cleanup.
  const prose = text
    .replace(/\b\d+\s+\d+\s+obj\b/gi, " ")
    .replace(/\bendobj\b/gi, " ")
    .replace(/\bendstream\b/gi, " ")
    .replace(/\bstream\b/gi, " ")
    .replace(/[^\x20-\x7E\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (prose.length < 12) return true;
  if (prose.length < 40 && syntaxRatio > 0.15) return true;
  return false;
}
