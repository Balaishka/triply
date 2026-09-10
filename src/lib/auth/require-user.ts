import { redirect } from "next/navigation";

import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

/**
 * Текущий пользователь или переход на вход.
 *
 * Вызывается в начале каждой защищённой страницы и каждого мутирующего
 * действия: проверка на сервере — единственная настоящая, скрытая кнопка в
 * интерфейсе ничего не гарантирует.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
