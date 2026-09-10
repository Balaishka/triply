import { describe, expect, it } from "vitest";

import { computeBalances, totalSpent } from "./balances";
import { simplifyTransfers } from "./simplify";
import { checkShares, splitEqually, splitManual } from "./split";
import type { Balance, Expense, MemberId, Settlement } from "./types";

const sum = (numbers: readonly number[]) => numbers.reduce((a, b) => a + b, 0);

describe("splitEqually", () => {
  it("раздаёт неделимый остаток по копейке, не теряя ни одной", () => {
    const shares = splitEqually(10_000, ["a", "b", "c"]);

    expect(shares.map((s) => s.amountMinor)).toEqual([3334, 3333, 3333]);
    expect(sum(shares.map((s) => s.amountMinor))).toBe(10_000);
  });

  it("делит ровно, когда сумма делится нацело", () => {
    const shares = splitEqually(900, ["a", "b", "c"]);
    expect(shares.map((s) => s.amountMinor)).toEqual([300, 300, 300]);
  });

  it("отдаёт всю сумму единственному участнику", () => {
    expect(splitEqually(777, ["a"])).toEqual([{ memberId: "a", amountMinor: 777 }]);
  });

  it("сохраняет сумму при любом числе участников", () => {
    for (let people = 1; people <= 12; people += 1) {
      const memberIds = Array.from({ length: people }, (_, i) => `m${i}`);
      for (const amount of [0, 1, 7, 99, 100, 10_000, 123_457]) {
        const shares = splitEqually(amount, memberIds);
        expect(sum(shares.map((s) => s.amountMinor))).toBe(amount);
        // Доли отличаются не больше чем на одну минорную единицу.
        const amounts = shares.map((s) => s.amountMinor);
        expect(Math.max(...amounts) - Math.min(...amounts)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("отвергает некорректный ввод", () => {
    expect(() => splitEqually(100, [])).toThrow();
    expect(() => splitEqually(10.5, ["a"])).toThrow();
    expect(() => splitEqually(-100, ["a"])).toThrow();
    expect(() => splitEqually(2_000_000_000, ["a"])).toThrow();
  });
});

describe("splitManual", () => {
  it("фиксирует ручную долю и делит остаток поровну", () => {
    const shares = splitManual(10_000, ["a", "b", "c"], new Map([["a", 4000]]));

    expect(shares).toEqual([
      { memberId: "a", amountMinor: 4000 },
      { memberId: "b", amountMinor: 3000 },
      { memberId: "c", amountMinor: 3000 },
    ]);
    expect(checkShares(10_000, shares).ok).toBe(true);
  });

  it("возвращает ручные доли как есть, когда заданы все", () => {
    const overrides = new Map([
      ["a", 5000],
      ["b", 3000],
      ["c", 2000],
    ]);
    const shares = splitManual(10_000, ["a", "b", "c"], overrides);
    expect(checkShares(10_000, shares).ok).toBe(true);
  });

  it("не уходит в минус, если ручные доли перебрали чек", () => {
    const shares = splitManual(10_000, ["a", "b"], new Map([["a", 12_000]]));

    expect(shares).toEqual([
      { memberId: "a", amountMinor: 12_000 },
      { memberId: "b", amountMinor: 0 },
    ]);
    // Форма должна показать перебор, а не молча его проглотить.
    expect(checkShares(10_000, shares)).toEqual({
      ok: false,
      totalMinor: 12_000,
      diffMinor: -2000,
    });
  });

  it("сообщает, сколько ещё осталось распределить", () => {
    const shares = [
      { memberId: "a", amountMinor: 3000 },
      { memberId: "b", amountMinor: 3000 },
    ];
    expect(checkShares(10_000, shares)).toEqual({
      ok: false,
      totalMinor: 6000,
      diffMinor: 4000,
    });
  });
});

describe("computeBalances", () => {
  it("считает классический случай: один заплатил за всех", () => {
    const expenses: Expense[] = [
      { paidByMemberId: "a", amountMinor: 3000, shares: splitEqually(3000, ["a", "b", "c"]) },
    ];

    const balances = computeBalances(["a", "b", "c"], expenses, []);

    expect(net(balances)).toEqual({ a: 2000, b: -1000, c: -1000 });
  });

  it("учитывает расход, в котором плательщик не участвует", () => {
    // Один оплатил экскурсию, на которую сам не пошёл.
    const expenses: Expense[] = [
      { paidByMemberId: "a", amountMinor: 3000, shares: splitEqually(3000, ["b", "c"]) },
    ];

    const balances = computeBalances(["a", "b", "c"], expenses, []);

    expect(net(balances)).toEqual({ a: 3000, b: -1500, c: -1500 });
  });

  it("уменьшает долг отмеченным переводом", () => {
    const expenses: Expense[] = [
      { paidByMemberId: "a", amountMinor: 3000, shares: splitEqually(3000, ["a", "b", "c"]) },
    ];
    const settlements: Settlement[] = [
      { fromMemberId: "b", toMemberId: "a", amountMinor: 1000 },
    ];

    const balances = computeBalances(["a", "b", "c"], expenses, settlements);

    expect(net(balances)).toEqual({ a: 1000, b: 0, c: -1000 });
  });

  it("показывает участника без расходов с нулями, а не пропускает его", () => {
    const balances = computeBalances(["a", "b"], [], []);

    expect(balances).toHaveLength(2);
    expect(balances[0]).toEqual({
      memberId: "a",
      paidMinor: 0,
      shareMinor: 0,
      sentMinor: 0,
      receivedMinor: 0,
      netMinor: 0,
    });
  });

  it("разносит «заплатил» и «потратил на себя» по отдельности", () => {
    const expenses: Expense[] = [
      { paidByMemberId: "a", amountMinor: 3000, shares: splitEqually(3000, ["a", "b", "c"]) },
      { paidByMemberId: "b", amountMinor: 1500, shares: splitEqually(1500, ["a", "b", "c"]) },
    ];

    const balances = computeBalances(["a", "b", "c"], expenses, []);
    const a = balances.find((b) => b.memberId === "a")!;

    expect(a.paidMinor).toBe(3000);
    expect(a.shareMinor).toBe(1500);
    expect(totalSpent(expenses)).toBe(4500);
  });
});

describe("simplifyTransfers", () => {
  it("сводит долги к переводам напрямую кредитору", () => {
    const balances = computeBalances(
      ["a", "b", "c"],
      [{ paidByMemberId: "a", amountMinor: 3000, shares: splitEqually(3000, ["a", "b", "c"]) }],
      [],
    );

    expect(simplifyTransfers(balances)).toEqual([
      { fromMemberId: "b", toMemberId: "a", amountMinor: 1000 },
      { fromMemberId: "c", toMemberId: "a", amountMinor: 1000 },
    ]);
  });

  it("не предлагает ничего, когда все в расчёте", () => {
    expect(simplifyTransfers(computeBalances(["a", "b"], [], []))).toEqual([]);
  });

  it("исключает из расчёта того, кто вышел в ноль", () => {
    // B заплатил ровно свою долю по всей поездке — ему никто ничего не должен
    // и он никому. Вместо трёх встречных переводов остаётся один.
    const expenses: Expense[] = [
      { paidByMemberId: "a", amountMinor: 3000, shares: splitEqually(3000, ["a", "b", "c"]) },
      { paidByMemberId: "b", amountMinor: 1500, shares: splitEqually(1500, ["a", "b", "c"]) },
    ];

    const transfers = simplifyTransfers(computeBalances(["a", "b", "c"], expenses, []));

    expect(transfers).toEqual([{ fromMemberId: "c", toMemberId: "a", amountMinor: 1500 }]);
  });

  it("даёт одинаковый результат при повторном расчёте", () => {
    const balances = makeBalances({ a: 5000, b: 5000, c: -4000, d: -6000 });

    expect(simplifyTransfers(balances)).toEqual(simplifyTransfers(balances));
  });

  it("не зависит от порядка участников на входе", () => {
    const balances = makeBalances({ a: 5000, b: 5000, c: -4000, d: -6000 });
    const shuffled = [...balances].reverse();

    expect(simplifyTransfers(shuffled)).toEqual(simplifyTransfers(balances));
  });
});

describe("инварианты на случайных поездках", () => {
  it("держит баланс, лимит переводов и сходимость сумм", () => {
    const random = makeRandom(20_260_909);

    for (let iteration = 0; iteration < 300; iteration += 1) {
      const memberCount = 1 + Math.floor(random() * 8);
      const memberIds = Array.from({ length: memberCount }, (_, i) => `m${i}`);

      const expenses: Expense[] = [];
      const expenseCount = Math.floor(random() * 10);
      for (let i = 0; i < expenseCount; i += 1) {
        const amountMinor = 1 + Math.floor(random() * 500_000);
        const participants = memberIds.filter(() => random() > 0.3);
        if (participants.length === 0) continue;

        const shares = splitEqually(amountMinor, participants);
        // Сумма долей обязана совпадать с чеком при любом делении.
        expect(sum(shares.map((s) => s.amountMinor))).toBe(amountMinor);

        expenses.push({
          paidByMemberId: memberIds[Math.floor(random() * memberCount)],
          amountMinor,
          shares,
        });
      }

      const balances = computeBalances(memberIds, expenses, []);

      // Деньги не появляются и не исчезают: сумма всех балансов равна нулю.
      expect(sum(balances.map((b) => b.netMinor))).toBe(0);

      const transfers = simplifyTransfers(balances);

      // Переводов не больше, чем участников минус один.
      expect(transfers.length).toBeLessThanOrEqual(Math.max(0, memberCount - 1));

      // Переводы гасят долги ровно в ноль, ничего не оставляя и не переплачивая.
      const settled = computeBalances(memberIds, expenses, transfers);
      expect(settled.every((b) => b.netMinor === 0)).toBe(true);

      // Все суммы переводов положительные.
      expect(transfers.every((t) => t.amountMinor > 0)).toBe(true);
    }
  });
});

function net(balances: Balance[]): Record<MemberId, number> {
  return Object.fromEntries(balances.map((b) => [b.memberId, b.netMinor]));
}

function makeBalances(nets: Record<MemberId, number>): Balance[] {
  return Object.entries(nets).map(([memberId, netMinor]) => ({
    memberId,
    paidMinor: Math.max(0, netMinor),
    shareMinor: Math.max(0, -netMinor),
    sentMinor: 0,
    receivedMinor: 0,
    netMinor,
  }));
}

/** Детерминированный ГПСЧ, чтобы падение теста всегда воспроизводилось. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
