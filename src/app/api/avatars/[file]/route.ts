import { readFile } from "node:fs/promises";

import { avatarFileNameFromUrl, avatarFilePath } from "@/lib/storage";

/**
 * Отдаёт аватарку из файлового хранилища.
 *
 * Имя файла проверяется по строгому шаблону: без этого `../` в адресе позволил
 * бы прочитать любой файл на диске.
 */
export async function GET(_request: Request, context: RouteContext<"/api/avatars/[file]">) {
  const { file } = await context.params;
  const fileName = avatarFileNameFromUrl(file);
  if (!fileName) return new Response("Not found", { status: 404 });

  try {
    const data = await readFile(avatarFilePath(fileName));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/webp",
        // Имя файла меняется при каждой замене, поэтому кешировать можно надолго.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
