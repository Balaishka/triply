import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Хранение аватарок.
 *
 * Файлы лежат вне `public`, а отдаются через маршрут `/api/avatars/…`. Так
 * загруженное пользователем не попадает в статику приложения, и позже к выдаче
 * можно добавить проверки, не переделывая хранение.
 */
const STORAGE_DIR = process.env.STORAGE_DIR ?? "./storage";
const AVATARS_DIR = path.join(STORAGE_DIR, "avatars");

/** Больше 5 МБ для аватарки не нужно ни при каком качестве съёмки. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function avatarFilePath(fileName: string): string {
  return path.join(AVATARS_DIR, fileName);
}

/** Имя файла из публичного адреса — с защитой от выхода за пределы каталога. */
export function avatarFileNameFromUrl(url: string | null): string | null {
  if (!url) return null;
  const fileName = url.split("/").pop();
  if (!fileName || !/^[a-zA-Z0-9_-]+\.webp$/.test(fileName)) return null;
  return fileName;
}

export interface SaveAvatarResult {
  url: string;
  error?: undefined;
}

export interface SaveAvatarError {
  url?: undefined;
  error: string;
}

/**
 * Приводит загруженную картинку к квадрату 256×256 и сохраняет в webp.
 *
 * Пережимаем всегда, а не только при превышении размера: так на диск не попадёт
 * ни исходный формат с сюрпризами, ни метаданные вроде геолокации из телефона.
 */
export async function saveAvatar(
  userId: string,
  file: File,
): Promise<SaveAvatarResult | SaveAvatarError> {
  if (file.size === 0) return { error: "Файл пустой" };
  if (file.size > MAX_AVATAR_BYTES) return { error: "Файл больше 5 МБ" };
  if (!ALLOWED_TYPES.has(file.type)) return { error: "Нужен jpeg, png, webp или avif" };

  const input = Buffer.from(await file.arrayBuffer());

  let output: Buffer;
  try {
    output = await sharp(input)
      .rotate() // учитываем EXIF-поворот, иначе фото с телефона ложится набок
      .resize(256, 256, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: "Не удалось прочитать картинку" };
  }

  await mkdir(AVATARS_DIR, { recursive: true });

  // Случайный суффикс в имени: адрес меняется при каждой замене, и браузер не
  // показывает старую аватарку из кеша.
  const fileName = `${userId}-${randomBytes(6).toString("hex")}.webp`;
  await writeFile(avatarFilePath(fileName), output);

  return { url: `/api/avatars/${fileName}` };
}

/** Удаляет прежнюю аватарку. Отсутствие файла — не ошибка. */
export async function deleteAvatar(url: string | null): Promise<void> {
  const fileName = avatarFileNameFromUrl(url);
  if (!fileName) return;
  try {
    await unlink(avatarFilePath(fileName));
  } catch {
    // Файла может уже не быть — это не повод ронять сохранение профиля.
  }
}
