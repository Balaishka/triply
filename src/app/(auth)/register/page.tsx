import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Регистрация — Triply" };

export default function RegisterPage() {
  return <RegisterForm />;
}
