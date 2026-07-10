import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/dashboard";
  const confirmEmail =
    params.confirm === "1" && typeof params.email === "string"
      ? params.email
      : null;
  const deleted = params.deleted === "1";

  return (
    <LoginForm
      nextPath={nextPath}
      confirmEmail={confirmEmail}
      deleted={deleted}
    />
  );
}
