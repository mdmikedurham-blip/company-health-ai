/**
 * Build valuation input from a health snapshot's financial facts.
 */

import type { CompanyHealthSnapshot } from "@/lib/domain";
import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { ValuationEstimateInput } from "@/lib/domain/value-navigator";
import { valuationInputFromEvidence } from "./input-from-evidence";

export function valuationInputFromSnapshot(input: {
  companyId: string;
  snapshot: CompanyHealthSnapshot;
  assessmentGoal: AssessmentGoalId;
}): ValuationEstimateInput {
  return valuationInputFromEvidence({
    companyId: input.companyId,
    snapshotId: input.snapshot.assessmentSnapshotId ?? null,
    assessmentGoal: input.assessmentGoal,
    evidence: input.snapshot.evidence,
  });
}
