"use client";

import { useState, useTransition } from "react";

import { Avatar, AvatarGlyph } from "@/components/ui/avatar";
import { setAvatarAction } from "@/lib/actions/profile";
import { AVATAR_PRESETS } from "@/lib/avatars";
import { cn } from "@/lib/cn";

/**
 * Выбор аватарки из набора.
 *
 * Выбранное показывается сразу, не дожидаясь сервера: ответ ничего не решает —
 * либо картинка из списка сохранится, либо запрос вовсе не дойдёт. Первая
 * клетка — инициалы: так «убрать картинку» остаётся в том же ряду, что и
 * выбор, вместо отдельной кнопки под ним.
 */
export function AvatarPicker({ nickname, avatar }: { nickname: string; avatar: string | null }) {
  const [chosen, setChosen] = useState(avatar);
  const [pending, startTransition] = useTransition();

  function choose(id: string | null) {
    if (id === chosen) return;
    setChosen(id);
    startTransition(() => void setAvatarAction(id));
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar name={nickname} avatar={chosen} size="lg" />
        <p className="text-sm text-muted-foreground">
          По ней вас узнают друзья и участники поездок.
        </p>
      </div>

      <div
        className={cn(
          "flex flex-wrap gap-2",
          pending && "opacity-70 transition-opacity",
        )}
      >
        <PickerCell
          label="Инициалы"
          selected={chosen === null}
          onSelect={() => choose(null)}
        >
          <Avatar name={nickname} size="md" />
        </PickerCell>

        {AVATAR_PRESETS.map((preset) => (
          <PickerCell
            key={preset.id}
            label={preset.label}
            selected={chosen === preset.id}
            onSelect={() => choose(preset.id)}
          >
            <span
              className="flex size-10 items-center justify-center rounded-full text-primary-foreground"
              style={{ backgroundColor: preset.color }}
            >
              <AvatarGlyph preset={preset} />
            </span>
          </PickerCell>
        ))}
      </div>
    </section>
  );
}

function PickerCell({
  label,
  selected,
  onSelect,
  children,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "size-10 shrink-0 rounded-full ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-ring",
      )}
    >
      {children}
    </button>
  );
}
