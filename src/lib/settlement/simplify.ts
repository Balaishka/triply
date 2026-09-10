import type { Balance, Transfer } from "./types";

/**
 * Сводит балансы к минимальному числу переводов.
 *
 * Жадный алгоритм: самый крупный должник платит самому крупному кредитору,
 * пока у одного из них не обнулится баланс. На каждом шаге как минимум один
 * участник выходит из расчёта, поэтому переводов получается не больше, чем
 * `участников − 1` — вместо десятка встречных переводов «каждый каждому».
 *
 * Порядок детерминирован: сортировка по убыванию суммы, при равенстве — по
 * идентификатору. Один и тот же набор расходов всегда даёт один и тот же
 * список переводов, иначе он бы прыгал при каждом обновлении страницы.
 *
 * Алгоритм не гарантирует теоретического минимума переводов (это NP-трудная
 * задача), но на десятке участников разница неощутима, а результат
 * предсказуем и объясним.
 */
export function simplifyTransfers(balances: readonly Balance[]): Transfer[] {
  const debtors = balances
    .filter((balance) => balance.netMinor < 0)
    .map((balance) => ({ memberId: balance.memberId, amountMinor: -balance.netMinor }))
    .sort(byAmountThenId);

  const creditors = balances
    .filter((balance) => balance.netMinor > 0)
    .map((balance) => ({ memberId: balance.memberId, amountMinor: balance.netMinor }))
    .sort(byAmountThenId);

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.amountMinor, creditor.amountMinor);

    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountMinor,
    });

    debtor.amountMinor -= amountMinor;
    creditor.amountMinor -= amountMinor;

    if (debtor.amountMinor === 0) debtorIndex += 1;
    if (creditor.amountMinor === 0) creditorIndex += 1;
  }

  return transfers;
}

function byAmountThenId(
  a: { memberId: string; amountMinor: number },
  b: { memberId: string; amountMinor: number },
): number {
  if (a.amountMinor !== b.amountMinor) return b.amountMinor - a.amountMinor;
  return a.memberId < b.memberId ? -1 : 1;
}
