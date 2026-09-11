import { beforeEach, describe, expect, it } from "vitest";

import {
  createExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from "@/lib/actions/expenses";
import { prisma } from "@/lib/db";
import { setUpTestDatabase } from "@/test/db";
import {
  createExpense,
  createTrip,
  createUser,
  equalShares,
  expenseForm,
  signIn,
  signOut,
  type TestTrip,
  type TestUser,
} from "@/test/factories";
import { expectRedirect } from "@/test/redirect";

/**
 * Права и целостность расходов.
 *
 * Доли считает клиент, поэтому сервер проверяет их заново: подделанный запрос
 * не должен ни завести расход в чужой поездке, ни развалить расчёт долями,
 * которые не сходятся с чеком.
 */
setUpTestDatabase();

let anna: TestUser;
let boris: TestUser;
let outsider: TestUser;
let trip: TestTrip;

beforeEach(async () => {
  anna = await createUser("anna");
  boris = await createUser("boris");
  outsider = await createUser("outsider");
  trip = await createTrip({ createdBy: anna, members: [boris] });
  await signIn(anna);
});

function ownExpense(): Promise<string> {
  return createExpense({
    tripId: trip.id,
    createdBy: anna,
    paidByMemberId: trip.members.anna,
    amountMinor: 1000,
    shares: equalShares(1000, [trip.members.anna, trip.members.boris]),
  });
}

describe("посторонний", () => {
  beforeEach(async () => {
    await signIn(outsider);
  });

  it("не заводит расход в чужой поездке", async () => {
    const state = await createExpenseAction(
      trip.id,
      null,
      expenseForm({
        amountMinor: 1000,
        paidByMemberId: trip.members.anna,
        shares: [{ memberId: trip.members.anna, amountMinor: 1000 }],
      }),
    );

    expect(state).toEqual({ error: "Поездка не найдена" });
    expect(await prisma.expense.count()).toBe(0);
  });

  it("не правит и не удаляет чужой расход", async () => {
    const expenseId = await ownExpense();

    expect(
      await updateExpenseAction(
        trip.id,
        expenseId,
        null,
        expenseForm({
          title: "Подменил",
          amountMinor: 1,
          paidByMemberId: trip.members.anna,
          shares: [{ memberId: trip.members.anna, amountMinor: 1 }],
        }),
      ),
    ).toEqual({ error: "Поездка не найдена" });
    expect(await deleteExpenseAction(trip.id, expenseId)).toEqual({ error: "Поездка не найдена" });

    const saved = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: { title: true, amountMinor: true },
    });
    expect(saved).toEqual({ title: "Обед", amountMinor: 1000 });
  });
});

describe("не вошедший", () => {
  it("уходит на вход", async () => {
    const expenseId = await ownExpense();
    signOut();

    expect(await expectRedirect(deleteExpenseAction(trip.id, expenseId))).toBe("/login");
    expect(await prisma.expense.count()).toBe(1);
  });
});

