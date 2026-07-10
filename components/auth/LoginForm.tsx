"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  AuthError,
  AuthField,
  AuthShell,
  AuthSubmit,
} from "@/components/auth/AuthShell";
import {
  signInAction,
  type AuthActionResult,
} from "@/lib/auth/actions";

const initial: AuthActionResult = { ok: true };

export function LoginForm({
  nextPath,
  confirmEmail,
  deleted,
}: {
  nextPath?: string;
  confirmEmail?: string | null;
  deleted?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthActionResult, formData: FormData) => {
      return signInAction(formData);
    },
    initial,
  );

  return (
    <AuthShell
      title="Sign in"
      subtitle="Access your company health workspace."
      footer={
        <>
          No account?{" "}
          <Link href="/signup" className="text-indigo-300 hover:text-indigo-200">
            Create one
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        {confirmEmail ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Check {confirmEmail} to confirm your email, then sign in.
          </p>
        ) : null}
        {deleted ? (
          <p className="rounded-md border border-zinc-500/30 bg-zinc-500/10 px-3 py-2 text-sm text-zinc-300">
            Your account has been deleted.
          </p>
        ) : null}
        <AuthError message={state.ok ? null : state.error} />
        <input type="hidden" name="next" value={nextPath || "/"} />
        <AuthField
          id="email"
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
        <AuthField
          id="password"
          name="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Forgot password?
          </Link>
        </div>
        <AuthSubmit>{pending ? "Signing in…" : "Sign in"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
