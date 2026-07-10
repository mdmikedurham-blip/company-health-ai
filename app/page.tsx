import { AppShell } from "@/components/AppShell";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { executiveBrief } from "@/lib/data";

export default function ExecutiveDashboard() {
  return (
    <AppShell title="Executive Dashboard" subtitle={executiveBrief.date}>
      <DashboardContent />
    </AppShell>
  );
}
