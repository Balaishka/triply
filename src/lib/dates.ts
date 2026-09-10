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

/* ------------------------------------------------------------------ *
 * Календарь: сетка месяца и навигация по ней.
 *
 * Всё считается в строках `2026-07-12`, а не в объектах `Date`: строки
 * сравниваются лексикографически (это и есть сравнение дат), не тянут за
 * собой часовой пояс и годятся как React-ключи без лишних преобразований.
 * ------------------------------------------------------------------ */

const MONTHS_NOMINATIVE = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/** Месяцы для сетки выбора года — в неё нужны короткие подписи. */
export const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

/** Шапка недели. Неделя начинается с понедельника — так принято здесь. */
export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** `12.07.2026` — компактная дата для узкого поля, где месяц словом не влезает. */
export function formatDateNumeric(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

/** `Июль 2026` — заголовок месяца в календаре. */
export function formatMonthTitle(monthISO: string): string {
  const date = fromISODate(monthISO);
  return `${MONTHS_NOMINATIVE[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `2026-07-12` → `2026-07-01`. */
export function startOfMonthISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Год и месяц (0–11) в виде `2026-07-01`. */
export function monthISO(year: number, month: number): string {
  return toISODate(new Date(Date.UTC(year, month, 1)));
}

export function yearOfISO(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function monthOfISO(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}

/** Порядковый номер дня недели, где понедельник — 0. */
export function weekdayIndexISO(iso: string): number {
  return (fromISODate(iso).getUTCDay() + 6) % 7;
}

export function addDaysISO(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

/**
 * Сдвиг на месяцы с сохранением числа. 31 марта минус месяц — это 28 (или 29)
 * февраля, а не 3 марта, как получилось бы при наивном `setUTCMonth`.
 */
export function addMonthsISO(iso: string, months: number): string {
  const date = fromISODate(iso);
  const target = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), target + 1, 0)).getUTCDate();
  return toISODate(
    new Date(Date.UTC(date.getUTCFullYear(), target, Math.min(date.getUTCDate(), lastDay))),
  );
}

/**
 * Сетка месяца: шесть недель по семь дней, включая хвосты соседних месяцев.
 *
 * Недель всегда шесть, даже когда хватило бы пяти: иначе календарь менял бы
 * высоту при перелистывании и кнопки под ним прыгали бы под пальцем.
 */
export function monthGridISO(anchorISO: string): string[][] {
  const first = startOfMonthISO(anchorISO);
  const start = addDaysISO(first, -weekdayIndexISO(first));

  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDaysISO(start, week * 7 + day)),
  );
}
