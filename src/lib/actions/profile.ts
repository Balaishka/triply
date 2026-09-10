"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { fieldErrorsFrom, type FormState } from "@/lib/actions/form-state";
import { appUrl } from "@/lib/app-url";
import { isAvatarId } from "@/lib/avatars";
import { clearEmailChanges, createEmailChange } from "@/lib/auth/email-change";
import { confirmEmailPath, EMAIL_CHANGE_TTL_MINUTES } from "@/lib/auth/email-change-link";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/require-user";
import { deleteOtherSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { fromISODate } from "@/lib/dates";
import { emailChangeMail, sendMail } from "@/lib/mail";
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

/**
 * Выбор аватарки из набора.
 *
 * Загружать нечего: в базу уходит идентификатор картинки, а `null` возвращает
 * инициалы. Неизвестный идентификатор — это подделанная форма, а не выбор
 * человека, поэтому проверяем его здесь, а не полагаемся на список в разметке.
 */
export async function setAvatarAction(avatar: string | null): Promise<FormState> {
  const user = await requireUser();

  if (avatar !== null && !isAvatarId(avatar)) {
    return { error: "Такой картинки нет" };
  }

  await prisma.user.update({ where: { id: user.id }, data: { avatar } });

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return null;
}

/**
 * Заявка на смену почты.
 *
 * Сам адрес здесь не меняется: пароль подтверждает, что смену затеял хозяин
 * аккаунта, а письмо на новый адрес — что этот адрес существует и читает его
 * тот же человек. До перехода по ссылке вход остаётся по прежней почте, и
 * опечатка больше не стоит доступа.
 */
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

  // Занятость адреса проверяем сразу, хотя последнее слово всё равно за
  // уникальным индексом при подтверждении: гонять человека к почтовому ящику
  // ради заведомо невозможной смены незачем.
  const taken = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (taken) return { fieldErrors: { email: "На эту почту уже есть аккаунт" } };

  const token = await createEmailChange(user.id, parsed.data.email);
  if (!token) {
    return { error: "Письмо только что ушло. Следующее можно запросить через минуту." };
  }

  try {
    await sendMail(
      emailChangeMail({
        to: parsed.data.email,
        nickname: user.nickname,
        url: appUrl(confirmEmailPath(token)),
        ttlMinutes: EMAIL_CHANGE_TTL_MINUTES,
      }),
    );
  } catch (error) {
    // Здесь, в отличие от восстановления пароля, молчать не нужно: человек
    // вошёл в аккаунт и меняет собственный адрес — скрывать от него нечего.
    // Заявку убираем: подтвердить её всё равно нечем.
    console.error("Не удалось отправить письмо подтверждения почты", error);
    await clearEmailChanges(user.id);
    return { error: "Письмо не отправилось. Попробуйте ещё раз чуть позже." };
  }

  revalidatePath("/profile");
  return {
    success: `Письмо ушло на ${parsed.data.email}. Вход сменится, когда вы перейдёте по ссылке из него.`,
  };
}

/** Отмена начатой смены: ссылка из письма перестаёт работать. */
export async function cancelEmailChangeAction(): Promise<FormState> {
  const user = await requireUser();

  await clearEmailChanges(user.id);

  revalidatePath("/profile");
  return null;
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

  // Заодно отменяем начатую смену почты: если пароль меняют из-за утечки, то
  // заявку мог завести чужой — и подтвердил бы её из своего ящика уже после.
  await clearEmailChanges(user.id);

  // Остальные устройства разлогиниваются — в этом половина смысла смены пароля,
  // когда её делают из-за подозрения на утечку. Текущая сессия остаётся: иначе
  // человека выбрасывало бы из приложения ровно в тот момент, когда он всё
  // сделал правильно.
  await deleteOtherSessions(user.id);

  return { success: "Пароль изменён. На других устройствах нужно войти заново." };
}
