import type {
  Confidence,
  Evidence,
  Finding,
  HealthDimension,
  HealthDimensionId,
  HealthScore,
  Insight,
  Recommendation,
  RecommendationPriority,
  Risk,
  RiskSeverity,
  TimelineEvent,
  CompanyDNA,
  ConnectorId,
} from "@/lib/domain";
import {
  HEALTH_DIMENSIONS,
  clampScore,
  dimensionMeta,
  severityRank,
  statusFromScore,
} from "@/lib/domain";

export interface InsightEngineInput {
  companyId: string;
  companyName: string;
  industry?: string;
  stage?: string;
  evidence: Evidence[];
  /** Optional baseline dimension scores before risk impact (defaults to 82). */
  baselineScore?: number;
}

export interface InsightEngineResult {
  findings: Finding[];
  insights: Insight[];
  risks: Risk[];
  recommendations: Recommendation[];
  health: HealthScore;
  timeline: TimelineEvent[];
  dna: CompanyDNA;
}

function num(payload: Record<string, unknown>, key: string): number | undefined {
  const v = payload[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key];
  return typeof v === "string" ? v : undefined;
}

function bool(payload: Record<string, unknown>, key: string): boolean | undefined {
  const v = payload[key];
  return typeof v === "boolean" ? v : undefined;
}

function avgConfidence(items: { confidence: Confidence }[]): Confidence {
  if (items.length === 0) return 0;
  return Math.round(
    items.reduce((sum, i) => sum + i.confidence, 0) / items.length,
  );
}

function evidenceById(evidence: Evidence[]): Map<string, Evidence> {
  return new Map(evidence.map((e) => [e.id, e]));
}

function pick(
  map: Map<string, Evidence>,
  ...ids: string[]
): Evidence[] {
  return ids.map((id) => map.get(id)).filter((e): e is Evidence => Boolean(e));
}

/**
 * Evidence → Findings
 * Rule-based extractors turn normalized evidence into analytical claims.
 * Future ML/LLM extractors can plug in beside these without changing the UI.
 */
