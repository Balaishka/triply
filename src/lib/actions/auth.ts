"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { hashPassword, verifyAgainstDecoy, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fieldErrorsFrom, type FormState } from "@/lib/actions/form-state";
import { loginSchema, registerSchema } from "@/lib/validation";

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
