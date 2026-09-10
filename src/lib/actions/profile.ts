"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { fieldErrorsFrom, type FormState } from "@/lib/actions/form-state";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/require-user";
import { deleteOtherSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fromISODate } from "@/lib/dates";
import { deleteAvatar, saveAvatar } from "@/lib/storage";
import { changeEmailSchema, changePasswordSchema, profileSchema } from "@/lib/validation";

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    nickname: formData.get("nickname"),
    birthDate: formData.get("birthDate") ?? "",
    phone: formData.get("phone") ?? "",
  });

  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const { nickname, birthDate, phone } = parsed.data;

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nickname,
        birthDate: birthDate ? fromISODate(birthDate) : null,
        phone: phone ? phone : null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { nickname: "Такой никнейм уже занят" } };
    }
    throw error;
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: "Сохранено" };
}

export async function uploadAvatarAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Выберите файл" };
  }

  const result = await saveAvatar(user.id, file);
  if (result.error) return { error: result.error };

  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: result.url } });

  // Старый файл убираем уже после успешной записи в базу: если бы удалили
  // раньше и запись упала, пользователь остался бы вообще без аватарки.
  await deleteAvatar(previous?.avatarUrl ?? null);

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return null;
}

export async function removeAvatarAction(): Promise<FormState> {
  const user = await requireUser();

  const previous = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarUrl: true },
  });

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  await deleteAvatar(previous?.avatarUrl ?? null);

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return null;
}

export async function changeEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = changeEmailSchema.safeParse({
    email: formData.get("email"),
    currentPassword: formData.get("currentPassword"),
  });

  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, passwordHash: true },
  });
  if (!record) return { error: "Пользователь не найден" };

  if (!(await verifyPassword(record.passwordHash, parsed.data.currentPassword))) {
    return { fieldErrors: { currentPassword: "Неверный пароль" } };
  }

  if (record.email === parsed.data.email) {
    return { success: "Это и есть текущая почта" };
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: { email: parsed.data.email } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { fieldErrors: { email: "На эту почту уже есть аккаунт" } };
    }
    throw error;
  }

  revalidatePath("/profile");
  return { success: "Почта изменена. Входить теперь по новому адресу." };
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });

  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) return { error: "Пользователь не найден" };

  if (!(await verifyPassword(record.passwordHash, parsed.data.currentPassword))) {
    return { fieldErrors: { currentPassword: "Неверный пароль" } };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  // Остальные устройства разлогиниваются — в этом половина смысла смены пароля,
  // когда её делают из-за подозрения на утечку. Текущая сессия остаётся: иначе
  // человека выбрасывало бы из приложения ровно в тот момент, когда он всё
  // сделал правильно.
  await deleteOtherSessions(user.id);

  return { success: "Пароль изменён. На других устройствах нужно войти заново." };
}