export function deriveFindings(evidence: Evidence[], now: string): Finding[] {
  const byId = evidenceById(evidence);
  const findings: Finding[] = [];

  const cash = pick(byId, "ev-qb-pl-q2", "ev-qb-cash-forecast");
  if (cash.length > 0) {
    const pl = byId.get("ev-qb-pl-q2");
    const forecast = byId.get("ev-qb-cash-forecast");
    const runway = num(forecast?.payload ?? {}, "runwayMonths");
    const prior = num(forecast?.payload ?? {}, "priorRunwayMonths");
    const burn = num(pl?.payload ?? {}, "monthlyBurnUsd");
    findings.push({
      id: "find-runway",
      title: "Cash runway is adequate but tightening",
      summary:
        runway != null && prior != null
          ? `Runway is ${runway} months, down from ${prior} months last quarter${burn != null ? ` at $${(burn / 1000).toFixed(0)}K monthly burn` : ""}.`
          : "Cash runway signals indicate tightening liquidity relative to prior period.",
      dimension: "financial",
      evidenceIds: cash.map((e) => e.id),
      signalStrength: runway != null && runway < 18 ? 0.72 : 0.4,
      confidence: avgConfidence(cash),
      metrics: {
        runwayMonths: runway ?? 0,
        priorRunwayMonths: prior ?? 0,
        monthlyBurnUsd: burn ?? 0,
      },
      createdAt: now,
    });
  }

  const conc = pick(byId, "ev-hubspot-pipeline");
  if (conc.length > 0) {
    const top3 = num(conc[0].payload, "top3CustomerArrPct");
    findings.push({
      id: "find-revenue-concentration",
      title: "Revenue is highly concentrated",
      summary:
        top3 != null
          ? `Top 3 customers represent ${top3}% of ARR, creating material concentration risk.`
          : "Customer concentration exceeds healthy diversification thresholds.",
      dimension: "customer",
      evidenceIds: conc.map((e) => e.id),
      signalStrength: top3 != null && top3 >= 50 ? 0.85 : 0.45,
      confidence: avgConfidence(conc),
      metrics: { top3CustomerArrPct: top3 ?? 0 },
      createdAt: now,
    });
  }

  const nrrEv = pick(byId, "ev-hubspot-pipeline");
  if (nrrEv.length > 0) {
    const nrr = num(nrrEv[0].payload, "netRevenueRetentionPct");
    findings.push({
      id: "find-nrr",
      title: "Net revenue retention is healthy",
      summary:
        nrr != null
          ? `Net revenue retention is ${nrr}%, indicating expansion offsetting churn.`
          : "NRR indicates healthy expansion dynamics.",
      dimension: "customer",
      evidenceIds: nrrEv.map((e) => e.id),
      signalStrength: nrr != null && nrr >= 100 ? 0.2 : 0.6,
      confidence: avgConfidence(nrrEv),
      metrics: { netRevenueRetentionPct: nrr ?? 0 },
      createdAt: now,
    });
  }

  const rq = pick(byId, "ev-hubspot-cohorts", "ev-box-contracts");
  if (rq.length > 0) {
    const cohorts = byId.get("ev-hubspot-cohorts");
    const recurring = num(cohorts?.payload ?? {}, "recurringRevenuePct");
    findings.push({
      id: "find-revenue-quality",
      title: "Revenue quality needs attention",
      summary:
        recurring != null
          ? `Only ${recurring}% of revenue is recurring; contract standardization and cohort trends warrant focus.`
          : "Mix of recurring vs one-time revenue and contract terms need improvement.",
      dimension: "revenue_quality",
      evidenceIds: rq.map((e) => e.id),
      signalStrength: recurring != null && recurring < 85 ? 0.7 : 0.35,
      confidence: avgConfidence(rq),
      metrics: {
        recurringRevenuePct: recurring ?? 0,
        oneTimeRevenuePct: num(cohorts?.payload ?? {}, "oneTimeRevenuePct") ?? 0,
      },
      createdAt: now,
    });
  }

  const gov = pick(
    byId,
    "ev-drive-board-minutes",
    "ev-carta-cap",
    "ev-carta-ira",
  );
  if (gov.length > 0) {
    findings.push({
      id: "find-governance-maturity",
      title: "Governance practices are maturing",
      summary:
        "Board structure, cap table cleanliness, and investor rights indicate maturing but not fully mature governance.",
      dimension: "governance",
      evidenceIds: gov.map((e) => e.id),
      signalStrength: 0.45,
      confidence: avgConfidence(gov),
      metrics: {
        cleanStructure: bool(byId.get("ev-carta-cap")?.payload ?? {}, "cleanStructure") ?? false,
        deadEquityPct: num(byId.get("ev-carta-cap")?.payload ?? {}, "deadEquityPct") ?? 0,
      },
      createdAt: now,
    });
  }

  const legal = pick(byId, "ev-box-legal");
  if (legal.length > 0) {
    const litigation = num(legal[0].payload, "activeLitigation");
    findings.push({
      id: "find-legal-clean",
      title: "Legal exposure is limited",
      summary:
        litigation === 0
          ? "No active litigation or liens; IP assignments are complete."
          : "Legal review identified open exposure items.",
      dimension: "legal",
      evidenceIds: legal.map((e) => e.id),
      signalStrength: litigation === 0 ? 0.15 : 0.75,
      confidence: avgConfidence(legal),
      metrics: {
        activeLitigation: litigation ?? 0,
        liens: num(legal[0].payload, "liens") ?? 0,
      },
      createdAt: now,
    });
  }

  const sec = pick(byId, "ev-drive-soc2");
  if (sec.length > 0) {
    const status = str(sec[0].payload, "status");
    const complete = num(sec[0].payload, "controlsCompletePct");
    findings.push({
      id: "find-soc2",
      title: "Security posture is incomplete",
      summary:
        status === "in_progress"
          ? `SOC 2 Type I is in progress with ${complete ?? "?"}% of controls complete.`
          : "Security compliance status requires review.",
      dimension: "security",
      evidenceIds: sec.map((e) => e.id),
      signalStrength: status === "in_progress" ? 0.55 : 0.3,
      confidence: avgConfidence(sec),
      metrics: {
        controlsCompletePct: complete ?? 0,
        soc2Status: status ?? "unknown",
      },
      createdAt: now,
    });
  }

  const people = pick(byId, "ev-qb-headcount", "ev-drive-board-may");
  if (people.length > 0) {
    const hc = byId.get("ev-qb-headcount");
    const attrition = num(hc?.payload ?? {}, "attritionTrailing12Pct");
    findings.push({
      id: "find-people",
      title: "People metrics are stable with moderate key-person risk",
      summary:
        attrition != null
          ? `Trailing attrition is ${attrition}% with moderate key-person dependency and planned Q3 hiring.`
          : "Headcount and attrition appear within normal ranges.",
      dimension: "people",
      evidenceIds: people.map((e) => e.id),
      signalStrength: attrition != null && attrition > 15 ? 0.65 : 0.35,
      confidence: avgConfidence(people),
      metrics: {
        headcount: num(hc?.payload ?? {}, "headcount") ?? 0,
        attritionTrailing12Pct: attrition ?? 0,
      },
      createdAt: now,
    });
  }

  const ops = pick(byId, "ev-box-vendors");
  if (ops.length > 0) {
    const spof = num(ops[0].payload, "singlePointsOfFailure");
    const breaches = num(ops[0].payload, "slaBreachesTrailing6");
    findings.push({
      id: "find-ops-vendors",
      title: "Operations have vendor concentration risk",
      summary:
        `Critical vendor map shows ${spof ?? 0} single point(s) of failure and ${breaches ?? 0} SLA breaches in the last 6 months.`,
      dimension: "operations",
      evidenceIds: ops.map((e) => e.id),
      signalStrength: (spof ?? 0) > 0 || (breaches ?? 0) > 1 ? 0.6 : 0.3,
      confidence: avgConfidence(ops),
      metrics: {
        singlePointsOfFailure: spof ?? 0,
        slaBreachesTrailing6: breaches ?? 0,
      },
      createdAt: now,
    });
  }

  const cap = pick(byId, "ev-carta-cap");
  if (cap.length > 0) {
    const dead = num(cap[0].payload, "deadEquityPct");
    findings.push({
      id: "find-cap-table",
      title: "Cap table structure is clean",
      summary:
        dead === 0
          ? "Cap table has a clean structure with no dead equity and a healthy option pool."
          : "Cap table complexity warrants cleanup.",
      dimension: "governance",
      evidenceIds: cap.map((e) => e.id),
      signalStrength: dead === 0 ? 0.1 : 0.5,
      confidence: avgConfidence(cap),
      metrics: {
        deadEquityPct: dead ?? 0,
        optionPoolPct: num(cap[0].payload, "optionPoolPct") ?? 0,
      },
      createdAt: now,
    });
  }

  return findings;
}

