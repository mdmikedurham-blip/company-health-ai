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
  forgotPasswordAction,
  type AuthActionResult,
} from "@/lib/auth/actions";

type State = AuthActionResult & { submitted?: boolean };

const initial: State = { ok: false, submitted: false };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      const result = await forgotPasswordAction(formData);
      return { ...result, submitted: true };
    },
    initial,
  );

  return (
    <AuthShell
      title="Reset password"
      subtitle="We’ll email you a secure link to choose a new password."
      footer={
        <Link href="/login" className="text-indigo-300 hover:text-indigo-200">
          Back to sign in
        </Link>
      }
    >
      <form action={formAction} className="space-y-4">
        {state.submitted && state.ok ? (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            If an account exists for that email, a reset link is on the way.
          </p>
        ) : null}
        <AuthError message={state.ok ? null : state.error} />
        <AuthField
          id="email"
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
        <AuthSubmit>{pending ? "Sending…" : "Send reset link"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
