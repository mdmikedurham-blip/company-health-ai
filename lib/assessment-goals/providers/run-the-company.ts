import type { AssessmentGoalProvider } from "../provider";

/**
 * Run the Company — default operating mode.
 * Protect / Grow / Operate / Prepare / Decide are architectural placeholders
 * (no AI output yet).
 */
export const runTheCompanyProvider: AssessmentGoalProvider = {
  id: "run-the-company",
  label: "Run the Company",
  purpose:
    "Optimize operational health and help management prioritize the highest-value work.",

  getDimensionPriorities() {
    return [
      {
        dimensionId: "dim-financial",
        weight: 1,
        rationale: "Cash and runway protect continuity.",
      },
      {
        dimensionId: "dim-customer",
        weight: 0.9,
        rationale: "Retention and concentration bound growth risk.",
      },
      {
        dimensionId: "dim-people",
        weight: 0.85,
        rationale: "Execution capacity depends on the team.",
      },
      {
        dimensionId: "dim-operations",
        weight: 0.8,
        rationale: "Internal efficiency compounds weekly.",
      },
      {
        dimensionId: "dim-governance",
        weight: 0.7,
        rationale: "Decision hygiene before the next milestone.",
      },
    ];
  },

  getRecommendationPriorities() {
    return [
      {
        theme: "protect",
        weight: 1,
        rationale: "Surface material downside first.",
      },
      {
        theme: "grow",
        weight: 0.9,
        rationale: "Remove constraints on growth next.",
      },
      {
        theme: "operate",
        weight: 0.8,
        rationale: "Reduce internal drag.",
      },
      {
        theme: "prepare",
        weight: 0.7,
        rationale: "Close gaps before the next milestone.",
      },
      {
        theme: "decide",
        weight: 0.75,
        rationale: "Flag decisions lacking evidence.",
      },
    ];
  },

  getEvidencePriorities() {
    return [
      {
        categoryId: "financial",
        weight: 1,
        rationale: "Operating decisions need current numbers.",
      },
      {
        categoryId: "customer",
        weight: 0.9,
        rationale: "Growth and concentration risk.",
      },
      {
        categoryId: "operations",
        weight: 0.8,
        rationale: "Efficiency and ownership clarity.",
      },
      {
        categoryId: "people",
        weight: 0.8,
        rationale: "Capacity and retention.",
      },
      {
        categoryId: "governance",
        weight: 0.7,
        rationale: "Decision trail for material actions.",
      },
    ];
  },

  getDashboardWidgets() {
    return [
      {
        id: "protect",
        title: "Protect",
        description: "What could materially damage the business?",
        placeholder: true,
      },
      {
        id: "grow",
        title: "Grow",
        description: "What is limiting growth?",
        placeholder: true,
      },
      {
        id: "operate",
        title: "Operate",
        description: "What is inefficient internally?",
        placeholder: true,
      },
      {
        id: "prepare",
        title: "Prepare",
        description: "What should be completed before the next milestone?",
        placeholder: true,
      },
      {
        id: "decide",
        title: "Decide",
        description: "What decisions lack sufficient evidence?",
        placeholder: true,
      },
    ];
  },

  getUploadPriorities() {
    return [
      {
        label: "Latest financial workbook",
        why: "Keeps Protect and Operate grounded in current cash and burn.",
        level: "required",
      },
      {
        label: "Customer / ARR snapshot",
        why: "Supports Grow and concentration checks.",
        level: "recommended",
      },
      {
        label: "Recent board minutes or consents",
        why: "Documents material decisions for Prepare / Decide.",
        level: "recommended",
      },
      {
        label: "Org chart or headcount plan",
        why: "Clarifies operating ownership.",
        level: "optional",
      },
    ];
  },

  getReportingTemplate() {
    return {
      id: "run-the-company-ops",
      title: "Operating health brief",
      sections: [
        "Protect",
        "Grow",
        "Operate",
        "Prepare",
        "Decide",
        "Evidence coverage",
        "Next actions",
      ],
    };
  },

  getOperatingLenses() {
    return [
      {
        id: "protect",
        title: "Protect",
        question: "What could materially damage the business?",
        items: [],
      },
      {
        id: "grow",
        title: "Grow",
        question: "What is limiting growth?",
        items: [],
      },
      {
        id: "operate",
        title: "Operate",
        question: "What is inefficient internally?",
        items: [],
      },
      {
        id: "prepare",
        title: "Prepare",
        question: "What should be completed before the next milestone?",
        items: [],
      },
      {
        id: "decide",
        title: "Decide",
        question: "What decisions lack sufficient evidence?",
        items: [],
      },
    ];
  },
};