describe("завершённая поездка", () => {
  const closed = "Поездка завершена — сначала откройте её заново";

  it("не принимает ни новых расходов, ни правок, ни удалений", async () => {
    const expenseId = await ownExpense();
    await prisma.trip.update({
      where: { id: trip.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    const form = expenseForm({
      amountMinor: 500,
      paidByMemberId: trip.members.anna,
      shares: [{ memberId: trip.members.anna, amountMinor: 500 }],
    });

    expect(await createExpenseAction(trip.id, null, form)).toEqual({ error: closed });
    expect(await updateExpenseAction(trip.id, expenseId, null, form)).toEqual({ error: closed });
    expect(await deleteExpenseAction(trip.id, expenseId)).toEqual({ error: closed });

    const saved = await prisma.expense.findMany({ select: { amountMinor: true } });
    expect(saved).toEqual([{ amountMinor: 1000 }]);
  });
});

describe("проверка долей на сервере", () => {
  it("не пускает расход, доли которого не сходятся с суммой", async () => {
    const state = await createExpenseAction(
      trip.id,
      null,
      expenseForm({
        amountMinor: 1000,
        paidByMemberId: trip.members.anna,
        shares: [
          { memberId: trip.members.anna, amountMinor: 400 },
          { memberId: trip.members.boris, amountMinor: 400 },
        ],
      }),
    );

    expect(state?.fieldErrors?.shares).toBe("Сумма долей не совпадает с суммой расхода");
    expect(await prisma.expense.count()).toBe(0);
  });

  it("не пускает в доли участника чужой поездки", async () => {
    const other = await createTrip({ createdBy: outsider });

    const state = await createExpenseAction(
      trip.id,
      null,
      expenseForm({
        amountMinor: 1000,
        paidByMemberId: trip.members.anna,
        shares: [
          { memberId: trip.members.anna, amountMinor: 500 },
          { memberId: other.members.outsider, amountMinor: 500 },
        ],
      }),
    );

    expect(state).toEqual({
      fieldErrors: { shares: "Среди участников расхода есть посторонние" },
    });
    expect(await prisma.expenseShare.count()).toBe(0);
  });

  it("не даёт записать плательщиком человека не из поездки", async () => {
    const other = await createTrip({ createdBy: outsider });

    const state = await createExpenseAction(
      trip.id,
      null,
      expenseForm({
        amountMinor: 1000,
        paidByMemberId: other.members.outsider,
        shares: [{ memberId: trip.members.anna, amountMinor: 1000 }],
      }),
    );

    expect(state).toEqual({ fieldErrors: { paidByMemberId: "Этот человек не в поездке" } });
    expect(await prisma.expense.count()).toBe(0);
  });

  it("не принимает одного участника дважды", async () => {
    const state = await createExpenseAction(
      trip.id,
      null,
      expenseForm({
        amountMinor: 1000,
        paidByMemberId: trip.members.anna,
        shares: [
          { memberId: trip.members.anna, amountMinor: 500 },
          { memberId: trip.members.anna, amountMinor: 500 },
        ],
      }),
    );

    expect(state?.fieldErrors?.shares).toBe("Участник указан дважды");
    expect(await prisma.expense.count()).toBe(0);
  });

  it("не принимает испорченный JSON долей", async () => {
    const form = expenseForm({
      amountMinor: 1000,
      paidByMemberId: trip.members.anna,
      shares: [],
    });
    form.set("shares", "[{");

    expect(await createExpenseAction(trip.id, null, form)).toEqual({
      error: "Не удалось разобрать доли",
    });
  });

  // Деньги — только целые минорные единицы: дробная копейка не должна доехать
  // до базы, где поле целое.
  it("не принимает дробную сумму", async () => {
    const state = await createExpenseAction(
      trip.id,
      null,
      expenseForm({
        amountMinor: 10.5,
        paidByMemberId: trip.members.anna,
        shares: [{ memberId: trip.members.anna, amountMinor: 10.5 }],
      }),
    );

    expect(state?.fieldErrors).toBeDefined();
    expect(await prisma.expense.count()).toBe(0);
  });
});

describe("участник поездки", () => {
  it("заводит расход и доли материализуются суммами", async () => {
    const to = await expectRedirect(
      createExpenseAction(
        trip.id,
        null,
        expenseForm({
          title: "Такси",
          amountMinor: 1001,
          paidByMemberId: trip.members.anna,
          shares: equalShares(1001, [trip.members.anna, trip.members.boris]),
        }),
      ),
    );

    expect(to).toBe(`/trips/${trip.id}`);
    const saved = await prisma.expense.findFirstOrThrow({
      select: {
        title: true,
        amountMinor: true,
        splitMode: true,
        shares: { select: { amountMinor: true }, orderBy: { amountMinor: "desc" } },
      },
    });
    expect(saved).toEqual({
      title: "Такси",
      amountMinor: 1001,
      splitMode: "EQUAL",
      shares: [{ amountMinor: 501 }, { amountMinor: 500 }],
    });
  });

  it("правит расход того, кто его не заводил", async () => {
    const expenseId = await ownExpense();
    await signIn(boris);

    const to = await expectRedirect(
      updateExpenseAction(
        trip.id,
        expenseId,
        null,
        expenseForm({
          title: "Ужин",
          amountMinor: 600,
          paidByMemberId: trip.members.boris,
          splitMode: "MANUAL",
          shares: [
            { memberId: trip.members.anna, amountMinor: 200 },
            { memberId: trip.members.boris, amountMinor: 400 },
          ],
        }),
      ),
    );

    expect(to).toBe(`/trips/${trip.id}`);
    const saved = await prisma.expense.findUniqueOrThrow({
      where: { id: expenseId },
      select: { title: true, amountMinor: true, splitMode: true, shares: { select: { id: true } } },
    });
    expect(saved.title).toBe("Ужин");
    expect(saved.amountMinor).toBe(600);
    expect(saved.splitMode).toBe("MANUAL");
    // Доли переписываются целиком, а не добавляются к прежним.
    expect(saved.shares).toHaveLength(2);
  });

  it("не правит расход из другой своей поездки по чужому идентификатору", async () => {
    const other = await createTrip({ createdBy: anna });
    const alien = await createExpense({
      tripId: other.id,
      createdBy: anna,
      paidByMemberId: other.members.anna,
      amountMinor: 700,
      shares: [{ memberId: other.members.anna, amountMinor: 700 }],
    });

    const state = await updateExpenseAction(
      trip.id,
      alien,
      null,
      expenseForm({
        amountMinor: 1,
        paidByMemberId: trip.members.anna,
        shares: [{ memberId: trip.members.anna, amountMinor: 1 }],
      }),
    );

    expect(state).toEqual({ error: "Расход не найден" });
    const saved = await prisma.expense.findUniqueOrThrow({
      where: { id: alien },
      select: { amountMinor: true },
    });
    expect(saved.amountMinor).toBe(700);
  });

  it("удаляет расход вместе с долями", async () => {
    const expenseId = await ownExpense();

    expect(await expectRedirect(deleteExpenseAction(trip.id, expenseId))).toBe(`/trips/${trip.id}`);
    expect(await prisma.expense.count()).toBe(0);
    expect(await prisma.expenseShare.count()).toBe(0);
  });
});
