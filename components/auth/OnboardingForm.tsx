"use client";

import { useActionState } from "react";
import {
  AuthError,
  AuthField,
  AuthSubmit,
} from "@/components/auth/AuthShell";
import {
  completeOnboardingAction,
  type AuthActionResult,
} from "@/lib/auth/actions";

const initial: AuthActionResult = { ok: true };

export function OnboardingForm({
  defaultFullName,
}: {
  defaultFullName?: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: AuthActionResult, formData: FormData) => {
      return completeOnboardingAction(formData);
    },
    initial,
  );

  return (
    <form action={formAction} className="mx-auto max-w-md space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Welcome — set up your workspace
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Tell us who you are and name your company. You’ll connect Google Drive
          next.
        </p>
      </div>
      <AuthError message={state.ok ? null : state.error} />
      <AuthField
        id="fullName"
        name="fullName"
        label="Full name"
        required
        placeholder="Alex Rivera"
        autoComplete="name"
        defaultValue={defaultFullName ?? undefined}
      />
      <AuthField
        id="companyName"
        name="companyName"
        label="Company name"
        required
        placeholder="Acme Corp"
        autoComplete="organization"
      />
      <AuthSubmit>
        {pending ? "Creating workspace…" : "Continue to connectors"}
      </AuthSubmit>
    </form>
  );
}
