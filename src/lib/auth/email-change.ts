import { canResendEmailChange, emailChangeExpiresAt } from "@/lib/auth/email-change-link";
import { hashToken, randomToken } from "@/lib/auth/token";
import { prisma } from "@/lib/db";

/**
 * Заявки на смену почты: заведение, проверка и погашение.
 *
 * Сроки и паузы живут рядом, в `email-change-link.ts` — здесь только база.
 */

/**
 * Заводит заявку и возвращает токен для ссылки — или `null`, если письмо этому
 * пользователю уже уходило только что.
 *
 * Заявка у пользователя одна: новая отменяет предыдущую, иначе после пары
 * опечаток по ящикам разошлись бы несколько рабочих ссылок сразу.
 *
 * Сам токен нигде не сохраняется: в базе лежит только его хеш, и второй раз ту
 * же ссылку не собрать даже с полным доступом к базе.
 */
export async function createEmailChange(userId: string, newEmail: string): Promise<string | null> {
  const now = new Date();

  const last = await prisma.emailChangeRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!canResendEmailChange(last?.createdAt ?? null, now)) return null;

  const token = randomToken();

  await prisma.$transaction([
    prisma.emailChangeRequest.deleteMany({ where: { userId } }),
    prisma.emailChangeRequest.create({
      data: { tokenHash: hashToken(token), userId, newEmail, expiresAt: emailChangeExpiresAt(now) },
    }),
  ]);

  return token;
}

/** Живая заявка по токену из письма или `null`, если ссылка не работает. */
export async function findEmailChange(
  token: string,
): Promise<{ userId: string; newEmail: string } | null> {
  if (!token) return null;

  const record = await prisma.emailChangeRequest.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { userId: true, newEmail: true, expiresAt: true },
  });

  if (!record || record.expiresAt.getTime() < Date.now()) return null;
  return { userId: record.userId, newEmail: record.newEmail };
}

/**
 * Адрес, которого ждёт подтверждения пользователь, или `null`.
 *
 * Нужен профилю: иначе после отправки письма смена выглядит так, будто ничего
 * не произошло. Просроченные заявки заодно убираем — заводить ради одной
 * таблицы уборку по расписанию не стоит.
 */
export async function pendingEmailChange(userId: string): Promise<string | null> {
  const now = new Date();

  await prisma.emailChangeRequest.deleteMany({
    where: { userId, expiresAt: { lt: now } },
  });

  const record = await prisma.emailChangeRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { newEmail: true },
  });

  return record?.newEmail ?? null;
}

/**
 * Гасит заявки пользователя.
 *
 * Вызывается не только после подтверждения: смена пароля тоже отменяет
 * начатую смену адреса. Иначе заявка, заведённая с угнанным паролем, пережила
 * бы возвращение аккаунта хозяину и увела бы вход на чужой ящик.
 */
export async function clearEmailChanges(userId: string): Promise<void> {
  await prisma.emailChangeRequest.deleteMany({ where: { userId } });
}
