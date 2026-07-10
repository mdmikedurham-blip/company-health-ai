/**
 * Intermediate document shape produced by format extractors.
 * Every supported file type (PDF, DOCX, Docs, Sheets, Slides, TXT, MD, CSV)
 * normalizes into this before Evidence creation.
 */

export interface DocumentSection {
  id: string;
  title?: string;
  text: string;
  order: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ExtractedDocument {
  text: string;
  title: string;
  metadata: Record<string, string | number | boolean | null>;
  sections: DocumentSection[];
}

export type ExtractableMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.google-apps.document"
  | "application/vnd.google-apps.spreadsheet"
  | "application/vnd.google-apps.presentation"
  | "text/plain"
  | "text/markdown"
  | "text/csv";

export interface ExtractDocumentInput {
  title: string;
  mimeType: string;
  /** Decoded text when already available (exports, plain files). */
  text?: string;
  /** Raw bytes for binary formats (PDF, DOCX) or undecoded downloads. */
  bytes?: Uint8Array;
  /** Inventory / provenance fields merged into metadata. */
  sourceMetadata?: Record<string, string | number | boolean | null>;
}
