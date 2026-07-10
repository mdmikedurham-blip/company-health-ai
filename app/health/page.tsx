import { AppShell } from "@/components/AppShell";
import { HealthDimensionsGrid } from "@/components/health/HealthDimensionsGrid";
import { dimensions, healthScore } from "@/lib/data";

export default function HealthPage() {
  return (
    <AppShell
      title="Health Dimensions"
      subtitle={`${dimensions.length} dimensions · Overall score ${healthScore.score}`}
    >
      <HealthDimensionsGrid dimensions={dimensions} />
    </AppShell>
  );
}
