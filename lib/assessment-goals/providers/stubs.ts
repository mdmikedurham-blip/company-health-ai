import type { AssessmentGoalId } from "@/lib/domain/assessment-goal";
import type { AssessmentGoalProvider } from "../provider";

/** Stub provider — label/purpose only until that goal's scoring is implemented. */
export function createStubGoalProvider(input: {
  id: AssessmentGoalId;
  label: string;
  purpose: string;
}): AssessmentGoalProvider {
  return {
    id: input.id,
    label: input.label,
    purpose: input.purpose,
    getDimensionPriorities: () => [],
    getRecommendationPriorities: () => [],
    getEvidencePriorities: () => [],
    getDashboardWidgets: () => [
      {
        id: `${input.id}-placeholder`,
        title: input.label,
        description: "Goal-specific widgets come in a later phase.",
        placeholder: true,
      },
    ],
    getUploadPriorities: () => [],
    getReportingTemplate: () => ({
      id: `${input.id}-report`,
      title: `${input.label} report`,
      sections: ["Summary", "Evidence coverage", "Next actions"],
    }),
  };
}

export const raiseCapitalProvider = createStubGoalProvider({
  id: "raise-capital",
  label: "Raise Capital",
  purpose:
    "Prepare investor-ready diligence and prioritize fundraising evidence (scoring later).",
});

export const sellTheCompanyProvider = createStubGoalProvider({
  id: "sell-the-company",
  label: "Sell the Company",
  purpose:
    "Organize sell-side readiness and buyer diligence priorities (scoring later).",
});

export const acquireACompanyProvider = createStubGoalProvider({
  id: "acquire-a-company",
  label: "Acquire a Company",
  purpose:
    "Structure buy-side diligence priorities for a target acquisition (scoring later).",
});

export const boardReadinessProvider = createStubGoalProvider({
  id: "board-readiness",
  label: "Board Readiness",
  purpose:
    "Focus on governance cadence, approvals, and board-pack completeness (scoring later).",
});

export const enterpriseSalesProvider = createStubGoalProvider({
  id: "enterprise-sales",
  label: "Enterprise Sales",
  purpose:
    "Prioritize security, contracts, and customer proof for enterprise deals (scoring later).",
});

export const annualAuditProvider = createStubGoalProvider({
  id: "annual-audit",
  label: "Annual Audit",
  purpose:
    "Align evidence collection with audit readiness and control documentation (scoring later).",
});

export const ipoReadinessProvider = createStubGoalProvider({
  id: "ipo-readiness",
  label: "IPO Readiness",
  purpose:
    "Track public-company readiness themes without changing scoring yet.",
});
