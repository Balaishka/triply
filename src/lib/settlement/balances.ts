import type { Balance, Expense, MemberId, Settlement } from "./types";

/**
 * Считает итог по каждому участнику поездки.
 *
 *   netMinor = заплатил − своя доля + перевёл − получил
 *
 * Отмеченные переводы уменьшают остаток, поэтому погашенный долг сам уходит из
 * списка «осталось перевести». В интерфейсе это остаётся простой галочкой,
 * а математика сходится без отдельного состояния «оплачено».
 *
 * В результат попадают все участники поездки, включая тех, кто ничего не
 * платил и ни в чём не участвовал — списку в интерфейсе нужны все.
 */
export function computeBalances(
  memberIds: readonly MemberId[],
  expenses: readonly Expense[],
  settlements: readonly Settlement[],
): Balance[] {
  const balances = new Map<MemberId, Balance>(
    memberIds.map((memberId) => [
      memberId,
      {
        memberId,
        paidMinor: 0,
        shareMinor: 0,
        sentMinor: 0,
        receivedMinor: 0,
        netMinor: 0,
      },
    ]),
  );

  for (const expense of expenses) {
    const payer = balances.get(expense.paidByMemberId);
    if (payer) {
      payer.paidMinor += expense.amountMinor;
    }
    for (const share of expense.shares) {
      const member = balances.get(share.memberId);
      if (member) {
        member.shareMinor += share.amountMinor;
      }
    }
  }

  for (const settlement of settlements) {
    const from = balances.get(settlement.fromMemberId);
    const to = balances.get(settlement.toMemberId);
    if (from) {
      from.sentMinor += settlement.amountMinor;
    }
    if (to) {
      to.receivedMinor += settlement.amountMinor;
    }
  }

  const result: Balance[] = [];
  for (const memberId of memberIds) {
    const balance = balances.get(memberId)!;
    balance.netMinor =
      balance.paidMinor - balance.shareMinor + balance.sentMinor - balance.receivedMinor;
    result.push(balance);
  }
  return result;
}

/** Общая сумма расходов поездки. */
export function totalSpent(expenses: readonly Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amountMinor, 0);
}
