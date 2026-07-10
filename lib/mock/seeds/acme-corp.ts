/**
 * Canonical seed data for Acme Corp.
 * Raw connector output + company config — downstream entities are engine-computed.
 */
import type {
  Company,
  CompanyDNA,
  CompanyHealthSnapshot,
  ExecutiveBrief,
  HealthDimension,
  HealthScore,
  Report,
  ScoreChangeExplanation,
  TimelineEvent,
} from "@/lib/domain";
import { acmeInsightRules } from "@/lib/engine/rules/acme";
import { acmeConnectors, buildCompanyHealthSnapshot } from "@/lib/connectors";
import type { PlatformInput } from "@/lib/connectors";

// ─── Company & score ─────────────────────────────────────────────────────────

export const acmeCompany: Company = {
  id: "company-acme",
  name: "Acme Corp",
  plan: "Executive",
  founded: "2019",
  stage: "Series B",
  employees: 84,
  arr: "$7.2M",
};

export const acmeHealthScore: HealthScore = {
  score: 87,
  status: "healthy",
  change: 5,
  changeLabel: "+5 this month",
  lastUpdated: "Updated 6 minutes ago",
  confidence: 96,
};

// ─── Health dimension profiles (engine wires evidence/finding links) ─────────

export const acmeDimensions: HealthDimension[] = [
  {
    id: "dim-financial",
    name: "Financial",
    score: 92,
    trend: { direction: "up", value: 4 },
    status: "healthy",
    confidence: 98,
    evidenceCount: 94,
    owner: "CFO · Lisa Park",
    summary: "Strong cash position, clean Q2 close, burn well-managed at 14.2 months runway.",
    topDrivers: ["Q2 close 3 days early", "Cash $3.4M", "Burn rate stable"],
    evidenceIds: ["ev-revenue-recon"],
    findingIds: ["finding-q2-close"],
    recommendedActions: ["Maintain monthly reconciliation cadence", "Update Q3 forecast by July 15"],
    whyItMatters: "Financial health underpins investor confidence, fundraising readiness, and operational flexibility.",
    estimatedScoreImprovement: 2,
  },
  {
    id: "dim-revenue-quality",
    name: "Revenue Quality",
    score: 88,
    trend: { direction: "up", value: 2 },
    status: "healthy",
    confidence: 93,
    evidenceCount: 156,
    owner: "VP Revenue · James Wu",
    summary: "88% recurring revenue, NRR at 108%, improving cohort retention in mid-market segment.",
    topDrivers: ["NRR 108%", "88% recurring", "Expansion revenue growing"],
    evidenceIds: ["ev-arr-cohort", "ev-revenue-recon"],
    findingIds: ["finding-concentration", "finding-q2-close"],
    recommendedActions: ["Accelerate mid-market expansion pilot", "Reduce one-time services mix"],
    whyItMatters: "Revenue quality determines valuation multiples and predictability for board and investors.",
    estimatedScoreImprovement: 3,
  },
  {
    id: "dim-customer",
    name: "Customer",
    score: 84,
    trend: { direction: "flat", value: 0 },
    status: "healthy",
    confidence: 94,
    evidenceCount: 312,
    owner: "VP Customer Success · Maria Santos",
    summary: "Strong NPS (48) but customer concentration risk elevated—top 3 at 58% ARR.",
    topDrivers: ["NPS 48", "Top-3 concentration 58%", "Meridian renewal in 90 days"],
    evidenceIds: ["ev-arr-cohort"],
    findingIds: ["finding-concentration"],
    recommendedActions: ["Launch mid-market diversification pilot", "Prepare Meridian renewal strategy"],
    whyItMatters: "Customer health drives retention, expansion revenue, and resilience against churn shocks.",
    estimatedScoreImprovement: 4,
  },
  {
    id: "dim-legal",
    name: "Legal",
    score: 86,
    trend: { direction: "up", value: 1 },
    status: "healthy",
    confidence: 91,
    evidenceCount: 189,
    owner: "General Counsel · David Kim",
    summary: "Clean IP portfolio but 4 contractor agreements missing IP assignment clauses.",
    topDrivers: ["No active litigation", "4 IP gaps in contractors", "Patents filed"],
    evidenceIds: ["ev-legal-audit"],
    findingIds: ["finding-ip-gap"],
    recommendedActions: ["Execute IP assignment amendments for 4 contractors"],
    whyItMatters: "Legal gaps create diligence risk during fundraising, M&A, and IP disputes.",
    estimatedScoreImprovement: 3,
  },
  {
    id: "dim-governance",
    name: "Governance",
    score: 71,
    trend: { direction: "down", value: 2 },
    status: "watch",
    confidence: 93,
    evidenceCount: 89,
    owner: "CEO · Sarah Chen",
    summary: "Board structure solid but 3 option grants missing consent documentation. Primary score drag.",
    topDrivers: ["3 missing board consents", "Board minutes current", "Cap table clean"],
    evidenceIds: ["ev-equity-grants", "ev-board-minutes"],
    findingIds: ["finding-consent-gap", "finding-board-action"],
    recommendedActions: ["File retroactive board consents by July 15", "Update governance checklist"],
    whyItMatters: "Governance gaps block clean diligence and can delay fundraising or board approvals.",
    estimatedScoreImprovement: 6,
  },
  {
    id: "dim-security",
    name: "Security",
    score: 79,
    trend: { direction: "up", value: 3 },
    status: "watch",
    confidence: 92,
    evidenceCount: 67,
    owner: "CTO · Alex Rivera",
    summary: "SOC 2 Type I on track for August. 3 of 5 observation windows still open.",
    topDrivers: ["SOC 2 controls passed review", "3 observation windows open", "No breaches"],
    evidenceIds: ["ev-soc2-review"],
    findingIds: ["finding-soc2-pass"],
    recommendedActions: ["Complete remaining observation windows by August 15"],
    whyItMatters: "Security posture is a prerequisite for enterprise sales and institutional investment.",
    estimatedScoreImprovement: 4,
  },
  {
    id: "dim-people",
    name: "People",
    score: 91,
    trend: { direction: "up", value: 3 },
    status: "healthy",
    confidence: 90,
    evidenceCount: 45,
    owner: "VP People · Rachel Torres",
    summary: "Zero voluntary attrition in Q2. Key engineering and GTM roles fully staffed.",
    topDrivers: ["0% voluntary attrition Q2", "84 employees", "Eng fully staffed"],
    evidenceIds: [],
    findingIds: [],
    recommendedActions: ["Continue quarterly engagement surveys", "Plan Q3 hiring against budget"],
    whyItMatters: "People stability enables execution velocity and reduces key-person risk.",
    estimatedScoreImprovement: 1,
  },
  {
    id: "dim-operations",
    name: "Operations",
    score: 83,
    trend: { direction: "flat", value: 0 },
    status: "healthy",
    confidence: 87,
    evidenceCount: 52,
    owner: "COO · Tom Bradley",
    summary: "SLAs met 97% of the time. Two vendor dependencies flagged for contingency planning.",
    topDrivers: ["97% SLA compliance", "2 vendor dependencies", "Process docs current"],
    evidenceIds: [],
    findingIds: [],
    recommendedActions: ["Document contingency plans for critical vendors"],
    whyItMatters: "Operational resilience prevents revenue disruption and supports scale.",
    estimatedScoreImprovement: 3,
  },
  {
    id: "dim-product",
    name: "Product",
    score: 85,
    trend: { direction: "up", value: 2 },
    status: "healthy",
    confidence: 85,
    evidenceCount: 38,
    owner: "VP Product · Nina Patel",
    summary: "Q3 roadmap on track. AI copilot beta launching August. Feature velocity above benchmark.",
    topDrivers: ["Roadmap on track", "AI copilot beta Aug", "NPS driver: ease of use"],
    evidenceIds: ["ev-product-roadmap"],
    findingIds: ["finding-product-velocity"],
    recommendedActions: ["Ship AI copilot beta on schedule", "Close feedback loop on top 3 feature requests"],
    whyItMatters: "Product velocity and quality drive retention, expansion, and competitive positioning.",
    estimatedScoreImprovement: 3,
  },
  {
    id: "dim-ai-readiness",
    name: "AI Readiness",
    score: 74,
    trend: { direction: "up", value: 5 },
    status: "watch",
    confidence: 78,
    evidenceCount: 12,
    owner: "CTO · Alex Rivera",
    summary: "Data infrastructure ready. Model governance policies drafted but awaiting board approval.",
    topDrivers: ["Data infra ready", "Governance policies draft", "AI copilot in development"],
    evidenceIds: ["ev-ai-readiness"],
    findingIds: ["finding-ai-governance"],
    recommendedActions: ["Get AI governance policies approved at July 22 board meeting"],
    whyItMatters: "AI readiness affects product differentiation, compliance, and future valuation.",
    estimatedScoreImprovement: 5,
  },
];

