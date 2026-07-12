import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { ensureProfileForUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /auth/update-password
 * Landing page for password-recovery emails (redirectTo target).
 * Exchanges ?code= when present, then requires an authenticated recovery session.
 */
export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : null;

  let hasRecoverySession = false;

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();

    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth.update_password] exchangeCodeForSession failed", {
          message: error.message,
          status: error.status,
          name: error.name,
        });
      } else if (data.user) {
        await ensureProfileForUser(data.user);
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasRecoverySession = Boolean(user);
  }

  return <UpdatePasswordForm hasRecoverySession={hasRecoverySession} />;
}
