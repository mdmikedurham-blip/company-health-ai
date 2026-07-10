import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { getSessionContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getSessionContext();
  const defaultFullName =
    (ctx?.user.user_metadata?.full_name as string | undefined) ??
    (ctx?.user.user_metadata?.name as string | undefined) ??
    null;

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.14),_transparent_55%)]"
      />
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <p className="mb-6 text-center text-sm font-medium text-zinc-400">
          Company Health AI
        </p>
        <OnboardingForm defaultFullName={defaultFullName} />
      </div>
    </div>
  );
}
