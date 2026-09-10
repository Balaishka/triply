import type { ZodError } from "zod";

/**
 * Состояние формы для `useActionState`.
 *
 * `fieldErrors` подсвечивают конкретные поля, `error` — общая беда вроде занятой
 * почты. `null` означает «форму ещё не отправляли».
 */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Подтверждение для форм, которые остаются на месте после сохранения. */
  success?: string;
} | null;

/** Превращает ошибки zod в плоскую карту «поле → первое сообщение». */
export function fieldErrorsFrom(error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.join(".") || "form";
    // Показываем только первую ошибку по полю: остальные обычно следствие.
    fieldErrors[field] ??= issue.message;
  }

  return { fieldErrors };
}
