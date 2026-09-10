import { cookies } from "next/headers";
import { cache } from "react";

import { hashToken, randomToken } from "@/lib/auth/token";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "triply_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
}

/**
 * Заводит сессию и кладёт токен в httpOnly-cookie.
 *
 * В базу пишется только SHA-256 от токена: сам токен существует лишь в cookie
 * браузера, поэтому дамп таблицы сессий не позволяет войти под пользователем.
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Текущий пользователь или `null`.
 *
 * Обёрнуто в `cache`, чтобы за один рендер страницы сходить в базу один раз,
 * сколько бы компонентов ни спросило про пользователя.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      user: { select: { id: true, email: true, nickname: true, avatarUrl: true } },
    },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  return session.user;
});

/**
 * Завершает все сессии пользователя, кроме текущей.
 *
 * Нужна при смене пароля: остальные устройства выходят, а тот, кто менял
 * пароль, остаётся в приложении.
 */
export async function deleteOtherSessions(userId: string): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  await prisma.session.deleteMany({
    where: {
      userId,
      ...(token ? { tokenHash: { not: hashToken(token) } } : {}),
    },
  });
}

/**
 * Завершает все сессии пользователя.
 *
 * Нужна при восстановлении пароля: там нет текущей сессии, которую стоило бы
 * пощадить, зато есть вероятность, что аккаунтом уже пользуется кто-то чужой.
 */
export async function deleteAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Завершает текущую сессию: удаляет запись в базе и чистит cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(COOKIE_NAME);
}
