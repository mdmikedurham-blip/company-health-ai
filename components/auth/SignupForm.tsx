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
  signInWithGoogleAction,
  signUpAction,
  type AuthActionResult,
} from "@/lib/auth/actions";

const initial: AuthActionResult = { ok: true };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthActionResult, formData: FormData) => {
      return signUpAction(formData);
    },
    initial,
  );
  const [oauthState, oauthAction, oauthPending] = useActionState(
    async () => signInWithGoogleAction("/onboarding"),
    initial,
  );

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start with email and password. We’ll confirm your email next."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-300 hover:text-indigo-200">
            Sign in
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-4">
        <AuthError message={state.ok ? null : state.error} />
        <AuthField
          id="fullName"
          name="fullName"
          label="Full name"
          required
          autoComplete="name"
          placeholder="Alex Rivera"
        />
        <AuthField
          id="email"
          name="email"
          label="Work email"
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
          autoComplete="new-password"
          placeholder="At least 8 characters, with a letter and number"
        />
        <AuthField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          type="password"
          required
          autoComplete="new-password"
        />
        <label className="flex items-start gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            name="terms"
            value="true"
            required
            className="mt-0.5 rounded border-[var(--border)] bg-black/30"
          />
          <span>
            I agree to the Terms of Service and Privacy Policy for Company
            Health AI.
          </span>
        </label>
        <AuthSubmit>{pending ? "Creating account…" : "Create account"}</AuthSubmit>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-[11px] uppercase tracking-wide text-zinc-600">
          or
        </span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <form action={oauthAction}>
        <AuthError message={oauthState.ok ? null : oauthState.error} />
        <button
          type="submit"
          disabled={oauthPending}
          className="mt-2 w-full rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white disabled:opacity-60"
        >
          {oauthPending ? "Redirecting…" : "Continue with Google"}
        </button>
      </form>
    </AuthShell>
  );
}
