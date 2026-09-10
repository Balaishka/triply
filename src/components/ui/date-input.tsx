"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CONTROL } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  addDaysISO,
  addMonthsISO,
  formatDate,
  formatDateNumeric,
  formatMonthTitle,
  fromISODate,
  monthGridISO,
  monthISO,
  monthOfISO,
  startOfMonthISO,
  todayISO,
  weekdayIndexISO,
  yearOfISO,
} from "@/lib/dates";

type PickerMode = "days" | "months" | "years";

/** Подписи стрелок и заголовка для каждого шага выбора. */
const STEP_LABELS: Record<PickerMode, { back: string; forward: string; title: string }> = {
  days: { back: "Предыдущий месяц", forward: "Следующий месяц", title: "Выбрать месяц" },
  months: { back: "Предыдущий год", forward: "Следующий год", title: "Выбрать год" },
  years: { back: "Предыдущие годы", forward: "Следующие годы", title: "Вернуться к месяцам" },
};

export interface DateInputProps {
  id?: string;
  /** Значение уезжает на сервер скрытым полем — форма работает как с обычным input. */
  name?: string;
  /** Управляемый режим. Пустая строка — дата не выбрана. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Границы выбора в виде `2026-07-12`. */
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Поле даты со своим календарём.
 *
 * Нативный `input[type=date]` показывает календарь, к которому не пускает ни
 * один браузер: ни цвет, ни шрифт, ни начало недели в нём не поменять. Поэтому
 * здесь своя выпадашка — на телефоне она приезжает снизу листом, на широком
 * экране висит под полем.
 *
 * Обязательность (`required`) проверяет сервер: скрытое поле нативную валидацию
 * не запускает, да и полагаться на неё мы всё равно не можем.
 */
export function DateInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  required = false,
  disabled = false,
  placeholder = "дд.мм.гггг",
  className,
}: DateInputProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const selected = value ?? uncontrolled;

  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => selected || todayISO());
  const [anchor, setAnchor] = useState(() => startOfMonthISO(selected || todayISO()));
  // Дни → месяцы → годы. Без шага с годами дата рождения недостижима: до 1990
  // пришлось бы щёлкнуть по стрелке тридцать шесть раз.
  const [mode, setMode] = useState<PickerMode>("days");
  const [pickerYear, setPickerYear] = useState(() => yearOfISO(selected || todayISO()));

  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const blocked = (iso: string) => Boolean((min && iso < min) || (max && iso > max));

  /** Месяц и год гасим только тогда, когда за границы вышли все их дни. */
  const blockedRange = (first: string, last: string) =>
    Boolean((max && first > max) || (min && last < min));

  const blockedMonth = (year: number, month: number) =>
    blockedRange(monthISO(year, month), addDaysISO(monthISO(year, month + 1), -1));

  const blockedYear = (year: number) => blockedRange(`${year}-01-01`, `${year}-12-31`);

  function openCalendar() {
    const start = selected || todayISO();
    setCursor(start);
    setAnchor(startOfMonthISO(start));
    setPickerYear(yearOfISO(start));
    setMode("days");
    setOpen(true);
  }

  function closeCalendar() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function commit(next: string) {
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
    closeCalendar();
  }

  /** Перевести курсор на другой день, подтянув за ним видимый месяц. */
  function moveCursor(iso: string) {
    setCursor(iso);
    setAnchor(startOfMonthISO(iso));
  }

  // Escape закрывает календарь откуда угодно — в том числе с подложки.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Фокус едет за курсором: без этого стрелки не читаются скринридером.
  useEffect(() => {
    if (!open || mode !== "days") return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus();
  }, [open, mode, cursor]);

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (event.key in step) {
      event.preventDefault();
      moveCursor(addDaysISO(cursor, step[event.key]));
    } else if (event.key === "Home") {
      event.preventDefault();
      moveCursor(addDaysISO(cursor, -weekdayIndexISO(cursor)));
    } else if (event.key === "End") {
      event.preventDefault();
      moveCursor(addDaysISO(cursor, 6 - weekdayIndexISO(cursor)));
    } else if (event.key === "PageUp") {
      event.preventDefault();
      moveCursor(addMonthsISO(cursor, -1));
    } else if (event.key === "PageDown") {
      event.preventDefault();
      moveCursor(addMonthsISO(cursor, 1));
    }
  }

  const today = todayISO();
  const visibleMonth = monthOfISO(anchor);
  // Годы показываем страницами по двенадцать — той же сеткой, что и месяцы.
  const yearPage = Math.floor(pickerYear / 12) * 12;

  /** Стрелки листают то, что сейчас на экране: месяц, год или страницу годов. */
  function step(direction: 1 | -1) {
    if (mode === "days") setAnchor(addMonthsISO(anchor, direction));
    else if (mode === "months") setPickerYear((year) => year + direction);
    else setPickerYear((year) => year + direction * 12);
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? closeCalendar() : openCalendar())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          CONTROL,
          "flex items-center justify-between gap-2 text-left",
          open && "border-ring ring-2 ring-ring",
        )}
      >
        <span className={cn("truncate tabular", !selected && "text-muted-foreground")}>
          {selected ? formatDateNumeric(fromISODate(selected)) : placeholder}
        </span>
        <CalendarGlyph />
      </button>

      {name && <input type="hidden" name={name} value={selected} />}

      {open && (
        <>
          {/*
            Подложка ловит клик мимо календаря. На телефоне она ещё и гасит фон:
            лист снизу должен читаться отдельным слоем, а не частью формы.
          */}
          <div
            className="fixed inset-0 z-40 bg-foreground/25 sm:bg-transparent"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Выбор даты"
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-popover p-4",
              "pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(23,32,30,0.18)]",
              "sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-2 sm:w-72",
              "sm:rounded-xl sm:border sm:p-3 sm:shadow-[0_8px_28px_rgba(23,32,30,0.14)]",
            )}
          >
            {/* На телефоне лист во всю ширину, но сетка дней в нём не должна расползаться. */}
            <div className="mx-auto w-full max-w-sm sm:max-w-none">
              <header className="flex items-center justify-between gap-1 pb-3">
                <StepButton label={STEP_LABELS[mode].back} onClick={() => step(-1)}>
                  <Chevron direction="left" />
                </StepButton>

                <button
                  type="button"
                  onClick={() => {
                    if (mode === "days") {
                      setPickerYear(yearOfISO(anchor));
                      setMode("months");
                    } else {
                      setMode(mode === "months" ? "years" : "months");
                    }
                  }}
                  aria-label={STEP_LABELS[mode].title}
                  className={cn(
                    "rounded-lg px-3 py-1 text-sm font-semibold text-foreground transition-colors",
                    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  {mode === "days"
                    ? formatMonthTitle(anchor)
                    : mode === "months"
                      ? pickerYear
                      : `${yearPage}–${yearPage + 11}`}
                </button>

                <StepButton label={STEP_LABELS[mode].forward} onClick={() => step(1)}>
                  <Chevron direction="right" />
                </StepButton>
              </header>

              {mode === "years" ? (
                <div className="grid grid-cols-3 gap-1">
                  {Array.from({ length: 12 }, (_, index) => yearPage + index).map((year) => (
                    <PickerCell
                      key={year}
                      label={String(year)}
                      active={year === yearOfISO(anchor)}
                      disabled={blockedYear(year)}
                      onClick={() => {
                        setPickerYear(year);
                        setMode("months");
                      }}
                    />
                  ))}
                </div>
              ) : mode === "months" ? (
                <div className="grid grid-cols-3 gap-1">
                  {MONTHS_SHORT.map((label, index) => (
                    <PickerCell
                      key={label}
                      label={label}
                      active={pickerYear === yearOfISO(anchor) && index === visibleMonth}
                      disabled={blockedMonth(pickerYear, index)}
                      onClick={() => {
                        setAnchor(monthISO(pickerYear, index));
                        setMode("days");
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div ref={gridRef} role="grid" className="space-y-1" onKeyDown={onGridKeyDown}>
                  <div role="row" className="grid grid-cols-7">
                    {WEEKDAYS_SHORT.map((weekday) => (
                      <div
                        key={weekday}
                        role="columnheader"
                        className="pb-1 text-center text-xs font-semibold text-muted-foreground"
                      >
                        {weekday}
                      </div>
                    ))}
                  </div>

                  {monthGridISO(anchor).map((week) => (
                    <div key={week[0]} role="row" className="grid grid-cols-7 gap-1">
                      {week.map((day) => {
                        const isSelected = day === selected;
                        const outside = monthOfISO(day) !== visibleMonth;

                        return (
                          <div key={day} role="gridcell" aria-selected={isSelected}>
                            <button
                              type="button"
                              data-day={day}
                              disabled={blocked(day)}
                              tabIndex={day === cursor ? 0 : -1}
                              onClick={() => commit(day)}
                              aria-label={formatDate(fromISODate(day))}
                              aria-current={day === today ? "date" : undefined}
                              className={cn(
                                "flex aspect-square w-full items-center justify-center",
                                "rounded-lg text-sm tabular transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                "disabled:pointer-events-none disabled:opacity-30",
                                isSelected
                                  ? "bg-accent font-semibold text-accent-foreground"
                                  : outside
                                    ? "text-muted-foreground/50 hover:bg-muted"
                                    : "text-foreground hover:bg-muted",
                                // Сегодня обведено, а не залито: заливка означает выбор.
                                !isSelected &&
                                  day === today &&
                                  "font-semibold text-primary ring-1 ring-inset ring-primary/40",
                              )}
                            >
                              {Number(day.slice(8))}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              <footer className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={blocked(today)}
                  onClick={() => commit(today)}
                >
                  Сегодня
                </Button>
                {!required && selected && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => commit("")}>
                    Очистить
                  </Button>
                )}
              </footer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Ячейка сетки месяцев и годов — вид у них общий. */
function PickerCell({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-10 rounded-lg text-sm tabular transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-30",
        active
          ? "bg-primary font-semibold text-primary-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-primary transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {children}
    </button>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-5", direction === "right" && "rotate-180")}
      aria-hidden="true"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className="size-5 shrink-0 text-primary/70"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
