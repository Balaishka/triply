/**
 * Правила паузы после неудачных входов: сколько промахов прощаем, как растёт
 * ожидание и когда счётчик забывается.
 *
 * Отдельно от работы с базой, как и `reset-link.ts`: это политика, и держаться
 * она должна на тесте, а не на внимательном чтении запроса.
 */

import { plural } from "@/lib/plural";

/**
 * Промахи, которые проходят без паузы. Пароль путают и раскладкой, и забытым
 * Caps Lock, поэтому первые попытки не наказываем.
 */
export const FREE_ATTEMPTS = 5;

/** Пауза сразу после превышения. Каждый следующий промах её удваивает. */
export const FIRST_LOCK_SECONDS = 30;

/**
 * Потолок паузы. Дальше растить нечего: полчаса сводят перебор к нескольким
 * попыткам в час, а живого человека дольше держать взаперти незачем.
 */
export const MAX_LOCK_SECONDS = 30 * 60;

/**
 * Сколько счётчик помнит промахи. Час без попыток — и адрес начинает с чистого
 * листа: иначе редкие опечатки за месяц сложились бы в блокировку.
 */
export const ATTEMPT_MEMORY_MINUTES = 60;

/** Пауза после указанного числа промахов подряд; 0 — попытки ещё есть. */
export function lockSeconds(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  // Возведение в степень на большом счётчике даёт Infinity — потолок его срежет.
  return Math.min(FIRST_LOCK_SECONDS * 2 ** (failures - FREE_ATTEMPTS - 1), MAX_LOCK_SECONDS);
}

/** Момент, когда адресу снова можно пробовать, или `null` — если можно сейчас. */
export function lockedUntil(failures: number, now: Date): Date | null {
  const seconds = lockSeconds(failures);
  return seconds === 0 ? null : new Date(now.getTime() + seconds * 1000);
}

/** Сколько секунд осталось ждать; 0 — пауза кончилась или её не было. */
export function retryAfterSeconds(lockedUntil: Date | null, now: Date): number {
  if (!lockedUntil) return 0;
  return Math.max(0, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

/** Забыты ли прошлые промахи: попыток не было дольше отведённого срока. */
export function attemptsForgotten(lastFailedAt: Date, now: Date): boolean {
  return now.getTime() - lastFailedAt.getTime() >= ATTEMPT_MEMORY_MINUTES * 60 * 1000;
}

/** Счётчик промахов после очередного — с учётом того, что старые забываются. */
export function countFailure(
  previous: { failures: number; lastFailedAt: Date } | null,
  now: Date,
): number {
  if (!previous || attemptsForgotten(previous.lastFailedAt, now)) return 1;
  return previous.failures + 1;
}

/** `30 секунд`, `2 минуты` — сколько ждать, для сообщения в форме. */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} ${plural(seconds, "секунду", "секунды", "секунд")}`;
  }

  // Округляем вверх: «через 1 минуту» на 90 секундах обманет, «через 2» — нет.
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${plural(minutes, "минуту", "минуты", "минут")}`;
}
