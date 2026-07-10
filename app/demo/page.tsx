import { AppShell } from "@/components/AppShell";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { executiveBrief } from "@/lib/data";

export default function DemoDashboard() {
  return (
    <AppShell
      title="Executive Dashboard"
      subtitle={executiveBrief.date}
      userName="Sarah Chen"
      companyName="Acme Corp"
      userEmail="sarah@acme.demo"
      demoMode
    >
      <DashboardContent />
    </AppShell>
  );
}
