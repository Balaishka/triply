import { MAX_AMOUNT_MINOR, type MemberId, type Share } from "./types";

/**
 * Делит сумму поровну между участниками.
 *
 * Остаток от неделимой суммы раздаётся по одной минорной единице первым
 * участникам в переданном порядке. Благодаря этому сумма долей **всегда** в
 * точности равна сумме расхода: 100 ₽ на троих превращаются в 33.34 + 33.33 +
 * 33.33, а не в три раза по 33.33 с потерянной копейкой.
 */
export function splitEqually(amountMinor: number, memberIds: MemberId[]): Share[] {
  assertAmount(amountMinor);
  if (memberIds.length === 0) {
    throw new Error("Нужен хотя бы один участник расхода");
  }

  const base = Math.floor(amountMinor / memberIds.length);
  const remainder = amountMinor - base * memberIds.length;

  return memberIds.map((memberId, index) => ({
    memberId,
    amountMinor: base + (index < remainder ? 1 : 0),
  }));
}

/**
 * Делит сумму с учётом долей, заданных вручную.
 *
 * Участники из `overrides` получают ровно указанные суммы, остаток делится
 * поровну между остальными.
 *
 * Функция намеренно не бросает исключение, если суммы не сходятся: форма
 * расхода пересчитывает доли на каждый ввод и должна показывать расхождение,
 * а не падать на полпути. Проверка — отдельно, через `checkShares`.
 */
export function splitManual(
  amountMinor: number,
  memberIds: MemberId[],
  overrides: ReadonlyMap<MemberId, number>,
): Share[] {
  assertAmount(amountMinor);
  if (memberIds.length === 0) {
    throw new Error("Нужен хотя бы один участник расхода");
  }

  const autoMembers = memberIds.filter((id) => !overrides.has(id));

  // Все доли заданы руками — возвращаем как есть, сходимость проверит форма.
  if (autoMembers.length === 0) {
    return memberIds.map((memberId) => ({
      memberId,
      amountMinor: overrides.get(memberId) ?? 0,
    }));
  }

  let fixedTotal = 0;
  for (const id of memberIds) {
    fixedTotal += overrides.get(id) ?? 0;
  }

  // Ручные доли уже перебрали сумму чека — остальным не остаётся ничего.
  // Расхождение подсветит форма, а не молчаливый отрицательный остаток.
  const rest = Math.max(0, amountMinor - fixedTotal);
  const autoShares = new Map(
    splitEqually(rest, autoMembers).map((share) => [share.memberId, share.amountMinor]),
  );

  return memberIds.map((memberId) => ({
    memberId,
    amountMinor: overrides.get(memberId) ?? autoShares.get(memberId) ?? 0,
  }));
}

/**
 * Проверяет, что доли складываются в сумму расхода.
 *
 * `diffMinor` — сколько ещё нужно распределить: больше нуля, если доли не
 * добирают до чека, меньше нуля, если перебрали.
 */
export function checkShares(
  amountMinor: number,
  shares: readonly Share[],
): { ok: boolean; totalMinor: number; diffMinor: number } {
  const totalMinor = shares.reduce((sum, share) => sum + share.amountMinor, 0);
  const diffMinor = amountMinor - totalMinor;
  return { ok: diffMinor === 0, totalMinor, diffMinor };
}

function assertAmount(amountMinor: number): void {
  if (!Number.isInteger(amountMinor)) {
    throw new Error("Сумма должна быть целым числом минорных единиц");
  }
  if (amountMinor < 0) {
    throw new Error("Сумма не может быть отрицательной");
  }
  if (amountMinor > MAX_AMOUNT_MINOR) {
    throw new Error("Слишком большая сумма");
  }
}
