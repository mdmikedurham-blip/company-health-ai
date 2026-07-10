import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const ctx = await getSessionContext();
    if (ctx) {
      redirect(ctx.primaryCompanyId ? "/dashboard" : "/onboarding");
    }
  }

  return (
    <div className="relative flex min-h-full flex-col overflow-auto bg-[var(--background)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(24,24,27,0.9),_transparent_60%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <p className="text-lg font-semibold tracking-tight text-white">
          Company Health AI
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white"
          >
            Create account
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-24 pt-10">
        <p className="text-sm font-medium text-indigo-300">Company Health AI</p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          See company health across every connected system.
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
          Sign in to your workspace, connect sources like Google Drive, and get
          an executive view of risks, actions, and evidence — not a static demo.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-[var(--border-strong)] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/demo"
            className="px-2 py-2.5 text-sm text-zinc-500 transition hover:text-zinc-300"
          >
            View Acme Corp demo →
          </Link>
        </div>
      </main>
    </div>
  );
}