// ─── Score change & timeline ─────────────────────────────────────────────────

export const acmeScoreChange: ScoreChangeExplanation = {
  previousScore: 82,
  currentScore: 87,
  change: 5,
  period: "June → July 2026",
  summary:
    "Health improved 5 points driven by financial close completion, people retention, and security progress. Governance decline partially offset gains.",
  drivers: [
    { dimension: "Financial", impact: 4, reason: "Q2 close completed 3 days early with 98% confidence" },
    { dimension: "People", impact: 3, reason: "Zero voluntary attrition in Q2" },
    { dimension: "Security", impact: 3, reason: "SOC 2 controls passed internal review" },
    { dimension: "AI Readiness", impact: 5, reason: "Data infrastructure assessment completed" },
    { dimension: "Governance", impact: -2, reason: "3 option grants flagged missing board consent" },
  ],
};

export const acmeTimeline: TimelineEvent[] = [
  {
    id: "tl-1",
    date: "Jul 9, 2026",
    month: "July 2026",
    type: "score-change",
    title: "Health score reaches 87",
    description: "Overall company health improved to 87 (+5 from June).",
    scoreBefore: 82,
    scoreAfter: 87,
    whyHealthChanged: "Financial close, people retention, and security gains outweighed governance decline.",
  },
  {
    id: "tl-2",
    date: "Jul 8, 2026",
    month: "July 2026",
    type: "evidence-added",
    title: "ARR cohort analysis synced",
    description: "HubSpot ARR cohort analysis added — flagged customer concentration at 58%.",
    dimensionId: "dim-customer",
    dimension: "Customer",
  },
  {
    id: "tl-3",
    date: "Jul 7, 2026",
    month: "July 2026",
    type: "risk-created",
    title: "Customer concentration risk elevated",
    description: "Top-3 ARR share rose from 54% to 58% in Q2 analysis.",
    dimensionId: "dim-customer",
    dimension: "Customer",
    whyHealthChanged: "Concentration crossed 50% investor threshold, triggering high-severity risk flag.",
  },
  {
    id: "tl-4",
    date: "Jul 5, 2026",
    month: "July 2026",
    type: "financial",
    title: "Q2 financial close completed",
    description: "Revenue reconciliation finished 3 days ahead of schedule. Financial score up to 92.",
    dimensionId: "dim-financial",
    dimension: "Financial",
    scoreBefore: 88,
    scoreAfter: 92,
    whyHealthChanged: "Clean close with <0.3% variance vs. HubSpot increased financial confidence to 98%.",
  },
  {
    id: "tl-5",
    date: "Jul 3, 2026",
    month: "July 2026",
    type: "evidence-added",
    title: "SOC 2 control review added",
    description: "Internal SOC 2 review passed all 42 controls.",
    dimensionId: "dim-security",
    dimension: "Security",
  },
  {
    id: "tl-6",
    date: "Jun 28, 2026",
    month: "June 2026",
    type: "board",
    title: "Board minutes — May 2026 indexed",
    description: "Board approved Q2 forecast and mid-market expansion pilot.",
    dimensionId: "dim-governance",
    dimension: "Governance",
  },
  {
    id: "tl-7",
    date: "Jun 20, 2026",
    month: "June 2026",
    type: "risk-created",
    title: "Board consent gap identified",
    description: "Carta equity review found 3 grants missing board consent documentation.",
    dimensionId: "dim-governance",
    dimension: "Governance",
    whyHealthChanged: "Governance score dropped 2 points due to undocumented option grants.",
  },
  {
    id: "tl-8",
    date: "Jun 15, 2026",
    month: "June 2026",
    type: "legal",
    title: "Legal folder audit completed",
    description: "4 contractor agreements flagged for missing IP assignment clauses.",
    dimensionId: "dim-legal",
    dimension: "Legal",
  },
  {
    id: "tl-9",
    date: "Jun 1, 2026",
    month: "June 2026",
    type: "score-change",
    title: "June health score: 82",
    description: "Month-start health assessment. Governance and customer risks identified.",
    scoreAfter: 82,
  },
  {
    id: "tl-10",
    date: "May 22, 2026",
    month: "May 2026",
    type: "customer",
    title: "Meridian Corp renewal notice",
    description: "Largest customer (24% ARR) renewal due in 90 days.",
    dimensionId: "dim-customer",
    dimension: "Customer",
  },
  {
    id: "tl-11",
    date: "May 10, 2026",
    month: "May 2026",
    type: "risk-resolved",
    title: "Prior litigation risk closed",
    description: "Vendor dispute resolved. No active litigation remaining.",
    dimensionId: "dim-legal",
    dimension: "Legal",
    whyHealthChanged: "Legal dimension improved 2 points with litigation resolution.",
  },
  {
    id: "tl-12",
    date: "Apr 30, 2026",
    month: "April 2026",
    type: "financial",
    title: "Q1 close completed",
    description: "Q1 financials reconciled. Cash position stable at $3.1M.",
    dimensionId: "dim-financial",
    dimension: "Financial",
  },
];