/**
 * Findings → Risks
 */
export function deriveRisks(findings: Finding[], now: string): Risk[] {
  const byId = new Map(findings.map((f) => [f.id, f]));
  const risks: Risk[] = [];

  function fromFinding(
    findingId: string,
    opts: {
      id: string;
      label: string;
      detail: string;
      severity: RiskSeverity;
      healthImpact: number;
      trend?: Risk["trend"];
      invert?: boolean;
    },
  ): void {
    const finding = byId.get(findingId);
    if (!finding) return;
    // Positive findings (low signal / invert) become low-severity watch items
    const severity = opts.invert
      ? ("low" as RiskSeverity)
      : opts.severity;
    risks.push({
      id: opts.id,
      label: opts.label,
      detail: opts.detail,
      severity,
      dimension: finding.dimension,
      findingIds: [finding.id],
      evidenceIds: [...finding.evidenceIds],
      confidence: finding.confidence,
      healthImpact: opts.invert ? Math.min(opts.healthImpact, 4) : opts.healthImpact,
      trend: opts.trend,
      createdAt: now,
    });
  }

  const runway = byId.get("find-runway");
  if (runway) {
    const months = Number(runway.metrics?.runwayMonths ?? 0);
    fromFinding("find-runway", {
      id: "risk-cash-runway",
      label: "Cash runway",
      detail:
        months > 0
          ? `${months} months at current burn`
          : runway.summary,
      severity: months < 12 ? "high" : months < 18 ? "medium" : "low",
      healthImpact: months < 12 ? 18 : months < 18 ? 12 : 4,
      trend: "worsening",
    });
  }

  const conc = byId.get("find-revenue-concentration");
  if (conc) {
    const pct = Number(conc.metrics?.top3CustomerArrPct ?? 0);
    fromFinding("find-revenue-concentration", {
      id: "risk-revenue-concentration",
      label: "Revenue concentration",
      detail:
        pct > 0 ? `Top 3 customers = ${pct}% of ARR` : conc.summary,
      severity: pct >= 60 ? "high" : pct >= 40 ? "medium" : "low",
      healthImpact: pct >= 60 ? 20 : pct >= 40 ? 12 : 5,
      trend: "stable",
    });
  }

  fromFinding("find-nrr", {
    id: "risk-customer-churn",
    label: "Customer churn",
    detail: (() => {
      const nrr = byId.get("find-nrr");
      const pct = Number(nrr?.metrics?.netRevenueRetentionPct ?? 0);
      return pct > 0 ? `Net revenue retention at ${pct}%` : "Churn within acceptable range";
    })(),
    severity: "low",
    healthImpact: 3,
    invert: true,
    trend: "improving",
  });

  fromFinding("find-soc2", {
    id: "risk-security-posture",
    label: "Security posture",
    detail: "SOC 2 Type I in progress",
    severity: "medium",
    healthImpact: 10,
    trend: "improving",
  });

  fromFinding("find-cap-table", {
    id: "risk-cap-table",
    label: "Cap table complexity",
    detail: "Clean structure, no dead equity",
    severity: "low",
    healthImpact: 2,
    invert: true,
    trend: "stable",
  });

  fromFinding("find-legal-clean", {
    id: "risk-legal-exposure",
    label: "Legal exposure",
    detail: "No active litigation or liens",
    severity: "low",
    healthImpact: 2,
    invert: true,
    trend: "stable",
  });

  fromFinding("find-revenue-quality", {
    id: "risk-revenue-quality",
    label: "Revenue quality",
    detail: (() => {
      const f = byId.get("find-revenue-quality");
      const pct = Number(f?.metrics?.recurringRevenuePct ?? 0);
      return pct > 0
        ? `${pct}% recurring revenue; contract mix needs work`
        : "Revenue mix quality below target";
    })(),
    severity: "medium",
    healthImpact: 14,
    trend: "stable",
  });

  fromFinding("find-governance-maturity", {
    id: "risk-governance",
    label: "Governance maturity",
    detail: "Practices maturing; formalize remaining controls",
    severity: "medium",
    healthImpact: 8,
    trend: "improving",
  });

  fromFinding("find-ops-vendors", {
    id: "risk-ops-vendors",
    label: "Vendor dependency",
    detail: (() => {
      const f = byId.get("find-ops-vendors");
      const spof = Number(f?.metrics?.singlePointsOfFailure ?? 0);
      return `${spof} single point(s) of failure in critical vendors`;
    })(),
    severity: "medium",
    healthImpact: 9,
    trend: "stable",
  });

  fromFinding("find-people", {
    id: "risk-key-person",
    label: "Key-person dependency",
    detail: "Moderate key-person risk with planned hiring",
    severity: "low",
    healthImpact: 5,
    trend: "stable",
  });

  return risks.sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
}

