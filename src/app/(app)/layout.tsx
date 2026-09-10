import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/require-user";
import { countIncomingRequests } from "@/lib/queries/friends";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const pendingRequests = await countIncomingRequests(user.id);

  return (
    <AppShell user={user} pendingRequests={pendingRequests}>
      {children}
    </AppShell>
  );
}
