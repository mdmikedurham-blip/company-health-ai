/**
 * Company profile — static identity, DNA, and dimension metadata.
 * Scores and risks are NOT authored here; they come from runInsightEngine().
 */

import type {
  Company,
  CompanyDNA,
  HealthDimension,
  HealthScore,
  Report,
  TimelineEvent,
} from "@/lib/domain";

export const companyProfile: Company = {
  id: "company-acme",
  name: "Acme Corp",
  plan: "Executive",
  founded: "2019",
  stage: "Series B",
  employees: 84,
  arr: "$7.2M",
};

/** Prior period score — used to compute change vs current engine output. */
export const previousHealthScore: HealthScore = {
  score: 82,
  status: "watch",
  change: 0,
  changeLabel: "June baseline",
  lastUpdated: "Jun 1, 2026",
  confidence: 88,
};

/**
 * Dimension shells — owner / whyItMatters metadata only.
 * Scores, weights, confidence, and links are filled by the Insight Engine.
 */
const dimensionMeta: Pick<HealthDimension, "id" | "name" | "owner" | "whyItMatters">[] = [
  {
    id: "dim-financial",
    name: "Financial",
    owner: "CFO · Lisa Park",
    whyItMatters:
      "Financial health underpins investor confidence, fundraising readiness, and operational flexibility.",
  },
  {
    id: "dim-revenue-quality",
    name: "Revenue Quality",
    owner: "VP Revenue · James Wu",
    whyItMatters:
      "Revenue quality determines valuation multiples and predictability for board and investors.",
  },
  {
    id: "dim-customer",
    name: "Customer",
    owner: "VP Customer Success · Maria Santos",
    whyItMatters:
      "Customer health drives retention, expansion revenue, and resilience against churn shocks.",
  },
  {
    id: "dim-legal",
    name: "Legal",
    owner: "General Counsel · David Kim",
    whyItMatters: "Legal gaps create diligence risk during fundraising, M&A, and IP disputes.",
  },
  {
    id: "dim-governance",
    name: "Governance",
    owner: "CEO · Sarah Chen",
    whyItMatters:
      "Governance gaps block clean diligence and can delay fundraising or board approvals.",
  },
  {
    id: "dim-security",
    name: "Security",
    owner: "CTO · Alex Rivera",
    whyItMatters:
      "Security posture is a prerequisite for enterprise sales and institutional investment.",
  },
  {
    id: "dim-people",
    name: "People",
    owner: "VP People · Rachel Torres",
    whyItMatters: "People stability enables execution velocity and reduces key-person risk.",
  },
  {
    id: "dim-operations",
    name: "Operations",
    owner: "COO · Tom Bradley",
    whyItMatters: "Operational resilience prevents revenue disruption and supports scale.",
  },
  {
    id: "dim-product",
    name: "Product",
    owner: "VP Product · Nina Patel",
    whyItMatters:
      "Product velocity and quality drive retention, expansion, and competitive positioning.",
  },
  {
    id: "dim-ai-readiness",
    name: "AI Readiness",
    owner: "CTO · Alex Rivera",
    whyItMatters: "AI readiness affects product differentiation, compliance, and future valuation.",
  },
];

export const dimensionProfiles: HealthDimension[] = dimensionMeta.map((meta) => ({
  ...meta,
  score: 0,
  trend: { direction: "flat", value: 0 },
  status: "watch",
  confidence: 0,
  evidenceCount: 0,
  summary: "Awaiting evidence-backed assessment.",
  topDrivers: [],
  evidenceIds: [],
  findingIds: [],
  recommendedActions: [],
  estimatedScoreImprovement: 0,
}));

