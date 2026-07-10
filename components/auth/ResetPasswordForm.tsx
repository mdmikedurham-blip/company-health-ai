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
  resetPasswordAction,
  type AuthActionResult,
} from "@/lib/auth/actions";

const initial: AuthActionResult = { ok: true };

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthActionResult, formData: FormData) => {
      return resetPasswordAction(formData);
    },
    initial,
  );

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Enter a strong password for your account."
      footer={
        <Link href="/login" className="text-indigo-300 hover:text-indigo-200">
          Back to sign in
        </Link>
      }
    >
      <form action={formAction} className="space-y-4">
        <AuthError message={state.ok ? null : state.error} />
        <AuthField
          id="password"
          name="password"
          label="New password"
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
        <AuthSubmit>{pending ? "Updating…" : "Update password"}</AuthSubmit>
      </form>
    </AuthShell>
  );
}
