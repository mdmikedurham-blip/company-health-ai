/**
 * Match evidence rows to coverage catalog items.
 */

import type { Evidence } from "@/lib/domain";
import type {
  EvidenceCoverageItemId,
  SupportingDocumentRef,
} from "@/lib/domain/evidence-coverage";

export type ItemMatch = {
  itemId: EvidenceCoverageItemId;
  supportingDocuments: SupportingDocumentRef[];
  confidence: number;
  verified: boolean;
  lastUpdated: string | null;
};

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function asRatio(v: unknown): number | null {
  const n = asNumber(v);
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

function docRef(e: Evidence): SupportingDocumentRef {
  const meta = e.metadata ?? {};
  const documentId =
    typeof meta.document_id === "string"
      ? meta.document_id
      : typeof meta.documentId === "string"
        ? meta.documentId
        : null;
  return {
    evidenceId: e.id,
    title: e.title,
    documentId,
    collectedAt: e.collectedAt,
  };
}

function textOf(e: Evidence): string {
  return `${e.title} ${e.sourceType} ${e.contentSummary}`.toLowerCase();
}

type Matcher = (e: Evidence) => { hit: boolean; verified: boolean; confidence: number };

const MATCHERS: Record<EvidenceCoverageItemId, Matcher> = {
  "historical-financial-statements": (e) => {
    const facts = e.extractedFacts;
    const t = textOf(e);
    const verified =
      facts.financialFactsComplete === true || asNumber(facts.revenue) != null;
    const hit =
      verified ||
      /\b(financial statements?|p&l|income statement|balance sheet|workbook|financials)\b/.test(
        t,
      );
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.55 : 0 };
  },
  forecast: (e) => {
    const t = textOf(e);
    const hit = /\b(forecast|projection|pro forma|financial model)\b/.test(t);
    return { hit, verified: hit, confidence: hit ? 0.7 : 0 };
  },
  budget: (e) => {
    const t = textOf(e);
    const hit = /\b(budget|opex plan|annual plan)\b/.test(t);
    return { hit, verified: hit, confidence: hit ? 0.7 : 0 };
  },
  "cash-flow": (e) => {
    const facts = e.extractedFacts;
    const t = textOf(e);
    const verified =
      asNumber(facts.cashBalance) != null ||
      asNumber(facts.cashRunwayMonths) != null ||
      asNumber(facts.burnRateMonthly) != null;
    const hit = verified || /\b(cash flow|runway|burn)\b/.test(t);
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.55 : 0 };
  },
  "customer-concentration-financial": (e) => {
    const facts = e.extractedFacts;
    const verified = asRatio(facts.top3CustomerArrShare) != null;
    const hit =
      verified ||
      /\bcustomer concentration|top\s*3.*(arr|revenue)\b/.test(textOf(e));
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.55 : 0 };
  },
  "debt-schedule": (e) => {
    const t = textOf(e);
    const hit = /\b(debt schedule|loan|credit facility|convertible note)\b/.test(t);
    return { hit, verified: hit, confidence: hit ? 0.7 : 0 };
  },
  "board-minutes": (e) => {
    const facts = e.extractedFacts;
    const t = textOf(e);
    const verified =
      facts.boardApprovalsDocumented === true ||
      facts.directorElectionsDocumented === true ||
      Boolean(facts.boardMeetingDate);
    const hit = verified || /\bboard minutes|board meeting\b/.test(t);
    return { hit, verified, confidence: verified ? 0.92 : hit ? 0.6 : 0 };
  },
  "written-consents": (e) => {
    const facts = e.extractedFacts;
    const t = textOf(e);
    const verified = facts.writtenConsentDocumented === true;
    const hit = verified || /\bwritten consent\b/.test(t);
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.65 : 0 };
  },
  bylaws: (e) => {
    const hit = /\bbylaws?\b/.test(textOf(e));
    return { hit, verified: hit, confidence: hit ? 0.8 : 0 };
  },
  charter: (e) => {
    const hit = /\b(charter|certificate of incorporation|articles of incorporation)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.85 : 0 };
  },
  "option-approvals": (e) => {
    const facts = e.extractedFacts;
    const t = textOf(e);
    const verified = facts.optionGrantsApproved === true;
    const hit =
      verified || /\b(option grant|equity grant|stock option).*approv/.test(t);
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.6 : 0 };
  },
  incorporation: (e) => {
    const hit = /\b(incorporation|certificate of incorporation|articles|formation)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.85 : 0 };
  },
  "ip-assignments": (e) => {
    const facts = e.extractedFacts;
    const t = textOf(e);
    const verified = asNumber(facts.agreementsMissingIpAssignment) != null;
    const hit = verified || /\b(ip assignment|invention assignment|proprietary rights)\b/.test(t);
    return { hit, verified, confidence: verified ? 0.88 : hit ? 0.6 : 0 };
  },
  "employment-agreements": (e) => {
    const hit = /\b(employment agreement|offer letter|contractor agreement)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.75 : 0 };
  },
  "material-contracts": (e) => {
    const hit = /\b(msa|master service|material contract|customer contract|sow)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.7 : 0 };
  },
  "customer-list": (e) => {
    const hit = /\b(customer list|account list|customer roster)\b/.test(textOf(e));
    return { hit, verified: hit, confidence: hit ? 0.7 : 0 };
  },
  arr: (e) => {
    const facts = e.extractedFacts;
    const verified =
      asNumber(facts.arr) != null ||
      asNumber(facts.annualRecurringRevenue) != null ||
      asNumber(facts.revenue) != null;
    const hit = verified || /\barr\b|annual recurring/.test(textOf(e));
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.55 : 0 };
  },
  cohorts: (e) => {
    const hit = /\bcohort\b/.test(textOf(e));
    return { hit, verified: hit, confidence: hit ? 0.75 : 0 };
  },
  churn: (e) => {
    const facts = e.extractedFacts;
    const verified = asRatio(facts.churnRate) != null;
    const hit = verified || /\bchurn\b/.test(textOf(e));
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.55 : 0 };
  },
  nrr: (e) => {
    const facts = e.extractedFacts;
    const verified = asRatio(facts.netRevenueRetention) != null;
    const hit = verified || /\bnrr\b|net revenue retention/.test(textOf(e));
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.55 : 0 };
  },
  concentration: (e) => {
    const facts = e.extractedFacts;
    const verified = asRatio(facts.top3CustomerArrShare) != null;
    const hit =
      verified || /\bconcentration|top\s*customers?\b/.test(textOf(e));
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.55 : 0 };
  },
  "security-policies": (e) => {
    const hit = /\b(security policy|information security|infosec policy)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.75 : 0 };
  },
  soc2: (e) => {
    const hit = /\bsoc\s*2|soc2|attestation report\b/.test(textOf(e));
    return { hit, verified: hit, confidence: hit ? 0.9 : 0 };
  },
  "penetration-tests": (e) => {
    const hit = /\b(pen(?:etration)?\s*test|pentest|vulnerability assessment)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.85 : 0 };
  },
  mfa: (e) => {
    const facts = e.extractedFacts;
    const verified = asRatio(facts.mfaCoverage) != null;
    const hit = verified || /\bmfa|multi[- ]factor|2fa\b/.test(textOf(e));
    return { hit, verified, confidence: verified ? 0.9 : hit ? 0.6 : 0 };
  },
  "dr-plan": (e) => {
    const hit = /\b(disaster recovery|business continuity|dr plan|bcp)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.8 : 0 };
  },
  "org-chart": (e) => {
    const hit = /\b(org(?:anization)? chart|orgchart)\b/.test(textOf(e));
    return { hit, verified: hit, confidence: hit ? 0.8 : 0 };
  },
  kpis: (e) => {
    const hit = /\b(kpi|key performance|operating metrics|dashboard metrics)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.65 : 0 };
  },
  processes: (e) => {
    const hit = /\b(sop|standard operating|process documentation|runbook)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.65 : 0 };
  },
  compensation: (e) => {
    const hit = /\b(compensation|salary band|pay band|comp matrix)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.7 : 0 };
  },
  hiring: (e) => {
    const hit = /\b(hiring plan|headcount plan|recruiting|open roles)\b/.test(
      textOf(e),
    );
    return { hit, verified: hit, confidence: hit ? 0.65 : 0 };
  },
  retention: (e) => {
    const hit = /\b(retention|attrition|turnover)\b/.test(textOf(e));
    return { hit, verified: hit, confidence: hit ? 0.65 : 0 };
  },
  "option-grants": (e) => {
    const facts = e.extractedFacts;
    const t = textOf(e);
    const verified = facts.optionGrantsApproved === true;
    const hit = verified || /\b(option grant|equity grant|stock option)\b/.test(t);
    return { hit, verified, confidence: verified ? 0.88 : hit ? 0.6 : 0 };
  },
};

export function matchEvidenceToCoverageItems(
  evidence: Evidence[],
): Map<EvidenceCoverageItemId, ItemMatch> {
  const out = new Map<EvidenceCoverageItemId, ItemMatch>();

  for (const [itemId, matcher] of Object.entries(MATCHERS) as Array<
    [EvidenceCoverageItemId, Matcher]
  >) {
    const docs: SupportingDocumentRef[] = [];
    let bestConfidence = 0;
    let anyVerified = false;
    let lastUpdated: string | null = null;

    for (const e of evidence) {
      const result = matcher(e);
      if (!result.hit) continue;
      docs.push(docRef(e));
      bestConfidence = Math.max(bestConfidence, result.confidence);
      if (result.verified) anyVerified = true;
      const ts = e.collectedAt || e.occurredAt;
      if (ts && (!lastUpdated || ts > lastUpdated)) lastUpdated = ts;
    }

    if (docs.length > 0) {
      out.set(itemId, {
        itemId,
        supportingDocuments: docs,
        confidence: bestConfidence,
        verified: anyVerified,
        lastUpdated,
      });
    }
  }

  return out;
}
