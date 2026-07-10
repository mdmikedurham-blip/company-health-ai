import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(24,24,27,0.9),_transparent_60%)]"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <p className="text-2xl font-semibold tracking-tight text-white">
              Company Health AI
            </p>
          </Link>
          <h1 className="mt-6 text-lg font-medium text-zinc-100">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          {children}
        </div>
        {footer ? (
          <div className="mt-6 text-center text-sm text-zinc-500">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function AuthField({
  label,
  id,
  type = "text",
  name,
  required,
  autoComplete,
  placeholder,
  defaultValue,
}: {
  label: string;
  id: string;
  type?: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
      />
    </label>
  );
}

export function AuthSubmit({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-zinc-100 px-3 py-2.5 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:opacity-60"
    >
      {children}
      {pendingLabel ? (
        <span className="sr-only" data-pending={pendingLabel} />
      ) : null}
    </button>
  );
}

export function AuthError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </p>
  );
}
