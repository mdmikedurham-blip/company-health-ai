import type { ReportId, ReportStatus, ReportType } from "./primitives";

export interface Report {
  id: ReportId;
  title: string;
  type: ReportType;
  generatedAt: string;
  status: ReportStatus;
}
