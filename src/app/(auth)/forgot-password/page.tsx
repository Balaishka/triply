import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Восстановление пароля — Triply" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