export const companyDNA: CompanyDNA = {
  mission:
    "Help mid-market companies operate with the rigor and visibility of Fortune 500 finance teams—without the headcount.",
  revenueModel:
    "SaaS subscription (88% recurring) + professional services (12%). ACV ranges $24K–$180K. Net revenue retention: 108%.",
  customerSegments: [
    "Mid-market B2B SaaS ($10M–$100M ARR)",
    "Growth-stage fintech",
    "PE-backed portfolio companies",
  ],
  products: [
    { name: "Health Dashboard", description: "Real-time company health scoring across 10 dimensions" },
    { name: "Company Doctor", description: "AI analyst with evidence-backed answers" },
    { name: "Evidence Explorer", description: "Searchable document intelligence layer" },
    { name: "Executive Brief", description: "Daily CEO briefing with board prep" },
  ],
  keySystems: [
    { name: "Google Drive", status: "connected", documents: 312 },
    { name: "Box", status: "connected", documents: 189 },
    { name: "QuickBooks", status: "connected", documents: 94 },
    { name: "Carta", status: "connected", documents: 47 },
    { name: "HubSpot", status: "connected", documents: 605 },
    { name: "BambooHR", status: "connected", documents: 45 },
  ],
  boardAndInvestors: [
    { name: "Sarah Chen", role: "CEO & Co-founder" },
    { name: "Michael Torres", role: "Board Chair · Partner, Horizon Ventures" },
    { name: "Dr. Emily Walsh", role: "Independent Director" },
    { name: "Horizon Ventures", role: "Series B Lead · $18M" },
    { name: "Cascade Capital", role: "Series A · $8M" },
  ],
  operatingModel:
    "Remote-first engineering (42), SF hub for GTM (28), distributed CS and ops (14). Quarterly board meetings. Monthly all-hands.",
  topRisks: [] as string[],
  keyMetrics: [
    { label: "ARR", value: "$7.2M", change: "+32% YoY" },
    { label: "Runway", value: "14.2 mo", change: "At current burn" },
    { label: "NRR", value: "108%", change: "+3 pts" },
    { label: "Employees", value: "84", change: "+6 Q2" },
    { label: "Gross Margin", value: "78%", change: "+2 pts" },
  ],
  upcomingDates: [
    { date: "Jul 15, 2026", event: "Governance cleanup report due", type: "Governance" },
    { date: "Jul 22, 2026", event: "Q3 Board meeting", type: "Board" },
    { date: "Aug 15, 2026", event: "SOC 2 Type I target date", type: "Security" },
    { date: "Aug 30, 2026", event: "Meridian Corp renewal", type: "Customer" },
    { date: "Sep 30, 2026", event: "Q3 financial close", type: "Financial" },
  ],
};

export const companyReports: Report[] = [
  { id: "rpt-1", title: "July Executive Brief", type: "board", generatedAt: "Jul 9, 6:42 AM", status: "ready" },
  { id: "rpt-2", title: "Q2 Health Assessment", type: "investor", generatedAt: "Jul 5, 9:00 AM", status: "ready" },
  { id: "rpt-3", title: "Governance Cleanup Status", type: "internal", generatedAt: "Jul 3, 2:30 PM", status: "draft" },
  { id: "rpt-4", title: "August Board Package", type: "board", generatedAt: "Scheduled Jul 20", status: "scheduled" },
];

export const companyBriefSeed = {
  boardMeeting: {
    date: "July 22, 2026",
    daysUntil: 13,
    items: [
      {
        title: "Q2 financial results & forecast",
        status: "ready" as const,
        detail: "P&L, cash flow, and ARR bridge prepared from QuickBooks and HubSpot.",
      },
      {
        title: "Missing board approvals",
        status: "needs-attention" as const,
        detail: "Option grants need retroactive board consent.",
      },
      {
        title: "Customer concentration",
        status: "ready" as const,
        detail: "Mid-market expansion pilot proposal ready for board discussion.",
      },
      {
        title: "Security readiness gaps",
        status: "pending" as const,
        detail: "Critical controls and MFA coverage under review.",
      },
    ],
  },
};

/** Seed timeline retained for historical context; engine appends live events. */
export const companyTimelineSeed: TimelineEvent[] = [
  {
    id: "tl-seed-1",
    companyId: "company-acme",
    date: "Jun 1, 2026",
    month: "June 2026",
    occurredAt: "2026-06-01T12:00:00.000Z",
    type: "overall-score-changed",
    title: "June health score: 82",
    summary: "Month-start health assessment prior to Insight Engine refresh.",
    description: "Month-start health assessment prior to Insight Engine refresh.",
    scoreAfter: 82,
    currentValue: 82,
    evidenceIds: [],
    findingIds: [],
    riskIds: [],
    rootEventId: "tl-seed-1",
    causalChainId: "chain-tl-seed-1",
    confidence: 88,
    metadata: { seed: true },
  },
  {
    id: "tl-seed-2",
    companyId: "company-acme",
    date: "May 22, 2026",
    month: "May 2026",
    occurredAt: "2026-05-22T12:00:00.000Z",
    type: "customer",
    title: "Meridian Corp renewal notice",
    summary: "Largest customer (24% ARR) renewal due in 90 days.",
    description: "Largest customer (24% ARR) renewal due in 90 days.",
    dimensionId: "dim-customer",
    dimension: "Customer",
    evidenceIds: [],
    findingIds: [],
    riskIds: [],
    rootEventId: "tl-seed-2",
    causalChainId: "chain-tl-seed-2",
    confidence: 70,
    metadata: { seed: true },
  },
  {
    id: "tl-seed-3",
    companyId: "company-acme",
    date: "May 10, 2026",
    month: "May 2026",
    occurredAt: "2026-05-10T12:00:00.000Z",
    type: "risk-resolved",
    title: "Prior litigation risk closed",
    summary: "Vendor dispute resolved. No active litigation remaining.",
    description: "Vendor dispute resolved. No active litigation remaining.",
    dimensionId: "dim-legal",
    dimension: "Legal",
    evidenceIds: [],
    findingIds: [],
    riskIds: [],
    rootEventId: "tl-seed-3",
    causalChainId: "chain-tl-seed-3",
    confidence: 90,
    metadata: { seed: true },
  },
];
