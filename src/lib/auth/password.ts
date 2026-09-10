import { randomBytes } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";

/**
 * Параметры argon2id из рекомендаций OWASP: 19 МиБ памяти, 2 прохода.
 * Память здесь важнее числа итераций — именно она делает перебор на видеокартах
 * невыгодным.
 */
const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    // Битый или чужой формат хеша — это неудачный вход, а не падение страницы.
    return false;
  }
}

/**
 * Проверка пароля против заведомо чужого хеша.
 *
 * Нужна, когда пользователя с такой почтой нет: без неё ответ приходит заметно
 * быстрее, и по одному времени отклика можно перебрать, какие адреса
 * зарегистрированы в сервисе.
 */
let decoyHash: Promise<string> | null = null;

export function verifyAgainstDecoy(password: string): Promise<boolean> {
  decoyHash ??= hashPassword(randomBytes(32).toString("hex"));
  return decoyHash.then((decoy) => verifyPassword(decoy, password));
}
