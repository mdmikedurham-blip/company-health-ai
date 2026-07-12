import { redirect } from "next/navigation";

/** Legacy path — recovery emails now target /auth/update-password. */
export default function ResetPasswordPage() {
  redirect("/auth/update-password");
}
