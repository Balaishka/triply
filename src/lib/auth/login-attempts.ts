import {
  ATTEMPT_MEMORY_MINUTES,
  countFailure,
  lockedUntil,
  retryAfterSeconds,
} from "@/lib/auth/login-throttle";
import { prisma } from "@/lib/db";

/**
 * Счётчик неудачных входов: чтение, отметка промаха и сброс.
 *
 * Сроки и рост паузы живут рядом, в `login-throttle.ts` — здесь только база.
 *
 * Ключ — адрес почты, а не пользователь: строка заводится и для адресов, на
 * которых аккаунта нет. Иначе по тому, включилась ли пауза, форма входа
 * рассказывала бы, кто зарегистрирован — ровно то, от чего её берегут
 * одинаковый ответ и decoy-хеш.
 */

/** Сколько секунд адресу ещё ждать; 0 — можно пробовать. */
export async function loginRetryAfter(email: string): Promise<number> {
  const record = await prisma.loginAttempt.findUnique({
    where: { email },
    select: { lockedUntil: true },
  });

  return retryAfterSeconds(record?.lockedUntil ?? null, new Date());
}

/**
 * Отмечает промах и возвращает, сколько теперь ждать (0 — попытки ещё есть).
 *
 * Заодно подчищает забытые строки: перебор по выдуманным адресам иначе растит
 * таблицу без конца, а заводить ради неё уборку по расписанию не стоит. Строка
 * под живой паузой сюда не попадёт — пауза короче срока, за который промахи
 * забываются.
 */
export async function registerFailedLogin(email: string): Promise<number> {
  const now = new Date();

  await prisma.loginAttempt.deleteMany({
    where: { lastFailedAt: { lt: new Date(now.getTime() - ATTEMPT_MEMORY_MINUTES * 60 * 1000) } },
  });

  const previous = await prisma.loginAttempt.findUnique({
    where: { email },
    select: { failures: true, lastFailedAt: true },
  });

  const failures = countFailure(previous, now);
  const until = lockedUntil(failures, now);

  await prisma.loginAttempt.upsert({
    where: { email },
    create: { email, failures, lastFailedAt: now, lockedUntil: until },
    update: { failures, lastFailedAt: now, lockedUntil: until },
  });

  return retryAfterSeconds(until, now);
}

/** Снимает счётчик: адрес снова с чистого листа. */
export async function clearLoginAttempts(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { email } });
}
