import { AppShell } from "@/components/AppShell";
import { DoctorChat } from "@/components/doctor/DoctorChat";

interface DoctorPageProps {
  searchParams: Promise<{
    prompt?: string;
    explain?: string;
  }>;
}

export default async function DoctorPage({ searchParams }: DoctorPageProps) {
  const params = await searchParams;

  return (
    <AppShell
      title="Company Doctor"
      subtitle="AI health analyst · 1,247 documents indexed"
      flush
    >
      <DoctorChat
        initialPrompt={params.prompt}
        explainRiskId={params.explain}
      />
    </AppShell>
  );
}
