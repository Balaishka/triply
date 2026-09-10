/**
 * Правила ссылки подтверждения новой почты: срок жизни, пауза между письмами,
 * адрес страницы.
 *
 * Отдельно от работы с базой — это политика, и проверяется она тестом, а не
 * внимательным чтением запроса. Соседний `reset-link.ts` устроен так же.
 */

/**
 * Ссылка живёт час.
 *
 * Смену затевают сидя перед приложением, и часа хватает даже на то, чтобы
 * дойти до нового ящика с телефона. Дольше держать нечего: письмо, забытое в
 * ящике, не должно оставаться заготовленным ключом к смене адреса входа.
 */
export const EMAIL_CHANGE_TTL_MINUTES = 60;

/**
 * Пауза между письмами.
 *
 * Форма закрыта паролем, но адрес получателя человек указывает сам — без паузы
 * ею можно засыпать письмами чужой ящик.
 */
export const EMAIL_CHANGE_COOLDOWN_SECONDS = 60;

/** Момент, когда ссылка перестанет работать. */
export function emailChangeExpiresAt(now: Date): Date {
  return new Date(now.getTime() + EMAIL_CHANGE_TTL_MINUTES * 60 * 1000);
}

/** Пора ли отправлять новое письмо или предыдущее ушло совсем недавно. */
export function canResendEmailChange(lastRequestedAt: Date | null, now: Date): boolean {
  if (!lastRequestedAt) return true;
  return now.getTime() - lastRequestedAt.getTime() >= EMAIL_CHANGE_COOLDOWN_SECONDS * 1000;
}

/** Адрес страницы, на которой подтверждают новый адрес. */
export function confirmEmailPath(token: string): string {
  return `/confirm-email?token=${encodeURIComponent(token)}`;
}
