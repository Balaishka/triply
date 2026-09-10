/**
 * Правила ссылки восстановления пароля: срок жизни, пауза между письмами,
 * адрес страницы.
 *
 * Отдельно от работы с базой — это политика, и проверяется она тестом, а не
 * внимательным чтением запроса.
 */

/**
 * Ссылка живёт час: этого хватает, чтобы дойти до почты, и мало, чтобы забытое
 * письмо в ящике осталось запасным ключом от аккаунта.
 */
export const RESET_TTL_MINUTES = 60;

/**
 * Пауза между письмами на один адрес.
 *
 * Форма восстановления открыта всем без входа, поэтому без паузы ею можно
 * заваливать чужой ящик письмами.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Момент, когда ссылка перестанет работать. */
export function resetExpiresAt(now: Date): Date {
  return new Date(now.getTime() + RESET_TTL_MINUTES * 60 * 1000);
}

/** Пора ли отправлять новое письмо или предыдущее ушло совсем недавно. */
export function canResend(lastRequestedAt: Date | null, now: Date): boolean {
  if (!lastRequestedAt) return true;
  return now.getTime() - lastRequestedAt.getTime() >= RESEND_COOLDOWN_SECONDS * 1000;
}

/** Адрес страницы, на которой задают новый пароль. */
export function resetPath(token: string): string {
  return `/reset-password?token=${encodeURIComponent(token)}`;
}
