import { z } from "zod";

import { CURRENCIES } from "@/lib/money";
import { MAX_AMOUNT_MINOR } from "@/lib/settlement";

/**
 * Схемы ввода. Используются и на клиенте (подсказки в форме), и на сервере
 * (последнее слово всегда за сервером — клиентскую проверку можно обойти).
 */

const nickname = z
  .string()
  .trim()
  .min(3, "Минимум 3 символа")
  .max(24, "Максимум 24 символа")
  .regex(/^[\p{L}\p{N}_.-]+$/u, "Только буквы, цифры, точка, дефис и подчёркивание");

const password = z
  .string()
  .min(8, "Минимум 8 символов")
  .max(128, "Слишком длинный пароль");

const email = z.email("Похоже на неправильный адрес").trim().toLowerCase();

export const registerSchema = z.object({
  email,
  nickname,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Введите пароль"),
});

/**
 * Восстановление пароля.
 *
 * Ответ формы одинаков при любом адресе, поэтому проверять здесь нечего, кроме
 * самого вида адреса.
 */
export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Ссылка неполная — откройте её из письма целиком"),
  password,
});

export const profileSchema = z.object({
  nickname,
  birthDate: z.iso.date().optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(20, "Слишком длинный номер")
    .regex(/^[+\d][\d\s()-]*$/, "Похоже на неправильный номер")
    .optional()
    .or(z.literal("")),
});

/**
 * Смена почты подтверждается паролем.
 *
 * Писем мы не шлём, поэтому опечатка в адресе означала бы потерю доступа —
 * пароль здесь единственная преграда между случайным вводом и потерянным входом.
 */
export const changeEmailSchema = z.object({
  email,
  currentPassword: z.string().min(1, "Введите пароль"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: password,
});

export const tripSchema = z
  .object({
    name: z.string().trim().min(1, "Без названия поездку не найти").max(80, "Слишком длинное название"),
    startDate: z.iso.date().optional().or(z.literal("")),
    endDate: z.iso.date().optional().or(z.literal("")),
    currency: z.string().refine((code) => code in CURRENCIES, "Неизвестная валюта"),
  })
  .refine(
    (trip) => !trip.startDate || !trip.endDate || trip.startDate <= trip.endDate,
    { message: "Дата окончания раньше начала", path: ["endDate"] },
  );

export const expenseSchema = z
  .object({
    title: z.string().trim().min(1, "Назовите расход").max(80, "Слишком длинное название"),
    amountMinor: z
      .number()
      .int("Сумма должна быть целым числом минорных единиц")
      .positive("Сумма должна быть больше нуля")
      .max(MAX_AMOUNT_MINOR, "Слишком большая сумма"),
    paidByMemberId: z.string().min(1, "Укажите, кто платил"),
    spentAt: z.iso.date(),
    shares: z
      .array(
        z.object({
          memberId: z.string().min(1),
          amountMinor: z.number().int().min(0),
        }),
      )
      .min(1, "Выберите хотя бы одного участника"),
    splitMode: z.enum(["EQUAL", "MANUAL"]),
  })
  .refine(
    (expense) => expense.shares.reduce((sum, share) => sum + share.amountMinor, 0) === expense.amountMinor,
    { message: "Сумма долей не совпадает с суммой расхода", path: ["shares"] },
  )
  .refine(
    (expense) => new Set(expense.shares.map((share) => share.memberId)).size === expense.shares.length,
    { message: "Участник указан дважды", path: ["shares"] },
  );

export const guestSchema = z.object({
  guestName: z.string().trim().min(1, "Как его зовут?").max(40, "Слишком длинное имя"),
});
