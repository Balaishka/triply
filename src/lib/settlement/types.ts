/**
 * Типы расчётного ядра.
 *
 * Ядро оперирует идентификаторами участников поездки (TripMember), а не
 * пользователей: гость без аккаунта и зарегистрированный участник для расчёта
 * неразличимы.
 *
 * Все суммы — целые числа в минорных единицах валюты (копейки, центы).
 * Дробных денег здесь нет и быть не может.
 */

export type MemberId = string;

/** Доля одного участника в одном расходе. */
export interface Share {
  memberId: MemberId;
  amountMinor: number;
}

/** Расход в виде, достаточном для расчёта: кто заплатил и как поделено. */
export interface Expense {
  paidByMemberId: MemberId;
  amountMinor: number;
  shares: Share[];
}

/** Отмеченный перевод денег между участниками. */
export interface Settlement {
  fromMemberId: MemberId;
  toMemberId: MemberId;
  amountMinor: number;
}

/** Итог по одному участнику. */
export interface Balance {
  memberId: MemberId;
  /** Сколько этот участник заплатил за общие расходы. */
  paidMinor: number;
  /** Сколько из общих расходов приходится лично на него. */
  shareMinor: number;
  /** Сколько уже перевёл другим в счёт долга. */
  sentMinor: number;
  /** Сколько уже получил от других. */
  receivedMinor: number;
  /** Итог: больше нуля — ему должны, меньше нуля — должен он. */
  netMinor: number;
}

/** Предлагаемый перевод: кто, кому и сколько. */
export interface Transfer {
  fromMemberId: MemberId;
  toMemberId: MemberId;
  amountMinor: number;
}

/**
 * Верхняя граница суммы одного расхода.
 *
 * В базе суммы лежат в 32-битном Int (максимум 2 147 483 647), поэтому
 * ограничиваем ввод с запасом. Для рубля это миллион рублей на один расход —
 * заведомо больше всего, что бывает в поездке.
 */
export const MAX_AMOUNT_MINOR = 1_000_000_000;
