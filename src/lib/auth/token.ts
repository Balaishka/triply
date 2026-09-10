import { createHash, randomBytes } from "node:crypto";

/**
 * Секреты, которые живут у пользователя, а в базе лежат только хешем: токен
 * сессии и ссылка восстановления пароля.
 *
 * Токен случайный на 256 бит, поэтому хеш без соли здесь достаточен —
 * перебирать нечего. Быстрый SHA-256 при этом позволяет искать запись по хешу
 * обычным уникальным индексом.
 */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
