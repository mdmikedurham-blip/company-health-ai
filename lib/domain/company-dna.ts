import type { ConnectorStatus } from "./primitives";

export interface CompanyProduct {
  name: string;
  description: string;
}

export interface ConnectedSystem {
  name: string;
  status: ConnectorStatus;
  documents: number;
}

export interface BoardMember {
  name: string;
  role: string;
}

export interface KeyMetric {
  label: string;
  value: string;
  change?: string;
}

export interface UpcomingDate {
  date: string;
  event: string;
  type: string;
}

export interface CompanyDNA {
  mission: string;
  revenueModel: string;
  customerSegments: string[];
  products: CompanyProduct[];
  keySystems: ConnectedSystem[];
  boardAndInvestors: BoardMember[];
  operatingModel: string;
  topRisks: string[];
  keyMetrics: KeyMetric[];
  upcomingDates: UpcomingDate[];
}
