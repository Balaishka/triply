"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { appUrl } from "@/lib/app-url";
import { hashPassword, verifyAgainstDecoy, verifyPassword } from "@/lib/auth/password";
import {
  clearPasswordResets,
  createPasswordReset,
  findPasswordReset,
} from "@/lib/auth/password-reset";
import { RESET_TTL_MINUTES, resetPath } from "@/lib/auth/reset-link";
import { createSession, deleteAllSessions, destroySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fieldErrorsFrom, type FormState } from "@/lib/actions/form-state";
import { passwordResetMail, sendMail } from "@/lib/mail";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";

const BROKEN_LINK = "Ссылка устарела или уже использована. Запросите новую.";
const RESET_SENT =
  "Если аккаунт с такой почтой есть, письмо со ссылкой уже летит. Проверьте и папку со спамом.";

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    nickname: formData.get("nickname"),
    password: formData.get("password"),
  });

  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const { email, nickname, password } = parsed.data;

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { email, nickname, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    userId = user.id;
  } catch (error) {
    // P2002 — нарушение уникальности. Сообщаем, какое именно поле занято:
    // проверять заранее отдельным запросом бессмысленно, между проверкой и
    // вставкой всё равно остаётся зазор.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      if (target.includes("nickname")) {
        return { fieldErrors: { nickname: "Такой никнейм уже занят" } };
      }
      return { fieldErrors: { email: "На эту почту уже есть аккаунт" } };
    }
    throw error;
  }

  await createSession(userId);
  redirect("/");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true },
  });

  // Одинаковый ответ на «нет такой почты» и «неверный пароль»: иначе форма
  // входа превращается в способ узнать, зарегистрирован ли человек. По той же
  // причине для несуществующей почты всё равно считаем хеш — чтобы ответ не
  // приходил заметно быстрее.
  if (!user) {
    await verifyAgainstDecoy(parsed.data.password);
    return { error: "Неверная почта или пароль" };
  }

  if (!(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return { error: "Неверная почта или пароль" };
  }

  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * Заявка на восстановление пароля.
 *
 * Ответ одинаков и когда письмо ушло, и когда такой почты нет: иначе форма
 * восстановления становится способом проверить, зарегистрирован ли человек —
 * ровно то, от чего защищён вход.
 */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, nickname: true },
  });

  if (user) {
    // `null` — письмо этому адресу уже уходило минуту назад. Второе не шлём, но
    // и виду не подаём: снаружи это неотличимо от обычной отправки.
    const token = await createPasswordReset(user.id);

    if (token) {
      try {
        await sendMail(
          passwordResetMail({
            to: user.email,
            nickname: user.nickname,
            url: appUrl(resetPath(token)),
            ttlMinutes: RESET_TTL_MINUTES,
          }),
        );
      } catch (error) {
        // Поломка почты — забота хозяина сервера, а не повод показать в форме,
        // что аккаунт с таким адресом существует.
        console.error("Не удалось отправить письмо восстановления", error);
      }
    }
  }

  return { success: RESET_SENT };
}

/** Новый пароль по ссылке из письма. */
export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errors = fieldErrorsFrom(parsed.error);
    // Про токен пользователю сказать нечего — поля с ним на экране нет.
    if (errors?.fieldErrors?.token) return { error: BROKEN_LINK };
    return errors;
  }

  const reset = await findPasswordReset(parsed.data.token);
  if (!reset) return { error: BROKEN_LINK };

  await prisma.user.update({
    where: { id: reset.userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  // Обе зачистки обязательны: остальные ссылки восстановления перестают
  // работать, а все сессии закрываются — если аккаунтом уже пользовался кто-то
  // чужой, смена пароля должна его выставить.
  await clearPasswordResets(reset.userId);
  await deleteAllSessions(reset.userId);

  redirect("/login?reset=1");
}
