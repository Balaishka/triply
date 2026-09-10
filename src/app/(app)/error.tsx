"use client";

import { Button } from "@/components/ui/button";

/**
 * Экран ошибки для страниц приложения.
 *
 * Показываем не текст исключения, а понятное объяснение и кнопку повтора:
 * сообщения вроде «P2002 unique constraint failed» пользователю ничего не дают.
 */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div>
        <p className="text-lg font-bold">Что-то сломалось</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Данные не загрузились. Попробуйте ещё раз — если повторится, проверьте соединение.
        </p>
      </div>
      <Button type="button" onClick={reset}>
        Попробовать снова
      </Button>
    </div>
  );
}