// ─── Company DNA & reports ───────────────────────────────────────────────────

export const acmeDNA: CompanyDNA = {
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
    { name: "Stripe", status: "pending", documents: 0 },
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
  topRisks: [
    "Customer concentration (58% top-3 ARR)",
    "Board consent cleanup",
    "Contractor IP gaps",
  ],
  keyMetrics: [
    { label: "ARR", value: "$7.2M", change: "+32% YoY" },
    { label: "Runway", value: "14.2 mo", change: "At current burn" },
    { label: "NRR", value: "108%", change: "+3 pts" },
    { label: "Employees", value: "84", change: "+6 Q2" },
    { label: "Health Score", value: "87", change: "+5 this month" },
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

export const acmeReports: Report[] = [
  { id: "rpt-1", title: "July Executive Brief", type: "board", generatedAt: "Jul 9, 6:42 AM", status: "ready" },
  { id: "rpt-2", title: "Q2 Health Assessment", type: "investor", generatedAt: "Jul 5, 9:00 AM", status: "ready" },
  { id: "rpt-3", title: "Governance Cleanup Status", type: "internal", generatedAt: "Jul 3, 2:30 PM", status: "draft" },
  { id: "rpt-4", title: "August Board Package", type: "board", generatedAt: "Scheduled Jul 20", status: "scheduled" },
];

export const acmeExecutiveBrief: ExecutiveBrief = {
  date: "Thursday, July 9, 2026",
  generatedAt: "6:42 AM",
  summary:
    "Health improved 5 points driven by financial close completion, people retention, and security progress. Governance decline partially offset gains.",
  highlights: [
    "Financial score up 4 pts after Q2 close reconciliation",
    "Customer concentration risk elevated—top 3 accounts at 58% ARR",
    "All SOC 2 Type I controls passed internal review",
  ],
  topWins: [
    {
      title: "Q2 financial close completed early",
      detail:
        "Revenue reconciliation finished 3 days ahead of schedule. Financial dimension up to 92.",
    },
    {
      title: "Zero voluntary attrition in Q2",
      detail: "People dimension at 91. Key engineering and GTM roles fully staffed.",
    },
    {
      title: "SOC 2 controls passed internal review",
      detail:
        "Security dimension improved 3 pts. Type I observation period on track for August.",
    },
  ],
  boardMeeting: {
    date: "July 22, 2026",
    daysUntil: 13,
    items: [
      {
        title: "Q2 financial results & forecast",
        status: "ready",
        detail: "P&L, cash flow, and ARR bridge prepared from QuickBooks and HubSpot.",
      },
      {
        title: "Governance cleanup status",
        status: "needs-attention",
        detail:
          "3 option grants need retroactive board consent. Draft prepared, awaiting signature.",
      },
      {
        title: "Customer concentration mitigation plan",
        status: "ready",
        detail: "Mid-market expansion pilot proposal ready for board discussion.",
      },
      {
        title: "SOC 2 Type I timeline",
        status: "pending",
        detail: "Observation period ends August 15. Auditor engagement letter pending.",
      },
    ],
  },
};

// ─── Platform input & snapshot assembly ───────────────────────────────────────

/**
 * Acme platform config — connectors supply evidence; engine computes intelligence.
 * Evidence is no longer hand-authored here; it flows from connector adapters.
 */
export const acmePlatformInput: PlatformInput = {
  connectors: acmeConnectors,
  lastFullScan: "Today, 5:00 AM",
  company: acmeCompany,
  dimensions: acmeDimensions,
  healthScore: acmeHealthScore,
  scoreChange: acmeScoreChange,
  dna: acmeDNA,
  reports: acmeReports,
  timeline: acmeTimeline,
  executiveBrief: acmeExecutiveBrief,
  rules: acmeInsightRules,
};

/** @deprecated Use acmePlatformInput */
export const acmeEngineInput = acmePlatformInput;

/** Full pipeline: Connectors → Insight Engine → CompanyHealthSnapshot */
export const acmeCorpSnapshot: CompanyHealthSnapshot =
  buildCompanyHealthSnapshot(acmePlatformInput);
