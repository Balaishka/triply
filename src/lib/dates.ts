/**
 * Даты поездки и расходов — это календарные дни, а не моменты времени.
 *
 * В базе они лежат как `@db.Date`, и Prisma отдаёт их как `Date` с полуночью
 * **по UTC**. Если такую дату отформатировать в местном часовом поясе восточнее
 * Гринвича, всё ещё сойдётся, а вот западнее — день уедет на вчера. Поэтому все
 * функции здесь работают строго в UTC и никогда не используют местное время.
 */

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const WEEKDAYS = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];

/** `Date` → `2026-07-12` для input[type=date] и передачи на сервер. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `2026-07-12` → `Date` с полуночью по UTC. */
export function fromISODate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Сегодняшний день в виде `2026-07-12`. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** `12 июля 2026` */
export function formatDate(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_GENITIVE[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `12 июля, вторник` — заголовок дня в ленте расходов. */
export function formatDayHeading(date: Date): string {
  return `${date.getUTCDate()} ${MONTHS_GENITIVE[date.getUTCMonth()]}, ${WEEKDAYS[date.getUTCDay()]}`;
}

/**
 * Диапазон дат поездки в человеческом виде: внутри одного месяца и года
 * повторяющиеся части опускаются.
 *
 * `12–18 июля 2026`, `28 июня – 3 июля 2026`, `с 12 июля 2026`, `по 18 июля 2026`
 */
export function formatDateRange(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null;
  if (start && !end) return `с ${formatDate(start)}`;
  if (!start && end) return `по ${formatDate(end!)}`;

  const from = start!;
  const to = end!;

  if (from.getUTCFullYear() === to.getUTCFullYear()) {
    if (from.getUTCMonth() === to.getUTCMonth()) {
      if (from.getUTCDate() === to.getUTCDate()) return formatDate(from);
      return `${from.getUTCDate()}–${to.getUTCDate()} ${MONTHS_GENITIVE[to.getUTCMonth()]} ${to.getUTCFullYear()}`;
    }
    return `${from.getUTCDate()} ${MONTHS_GENITIVE[from.getUTCMonth()]} – ${formatDate(to)}`;
  }

  return `${formatDate(from)} – ${formatDate(to)}`;
}
