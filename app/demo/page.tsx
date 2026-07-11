import { AppShell } from "@/components/AppShell";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import {
  dashboardMetrics,
  evidenceCatalog,
  executiveBrief,
  healthDimensions,
  healthScore,
  insights,
  nextBestActions,
  recommendations,
  topRisks,
  scoreChangeExplanation,
  timelineEvents,
  dimensions,
} from "@/lib/data";
import { loadDemoDashboardView } from "@/lib/dashboard";
import { computeEvidenceCoverage } from "@/lib/coverage";

export default function DemoDashboard() {
  const evidenceCoverage = computeEvidenceCoverage({
    evidence: [],
    stage: "Growth",
  });

  const view = loadDemoDashboardView({
    companyName: "Acme Corp",
    metrics: dashboardMetrics,
    evidenceCoverage,
    healthScore,
    scoreChangeExplanation,
    executiveBrief,
    nextBestActions,
    topRisks,
    healthDimensions,
    insights,
    recommendations,
    evidenceCatalog,
    timelineEvents,
    dimensions,
  });

  return (
    <AppShell
      title={view.assessmentGoal.label}
      subtitle={view.assessmentGoal.purpose}
      userName="Sarah Chen"
      companyName="Acme Corp"
      userEmail="sarah@acme.demo"
      demoMode
    >
      <DashboardContent view={view} />
    </AppShell>
  );
}
