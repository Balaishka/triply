import { canResend, resetExpiresAt } from "@/lib/auth/reset-link";
import { hashToken, randomToken } from "@/lib/auth/token";
import { prisma } from "@/lib/db";

/**
 * Заявки на восстановление пароля: заведение, проверка и погашение.
 *
 * Сроки и паузы живут рядом, в `reset-link.ts` — здесь только база.
 */

/**
 * Заводит заявку и возвращает токен для ссылки — или `null`, если письмо этому
 * пользователю уже уходило только что.
 *
 * Сам токен нигде не сохраняется: в базе лежит только его хеш, и второй раз ту
 * же ссылку не собрать даже с полным доступом к базе.
 */
export async function createPasswordReset(userId: string): Promise<string | null> {
  const now = new Date();

  // Просроченные заявки убираем заодно: заводить ради одной таблицы отдельную
  // уборку по расписанию не стоит.
  await prisma.passwordResetToken.deleteMany({
    where: { userId, expiresAt: { lt: now } },
  });

  const last = await prisma.passwordResetToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!canResend(last?.createdAt ?? null, now)) return null;

  const token = randomToken();
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: resetExpiresAt(now) },
  });

  return token;
}

/** Владелец живой ссылки или `null`, если ссылки нет, она просрочена или уже использована. */
export async function findPasswordReset(token: string): Promise<{ userId: string } | null> {
  if (!token) return null;

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { userId: true, expiresAt: true },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) return null;
  return { userId: record.userId };
}

/**
 * Гасит все заявки пользователя.
 *
 * После смены пароля недействительны и та ссылка, которой воспользовались, и
 * все остальные — включая заказанные кем-то чужим.
 */
export async function clearPasswordResets(userId: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
}
