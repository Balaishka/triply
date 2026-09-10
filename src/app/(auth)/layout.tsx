import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Вошедшему пользователю на страницах входа делать нечего.
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-1 block text-center text-3xl font-extrabold tracking-tight text-primary">
          Triply
        </Link>
        <p className="mb-7 text-center text-sm text-muted-foreground">
          Поездки с друзьями без подсчётов, кто кому сколько должен
        </p>
        {children}
      </div>
    </div>
  );
}
