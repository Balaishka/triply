import { plural } from "@/lib/plural";
import type { Mail } from "@/lib/mail/types";

/**
 * Тексты писем.
 *
 * Собраны в одном месте по той же причине, что и строки интерфейса: письмо —
 * такой же экран приложения, только показанный в чужом почтовом клиенте.
 */

export function passwordResetMail(params: {
  to: string;
  nickname: string;
  url: string;
  ttlMinutes: number;
}): Mail {
  const { to, nickname, url, ttlMinutes } = params;
  const life = `${ttlMinutes} ${plural(ttlMinutes, "минуту", "минуты", "минут")}`;

  const text = [
    `Здравствуйте, ${nickname}!`,
    "",
    "Кто-то — надеемся, вы — попросил сменить пароль в Triply.",
    "Новый пароль можно задать по ссылке:",
    "",
    url,
    "",
    `Ссылка живёт ${life} и срабатывает один раз.`,
    "",
    "Если пароль вы не забывали, просто удалите это письмо: без перехода",
    "по ссылке ничего не изменится.",
    "",
    "Triply — считайте закаты, а не чеки",
  ].join("\n");

  return {
    to,
    subject: "Восстановление пароля в Triply",
    text,
    html: layout(
      [
        `<p style="margin:0 0 16px">Здравствуйте, ${escapeHtml(nickname)}!</p>`,
        `<p style="margin:0 0 24px">Кто-то — надеемся, вы — попросил сменить пароль в Triply.</p>`,
        button(url, "Задать новый пароль"),
        `<p style="margin:24px 0 8px;color:#5f6b66;font-size:14px">Ссылка живёт ${life} и срабатывает один раз. Если кнопка не открывается, скопируйте адрес:</p>`,
        `<p style="margin:0 0 24px;font-size:14px;word-break:break-all"><a href="${escapeHtml(url)}" style="color:#123c35">${escapeHtml(url)}</a></p>`,
        `<p style="margin:0;color:#5f6b66;font-size:14px">Если пароль вы не забывали, просто удалите это письмо: без перехода по ссылке ничего не изменится.</p>`,
      ].join(""),
    ),
  };
}

/**
 * Обёртка письма.
 *
 * Вёрстка нарочно древняя — таблица, инлайновые стили, никаких внешних
 * картинок: почтовые клиенты вырезают всё остальное.
 */
function layout(content: string): string {
  return [
    '<!doctype html><html lang="ru"><body style="margin:0;padding:24px;background:#f7f4ec;',
    'font-family:Helvetica,Arial,sans-serif;color:#17201e">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ',
    'style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px">',
    '<tr><td style="padding:24px">',
    '<p style="margin:0 0 20px;font-size:20px;font-weight:800;color:#123c35">Triply</p>',
    content,
    "</td></tr></table></body></html>",
  ].join("");
}

function button(url: string, label: string): string {
  return (
    `<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;` +
    `background:#ff6b35;color:#ffffff;font-weight:700;text-decoration:none">${escapeHtml(label)}</a>`
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
