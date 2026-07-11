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

export default function DemoDashboard() {
  const view = loadDemoDashboardView({
    companyName: "Acme Corp",
    metrics: dashboardMetrics,
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
      title="Executive Dashboard"
      subtitle={executiveBrief.date}
      userName="Sarah Chen"
      companyName="Acme Corp"
      userEmail="sarah@acme.demo"
      demoMode
    >
      <DashboardContent view={view} />
    </AppShell>
  );
}
