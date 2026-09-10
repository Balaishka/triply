/**
 * Работа с деньгами.
 *
 * Внутри приложения сумма — всегда целое число минорных единиц (копеек,
 * центов). Строки в рублях появляются только на границе: при выводе на экран и
 * при разборе пользовательского ввода.
 */

export interface Currency {
  code: string;
  /** Число знаков после запятой: у рубля 2, у иены и донга — 0. */
  decimals: number;
  label: string;
}

/** Валюты, доступные при создании поездки. */
export const CURRENCIES: Record<string, Currency> = {
  RUB: { code: "RUB", decimals: 2, label: "Российский рубль" },
  USD: { code: "USD", decimals: 2, label: "Доллар США" },
  EUR: { code: "EUR", decimals: 2, label: "Евро" },
  GEL: { code: "GEL", decimals: 2, label: "Грузинский лари" },
  TRY: { code: "TRY", decimals: 2, label: "Турецкая лира" },
  THB: { code: "THB", decimals: 2, label: "Тайский бат" },
  AED: { code: "AED", decimals: 2, label: "Дирхам ОАЭ" },
  KZT: { code: "KZT", decimals: 2, label: "Казахстанский тенге" },
  AMD: { code: "AMD", decimals: 2, label: "Армянский драм" },
  RSD: { code: "RSD", decimals: 2, label: "Сербский динар" },
  JPY: { code: "JPY", decimals: 0, label: "Японская иена" },
  VND: { code: "VND", decimals: 0, label: "Вьетнамский донг" },
};

export const DEFAULT_CURRENCY = "RUB";

export const CURRENCY_LIST = Object.values(CURRENCIES);

export function getCurrency(code: string): Currency {
  return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
}

/** Во сколько минорных единиц укладывается одна основная: 100 для рубля, 1 для иены. */
export function minorUnitsPerMajor(code: string): number {
  return 10 ** getCurrency(code).decimals;
}

/** `123456, RUB` → `1 234,56 ₽` */
export function formatMoney(amountMinor: number, code: string): string {
  const currency = getCurrency(code);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amountMinor / minorUnitsPerMajor(code));
}

/** То же, но без символа валюты — для полей ввода и таблиц. */
export function formatAmount(amountMinor: number, code: string): string {
  const currency = getCurrency(code);
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amountMinor / minorUnitsPerMajor(code));
}

/**
 * Разбирает то, что человек напечатал в поле суммы.
 *
 * Принимает и запятую, и точку. `\s` заодно убирает неразрывные пробелы —
 * они приезжают, когда сумму копируют из уже отформатированного текста.
 * Возвращает `null`, если разобрать не удалось: вызывающий код сам решает,
 * что показать.
 */
export function parseAmount(input: string, code: string): number | null {
  const normalized = input.replace(/\s/g, "").replace(",", ".");

  if (normalized === "" || !/^\d*\.?\d*$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;

  const minor = Math.round(value * minorUnitsPerMajor(code));
  return Number.isSafeInteger(minor) ? minor : null;
}
