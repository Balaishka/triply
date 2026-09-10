import { LinkButton } from "@/components/ui/link-button";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <p className="text-5xl font-extrabold text-primary">404</p>
      <div>
        <p className="text-lg font-bold">Такой страницы нет</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Возможно, поездку удалили — или вас в ней нет. Чужие поездки Triply не показывает.
        </p>
      </div>
      <LinkButton href="/">К моим поездкам</LinkButton>
    </div>
  );
}
