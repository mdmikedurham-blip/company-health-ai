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

export function UpdatePasswordForm({
  hasRecoverySession,
}: {
  hasRecoverySession: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthActionResult, formData: FormData) => {
      return resetPasswordAction(formData);
    },
    initial,
  );

  if (!hasRecoverySession) {
    return (
      <AuthShell
        title="Reset link expired"
        subtitle="This password-reset link is invalid or has expired."
        footer={
          <Link
            href="/forgot-password"
            className="text-indigo-300 hover:text-indigo-200"
          >
            Request a new reset link
          </Link>
        }
      >
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Open the latest email link in the same browser, or request a new one.
        </p>
      </AuthShell>
    );
  }

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
