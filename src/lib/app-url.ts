/**
 * Абсолютный адрес страницы приложения.
 *
 * Нужен письмам: относительная ссылка в почтовом клиенте никуда не ведёт, а
 * брать хост из заголовков запроса нельзя — его подставляет тот, кто запрос
 * прислал, и ссылка в письме увела бы на чужой сайт.
 */
const DEFAULT_APP_URL = "http://localhost:3000";

export function appUrl(path: string): string {
  const base = (process.env.APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
