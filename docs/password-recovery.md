# Password recovery (production)

## App behavior

- Forgot-password calls `supabase.auth.resetPasswordForEmail` with
  `redirectTo = {NEXT_PUBLIC_SITE_URL}/auth/update-password`.
- In production, localhost Site URLs are never used for that redirect.
- The UI reports that a reset was **requested**, not that an email was delivered.

## Vercel environment

Set (Production):

```
NEXT_PUBLIC_SITE_URL=https://company-health-ai.vercel.app
```

Also keep existing:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
# or NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

No database migration is required for password recovery.

## Supabase Dashboard (required)

**Authentication → URL Configuration**

| Setting | Exact value |
|---------|-------------|
| **Site URL** | `https://company-health-ai.vercel.app` |
| **Additional Redirect URLs** | `https://company-health-ai.vercel.app/auth/update-password` |

Also recommended (OAuth / email confirm):

- `https://company-health-ai.vercel.app/auth/callback`

**Authentication → Emails**

- Built-in Supabase mail is fine for light use.
- For reliable delivery, configure custom SMTP (Auth → SMTP Settings).
- Confirm the “Reset password” template is enabled.

## Manual verification

1. Open `https://company-health-ai.vercel.app/forgot-password`.
2. Submit a known account email.
3. Confirm UI copy does **not** claim the email was definitely sent.
4. Open the email link → lands on `/auth/update-password`.
5. Set a new password → redirected to `/login?reset=1`.
6. Sign in with the new password.
