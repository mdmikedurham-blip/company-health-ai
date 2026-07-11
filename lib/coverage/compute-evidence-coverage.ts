/**
 * Evidence Coverage Engine — stage-aware diligence completeness.
 */

import type { Evidence } from "@/lib/domain";
import type { CompanyLifecycleStage } from "@/lib/domain/company-classification";
import type {
  EvidenceCoverageCategoryStatus,
  EvidenceCoverageItemStatus,
  EvidenceCoverageReport,
} from "@/lib/domain/evidence-coverage";
import {
  EVIDENCE_COVERAGE_CATEGORIES,
  expectationLevelForItem,
} from "./category-catalog";
import { matchEvidenceToCoverageItems } from "./detect-evidence-items";

function pct(complete: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((complete / total) * 1000) / 10;
}

export function computeEvidenceCoverage(input: {
  evidence: Evidence[];
  stage: CompanyLifecycleStage | null;
  generatedAt?: string;
}): EvidenceCoverageReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const matches = matchEvidenceToCoverageItems(input.evidence);

  const categories: EvidenceCoverageCategoryStatus[] = [];
  const missingRequired: EvidenceCoverageItemStatus[] = [];
  const missingRecommended: EvidenceCoverageItemStatus[] = [];

  let requiredTotal = 0;
  let requiredComplete = 0;
  let recommendedTotal = 0;
  let recommendedComplete = 0;
  let applicableTotal = 0;
  let applicableComplete = 0;

  for (const cat of EVIDENCE_COVERAGE_CATEGORIES) {
    const items: EvidenceCoverageItemStatus[] = [];
    let catRequiredTotal = 0;
    let catRequiredComplete = 0;
    let catRecommendedTotal = 0;
    let catRecommendedComplete = 0;
    let catApplicable = 0;
    let catComplete = 0;
    const catMissingRequired: EvidenceCoverageItemStatus[] = [];
    const catMissingRecommended: EvidenceCoverageItemStatus[] = [];

    for (const def of cat.items) {
      const level = expectationLevelForItem(input.stage, def.itemId);
      const match = matches.get(def.itemId);
      const uploaded = Boolean(match);
      const verified = Boolean(match?.verified);
      const status: EvidenceCoverageItemStatus = {
        itemId: def.itemId,
        categoryId: def.categoryId,
        label: def.label,
        level,
        uploaded,
        verified,
        confidence: match?.confidence ?? 0,
        lastUpdated: match?.lastUpdated ?? null,
        supportingDocuments: match?.supportingDocuments ?? [],
        missing: level !== "not_applicable" && !uploaded,
        whyItMatters: def.whyItMatters,
      };
      items.push(status);

      if (level === "not_applicable") continue;

      applicableTotal += 1;
      catApplicable += 1;
      if (uploaded) {
        applicableComplete += 1;
        catComplete += 1;
      }

      if (level === "required") {
        requiredTotal += 1;
        catRequiredTotal += 1;
        if (uploaded) {
          requiredComplete += 1;
          catRequiredComplete += 1;
        } else {
          missingRequired.push(status);
          catMissingRequired.push(status);
        }
      } else if (level === "recommended") {
        recommendedTotal += 1;
        catRecommendedTotal += 1;
        if (uploaded) {
          recommendedComplete += 1;
          catRecommendedComplete += 1;
        } else {
          missingRecommended.push(status);
          catMissingRecommended.push(status);
        }
      }
    }

    categories.push({
      categoryId: cat.categoryId,
      label: cat.label,
      items,
      requiredTotal: catRequiredTotal,
      requiredComplete: catRequiredComplete,
      recommendedTotal: catRecommendedTotal,
      recommendedComplete: catRecommendedComplete,
      coveragePct: pct(catComplete, catApplicable),
      missingRequired: catMissingRequired,
      missingRecommended: catMissingRecommended,
    });
  }

  return {
    stage: input.stage,
    generatedAt,
    categories,
    coveragePct: pct(applicableComplete, applicableTotal),
    requiredCompletePct: pct(requiredComplete, requiredTotal),
    recommendedCompletePct: pct(recommendedComplete, recommendedTotal),
    missingRequired,
    missingRecommended,
    requiredTotal,
    requiredComplete,
    recommendedTotal,
    recommendedComplete,
    evidenceCount: input.evidence.length,
  };
}