/**
 * Findings → Insights (board-ready conclusions with evidence refs)
 */
export function deriveInsights(
  findings: Finding[],
  evidence: Evidence[],
  now: string,
): Insight[] {
  const insights: Insight[] = [];
  const findingMap = new Map(findings.map((f) => [f.id, f]));

  function insightFrom(
    id: string,
    findingIds: string[],
    title: string,
    conclusion: string,
    dimension?: HealthDimensionId,
  ): void {
    const selected = findingIds
      .map((fid) => findingMap.get(fid))
      .filter((f): f is Finding => Boolean(f));
    if (selected.length === 0) return;
    const evidenceIds = [
      ...new Set(selected.flatMap((f) => f.evidenceIds)),
    ];
    insights.push({
      id,
      title,
      conclusion,
      dimension,
      findingIds: selected.map((f) => f.id),
      evidenceIds,
      confidence: avgConfidence(selected),
      createdAt: now,
    });
  }

  const runway = findingMap.get("find-runway");
  if (runway) {
    insightFrom(
      "insight-runway",
      ["find-runway"],
      "Runway outlook",
      "Runway is adequate but tightening",
      "financial",
    );
  }

  insightFrom(
    "insight-revenue-quality",
    ["find-revenue-quality", "find-revenue-concentration"],
    "Revenue quality",
    "Revenue quality needs attention",
    "revenue_quality",
  );

  insightFrom(
    "insight-governance",
    ["find-governance-maturity", "find-cap-table"],
    "Governance",
    "Governance practices are maturing",
    "governance",
  );

  // Attach source titles for UI convenience via evidence lookup validation
  void evidence;

  return insights;
}

/**
 * Risks → HealthScore impacts
 */
