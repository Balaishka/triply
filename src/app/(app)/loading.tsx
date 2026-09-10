/**
 * Заглушка на время загрузки страницы.
 *
 * Серые прямоугольники в форме будущего содержимого вместо крутилки: страница
 * не «прыгает», когда данные приезжают, потому что место под них уже занято.
 */
export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-label="Загрузка" role="status">
      <div className="h-8 w-40 rounded-lg bg-muted" />
      <div className="h-20 rounded-xl bg-muted" />
      <div className="h-16 rounded-xl bg-muted" />
      <div className="h-16 rounded-xl bg-muted" />
    </div>
  );
}
