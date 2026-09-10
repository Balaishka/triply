import { randomBytes } from "node:crypto";

import { buildMessage } from "@/lib/mail/message";
import { sendSmtp } from "@/lib/mail/smtp";
import type { Mail, MailTransport } from "@/lib/mail/types";

/**
 * Выбор способа доставки по окружению.
 *
 * Без настроек в разработке письмо печатается в консоль сервера: восстановление
 * пароля работает сразу после `git clone`, без почтового сервера под рукой. В
 * продакшене та же ситуация — ошибка: молча терять письма хуже, чем упасть.
 */
const DEFAULT_FROM = "Triply <no-reply@triply.local>";

export function createTransport(): MailTransport {
  const host = process.env.MAIL_SMTP_HOST?.trim();

  if (!host) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Не задан MAIL_SMTP_HOST — писать письма некуда");
    }
    return consoleTransport;
  }

  const secure = isTrue(process.env.MAIL_SMTP_SECURE);
  const user = process.env.MAIL_SMTP_USER?.trim() || undefined;

  return {
    name: "smtp",
    async send(mail) {
      await sendSmtp(
        {
          host,
          port: Number(process.env.MAIL_SMTP_PORT ?? (secure ? 465 : 587)),
          secure,
          user,
          password: user ? process.env.MAIL_SMTP_PASSWORD : undefined,
        },
        {
          from: mailboxOf(mailFrom()),
          to: mailboxOf(mail.to),
          message: render(mail),
        },
      );
    },
  };
}

/**
 * Транспорт для разработки: письмо целиком уходит в лог сервера.
 *
 * Ссылку из письма видно в терминале — этого хватает, чтобы пройти весь
 * сценарий восстановления, ничего не настраивая.
 */
const consoleTransport: MailTransport = {
  name: "console",
  async send(mail) {
    console.info(
      [
        "",
        "─── Письмо (почта не настроена, показываем здесь) ───",
        `Кому:  ${mail.to}`,
        `Тема:  ${mail.subject}`,
        "",
        mail.text,
        "─────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  },
};

/** Готовое письмо со всеми заголовками. */
export function render(mail: Mail): string {
  return buildMessage(mail, {
    from: mailFrom(),
    date: new Date(),
    messageId: `${randomBytes(16).toString("hex")}@${domainOf(mailFrom())}`,
    boundary: `triply-${randomBytes(12).toString("hex")}`,
  });
}

export function mailFrom(): string {
  return process.env.MAIL_FROM?.trim() || DEFAULT_FROM;
}

/** Голый адрес из строки вида «Triply <no-reply@example.org>». */
export function mailboxOf(address: string): string {
  const match = /<([^>]+)>/.exec(address);
  return (match ? match[1] : address).trim();
}

function domainOf(address: string): string {
  return mailboxOf(address).split("@")[1] ?? "triply.local";
}

function isTrue(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}