export function computeHealthScore(
  risks: Risk[],
  findings: Finding[],
  evidence: Evidence[],
  now: string,
  baselineScore = 82,
): HealthScore {
  const dimensions: HealthDimension[] = HEALTH_DIMENSIONS.map((meta) => {
    const dimRisks = risks.filter((r) => r.dimension === meta.id);
    const impact = dimRisks.reduce((sum, r) => sum + r.healthImpact, 0);
    const score = clampScore(baselineScore - impact);
    return {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      score,
      status: statusFromScore(score),
      weight: meta.defaultWeight,
      riskIds: dimRisks.map((r) => r.id),
      findingIds: findings
        .filter((f) => f.dimension === meta.id)
        .map((f) => f.id),
    };
  });

  const totalWeight = dimensions.reduce((s, d) => s + d.weight, 0);
  const overall = clampScore(
    dimensions.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight,
  );

  return {
    overall,
    status: statusFromScore(overall),
    dimensions,
    computedAt: now,
    evidenceCount: evidence.length,
    riskCount: risks.filter((r) => r.severity === "high" || r.severity === "critical")
      .length,
  };
}

function priorityFromSeverity(
  severity: RiskSeverity,
  impact: number,
): RecommendationPriority {
  if (severity === "critical" || (severity === "high" && impact >= 15)) return "p0";
  if (severity === "high") return "p1";
  if (severity === "medium") return "p2";
  return "p3";
}

/**
 * Risks → prioritized Recommendations with confidence + evidence refs
 */
export function deriveRecommendations(
  risks: Risk[],
  now: string,
): Recommendation[] {
  const playbooks: Record<
    string,
    { title: string; rationale: string; ownerHint?: string; expectedImpact: number }
  > = {
    "risk-revenue-concentration": {
      title: "Diversify top-customer ARR exposure",
      rationale:
        "Reduce top-3 concentration below 45% via mid-market expansion and multi-year renewals on secondary accounts.",
      ownerHint: "CRO",
      expectedImpact: 14,
    },
    "risk-cash-runway": {
      title: "Extend runway via burn discipline and collections",
      rationale:
        "Revisit Q3 hiring pace, accelerate AR collections, and re-forecast enterprise close timing.",
      ownerHint: "CFO",
      expectedImpact: 12,
    },
    "risk-revenue-quality": {
      title: "Increase recurring revenue mix",
      rationale:
        "Standardize MSAs, push annual prepaid terms, and migrate one-time work into subscription packages.",
      ownerHint: "CRO",
      expectedImpact: 11,
    },
    "risk-security-posture": {
      title: "Complete SOC 2 Type I controls",
      rationale:
        "Close remaining control gaps before the September audit window to de-risk enterprise deals.",
      ownerHint: "CISO / Head of Eng",
      expectedImpact: 9,
    },
    "risk-governance": {
      title: "Formalize remaining board controls",
      rationale:
        "Document decision rights, refresh information-rights cadence, and close open governance checklist items.",
      ownerHint: "CEO / General Counsel",
      expectedImpact: 7,
    },
    "risk-ops-vendors": {
      title: "Eliminate critical vendor single points of failure",
      rationale:
        "Add failover for the identified SPOF vendor and renegotiate SLAs after recent breaches.",
      ownerHint: "COO",
      expectedImpact: 8,
    },
    "risk-key-person": {
      title: "Reduce key-person dependency",
      rationale:
        "Document critical workflows and cross-train backups before Q3 headcount ramps.",
      ownerHint: "People Ops",
      expectedImpact: 5,
    },
    "risk-customer-churn": {
      title: "Protect NRR above 105%",
      rationale:
        "Maintain expansion motions on healthy accounts; monitor the two churn-risk accounts weekly.",
      ownerHint: "CS Lead",
      expectedImpact: 4,
    },
    "risk-cap-table": {
      title: "Keep cap table hygiene current",
      rationale:
        "Maintain option pool and 409A cadence; no structural cleanup required.",
      ownerHint: "CFO",
      expectedImpact: 2,
    },
    "risk-legal-exposure": {
      title: "Maintain clean legal posture",
      rationale:
        "Continue IP assignment discipline and close the one open contract review.",
      ownerHint: "General Counsel",
      expectedImpact: 2,
    },
  };

  const recommendations: Recommendation[] = risks.map((risk) => {
    const playbook = playbooks[risk.id] ?? {
      title: `Address ${risk.label}`,
      rationale: risk.detail,
      expectedImpact: Math.round(risk.healthImpact * 0.7),
    };
    return {
      id: `rec-${risk.id.replace(/^risk-/, "")}`,
      title: playbook.title,
      rationale: playbook.rationale,
      priority: priorityFromSeverity(risk.severity, risk.healthImpact),
      dimension: risk.dimension,
      riskIds: [risk.id],
      evidenceIds: [...risk.evidenceIds],
      confidence: risk.confidence,
      expectedImpact: playbook.expectedImpact,
      ownerHint: playbook.ownerHint,
      createdAt: now,
    };
  });

  const priorityOrder: Record<RecommendationPriority, number> = {
    p0: 0,
    p1: 1,
    p2: 2,
    p3: 3,
  };

  return recommendations.sort((a, b) => {
    const p = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (p !== 0) return p;
    return b.expectedImpact - a.expectedImpact;
  });
}

