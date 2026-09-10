"use client";

import { useActionState, useMemo, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Label, Select } from "@/components/ui/field";
import type { FormState } from "@/lib/actions/form-state";
import { todayISO } from "@/lib/dates";
import { formatAmount, formatMoney, parseAmount } from "@/lib/money";
import type { TripMemberView } from "@/lib/queries/trips";
import { checkShares, MAX_AMOUNT_MINOR, splitEqually, splitManual } from "@/lib/settlement";

export interface ExpenseFormValues {
  title: string;
  amountText: string;
  spentAt: string;
  paidByMemberId: string;
  /** Доли из базы: по ним восстанавливается, кто участвовал и что правили руками. */
  shares: Array<{ memberId: string; amountMinor: number }>;
  splitMode: "EQUAL" | "MANUAL";
}

export function ExpenseForm({
  action,
  members,
  currency,
  initial,
  submitLabel,
  pendingLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  members: TripMemberView[];
  currency: string;
  initial?: ExpenseFormValues;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [amountText, setAmountText] = useState(initial?.amountText ?? "");
  const [spentAt, setSpentAt] = useState(initial?.spentAt ?? todayISO());
  const [paidBy, setPaidBy] = useState(
    initial?.paidByMemberId ?? members.find((member) => member.isMe)?.id ?? members[0]?.id ?? "",
  );

  // По умолчанию расход делится на всех: так чаще всего и бывает, а лишних
  // участников проще снять, чем набрать всех заново.
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        initial ? initial.shares.map((share) => share.memberId) : members.map((member) => member.id),
      ),
  );

  // Доли, которые правили руками. Пустая карта означает «делим поровну».
  const [manual, setManual] = useState<Record<string, string>>(() => {
    if (initial?.splitMode !== "MANUAL") return {};
    return Object.fromEntries(
      initial.shares.map((share) => [share.memberId, formatAmount(share.amountMinor, currency)]),
    );
  });

  const amountMinor = parseAmount(amountText, currency);
  const amountValid = amountMinor !== null && amountMinor > 0 && amountMinor <= MAX_AMOUNT_MINOR;

  const participants = useMemo(
    () => members.filter((member) => selected.has(member.id)),
    [members, selected],
  );

  const { shares, isManual } = useMemo(() => {
    const ids = participants.map((member) => member.id);
    if (!amountValid || amountMinor === null || ids.length === 0) {
      return { shares: [], isManual: false };
    }

    const overrides = new Map<string, number>();
    for (const id of ids) {
      const raw = manual[id];
      if (raw === undefined || raw === "") continue;
      const parsed = parseAmount(raw, currency);
      if (parsed !== null) overrides.set(id, parsed);
    }

    if (overrides.size === 0) {
      return { shares: splitEqually(amountMinor, ids), isManual: false };
    }
    return { shares: splitManual(amountMinor, ids, overrides), isManual: true };
  }, [participants, amountMinor, amountValid, manual, currency]);

  const balance = checkShares(amountMinor ?? 0, shares);
  const shareByMember = new Map(shares.map((share) => [share.memberId, share.amountMinor]));

  const canSubmit =
    title.trim().length > 0 && amountValid && participants.length > 0 && balance.ok && !pending;

  function toggleMember(memberId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
    // Снятый участник не должен тянуть за собой свою ручную долю.
    setManual((current) => {
      if (!(memberId in current)) return current;
      const next = { ...current };
      delete next[memberId];
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError>{state?.error}</FormError>

      <input type="hidden" name="amountMinor" value={amountValid ? String(amountMinor) : ""} />
      <input type="hidden" name="shares" value={JSON.stringify(shares)} />
      <input type="hidden" name="splitMode" value={isManual ? "MANUAL" : "EQUAL"} />

      <Field label="На что" htmlFor="title" error={state?.fieldErrors?.title}>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ужин в Тбилиси"
          required
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Сколько" htmlFor="amount" error={state?.fieldErrors?.amountMinor}>
          <Input
            id="amount"
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="0"
            required
          />
        </Field>
        <Field label="Когда" htmlFor="spentAt" error={state?.fieldErrors?.spentAt}>
          <Input
            id="spentAt"
            name="spentAt"
            type="date"
            value={spentAt}
            onChange={(event) => setSpentAt(event.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Кто платил" htmlFor="paidByMemberId" error={state?.fieldErrors?.paidByMemberId}>
        <Select
          id="paidByMemberId"
          name="paidByMemberId"
          value={paidBy}
          onChange={(event) => setPaidBy(event.target.value)}
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.isMe ? member.name + " (вы)" : member.name}
            </option>
          ))}
        </Select>
      </Field>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Между кем делим</Label>
          {isManual && (
            <button
              type="button"
              onClick={() => setManual({})}
              className="text-sm font-semibold text-primary underline underline-offset-2"
            >
              Поровну
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {members.map((member, index) => {
            const isSelected = selected.has(member.id);
            const computed = shareByMember.get(member.id);

            return (
              <div
                key={member.id}
                className={
                  "flex items-center gap-3 px-3 py-2.5" +
                  (index > 0 ? " border-t border-border" : "")
                }
              >
                <input
                  type="checkbox"
                  id={"member-" + member.id}
                  checked={isSelected}
                  onChange={() => toggleMember(member.id)}
                  className="size-5 shrink-0 accent-[var(--primary)]"
                />
                <label
                  htmlFor={"member-" + member.id}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <Avatar name={member.name} src={member.avatarUrl} size="sm" />
                  <span className="truncate text-sm font-semibold">
                    {member.isMe ? "Вы" : member.name}
                  </span>
                </label>

                <Input
                  aria-label={"Доля: " + member.name}
                  inputMode="decimal"
                  disabled={!isSelected}
                  value={manual[member.id] ?? ""}
                  placeholder={
                    isSelected && computed !== undefined ? formatAmount(computed, currency) : "—"
                  }
                  onChange={(event) =>
                    setManual((current) => ({ ...current, [member.id]: event.target.value }))
                  }
                  className="tabular h-9 w-28 shrink-0 px-2 text-right text-sm"
                />
              </div>
            );
          })}
        </div>

        <SplitStatus
          amountValid={amountValid}
          participantCount={participants.length}
          diffMinor={balance.diffMinor}
          isManual={isManual}
          currency={currency}
        />
        {state?.fieldErrors?.shares && (
          <p className="text-sm text-destructive">{state.fieldErrors.shares}</p>
        )}
      </section>

      <Button type="submit" size="lg" variant="accent" disabled={!canSubmit}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

/**
 * Строка состояния под списком участников.
 *
 * Главное здесь — расхождение: пока доли не сходятся с чеком, отправить нельзя,
 * и человеку нужно видеть не абстрактную ошибку, а сколько именно осталось
 * распределить.
 */
function SplitStatus({
  amountValid,
  participantCount,
  diffMinor,
  isManual,
  currency,
}: {
  amountValid: boolean;
  participantCount: number;
  diffMinor: number;
  isManual: boolean;
  currency: string;
}) {
  if (!amountValid) {
    return <p className="text-sm text-muted-foreground">Укажите сумму — доли посчитаются сами.</p>;
  }
  if (participantCount === 0) {
    return <p className="text-sm text-destructive">Выберите хотя бы одного участника.</p>;
  }
  if (diffMinor > 0) {
    return (
      <p className="text-sm text-destructive">
        Осталось распределить {formatMoney(diffMinor, currency)}
      </p>
    );
  }
  if (diffMinor < 0) {
    return <p className="text-sm text-destructive">Перебор на {formatMoney(-diffMinor, currency)}</p>;
  }
  return (
    <p className="text-sm text-muted-foreground">
      {isManual ? "Доли заданы вручную" : "Делится поровну"}
    </p>
  );
}
