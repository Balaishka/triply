import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Вошедшему пользователю на страницах входа делать нечего.
  if (await getCurrentUser()) redirect("/");

  return <AuthShell>{children}</AuthShell>;
}