function buildTimeline(
  evidence: Evidence[],
  findings: Finding[],
  risks: Risk[],
  recommendations: Recommendation[],
  health: HealthScore,
  now: string,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  const connectors = [...new Set(evidence.map((e) => e.connectorId))];
  for (const connectorId of connectors) {
    const count = evidence.filter((e) => e.connectorId === connectorId).length;
    events.push({
      id: `tl-ingest-${connectorId}`,
      occurredAt: now,
      title: `Ingested evidence from ${connectorId}`,
      description: `${count} evidence item(s) normalized into the pipeline`,
      kind: "ingestion",
      connectorId,
      relatedIds: evidence
        .filter((e) => e.connectorId === connectorId)
        .map((e) => e.id),
    });
  }

  for (const finding of findings.slice(0, 5)) {
    events.push({
      id: `tl-${finding.id}`,
      occurredAt: finding.createdAt,
      title: finding.title,
      description: finding.summary,
      kind: "finding",
      dimension: finding.dimension,
      relatedIds: [finding.id, ...finding.evidenceIds],
    });
  }

  for (const risk of risks.filter(
    (r) => r.severity === "high" || r.severity === "critical" || r.severity === "medium",
  )) {
    events.push({
      id: `tl-${risk.id}`,
      occurredAt: risk.createdAt,
      title: `Risk flagged: ${risk.label}`,
      description: risk.detail,
      kind: "risk",
      dimension: risk.dimension,
      relatedIds: [risk.id, ...risk.findingIds],
    });
  }

  const topRecs = recommendations.filter(
    (r) => r.priority === "p0" || r.priority === "p1",
  );
  for (const rec of topRecs) {
    events.push({
      id: `tl-${rec.id}`,
      occurredAt: rec.createdAt,
      title: rec.title,
      description: rec.rationale,
      kind: "recommendation",
      dimension: rec.dimension,
      relatedIds: [rec.id, ...rec.riskIds],
    });
  }

  events.push({
    id: "tl-score",
    occurredAt: health.computedAt,
    title: `Health score computed: ${health.overall}/100`,
    description: `Status ${health.status} across ${health.dimensions.length} dimensions`,
    kind: "score_change",
    relatedIds: health.dimensions.map((d) => d.id),
  });

  return events.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

/**
 * Full pipeline: Evidence → Findings → Insights/Risks → HealthScore → Recommendations → CompanyDNA
 */
export function runInsightEngine(input: InsightEngineInput): InsightEngineResult {
  const now = new Date().toISOString();
  const evidence = input.evidence;

  const findings = deriveFindings(evidence, now);
  const insights = deriveInsights(findings, evidence, now);
  const risks = deriveRisks(findings, now);
  const health = computeHealthScore(
    risks,
    findings,
    evidence,
    now,
    input.baselineScore,
  );
  const recommendations = deriveRecommendations(risks, now);
  const timeline = buildTimeline(
    evidence,
    findings,
    risks,
    recommendations,
    health,
    now,
  );

  const connectedSystems = [
    ...new Set(evidence.map((e) => e.connectorId)),
  ] as ConnectorId[];

  const dna: CompanyDNA = {
    companyId: input.companyId,
    companyName: input.companyName,
    industry: input.industry,
    stage: input.stage,
    health,
    evidence,
    findings,
    insights,
    risks,
    recommendations,
    timeline,
    connectedSystems,
    generatedAt: now,
  };

  return {
    findings,
    insights,
    risks,
    recommendations,
    health,
    timeline,
    dna,
  };
}

/** Resolve evidence titles for citation chips in the UI. */
export function evidenceTitles(
  evidence: Evidence[],
  evidenceIds: string[],
): string[] {
  const map = evidenceById(evidence);
  return evidenceIds
    .map((id) => map.get(id)?.title)
    .filter((t): t is string => Boolean(t));
}

export function dimensionDisplayName(id: HealthDimensionId): string {
  return dimensionMeta(id).name;
}
