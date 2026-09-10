import type { Metadata } from "next";

import { AvatarPicker } from "@/components/profile/avatar-picker";
import { EmailForm, PasswordForm, ProfileForm } from "@/components/profile/profile-forms";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";
import { pendingEmailChange } from "@/lib/auth/email-change";
import { requireUser } from "@/lib/auth/require-user";
import { toISODate } from "@/lib/dates";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Профиль — Triply" };

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await requireUser();

  // Сюда приводит подтверждённая ссылка из письма, когда её открыли в том же
  // браузере, где приложение уже открыто.
  const { email: confirmed } = await searchParams;

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { nickname: true, email: true, birthDate: true, phone: true, avatar: true },
  });

  if (!profile) {
    // Сессия есть, а пользователя нет — такое возможно только после удаления
    // аккаунта из базы напрямую. Выходим, чтобы не показывать пустую страницу.
    await logoutAction();
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Профиль</h1>

      <AvatarPicker nickname={profile.nickname} avatar={profile.avatar} />

      <ProfileForm
        initial={{
          nickname: profile.nickname,
          birthDate: profile.birthDate ? toISODate(profile.birthDate) : "",
          phone: profile.phone ?? "",
        }}
      />

      <section className="border-t border-border pt-5">
        <EmailForm
          email={profile.email}
          pendingEmail={await pendingEmailChange(user.id)}
          notice={confirmed ? "Адрес подтверждён — теперь вход по нему." : undefined}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <PasswordForm />

        <form action={logoutAction}>
          <Button type="submit" variant="ghost" className="w-full sm:w-auto">
            Выйти
          </Button>
        </form>
      </section>
    </div>
  );
}
