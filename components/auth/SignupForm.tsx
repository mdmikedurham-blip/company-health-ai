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
          placeholder="At least 8 characters"
        />
        <AuthSubmit>{pending ? "Creating account…" : "Create account"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
