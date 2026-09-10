import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Вход — Triply" };

export default function LoginPage() {
  return <LoginForm />;
}
