import type { Mail } from "@/lib/mail/types";

/**
 * Сборка письма по RFC 5322: заголовки, кодировки, MIME.
 *
 * Чистая функция без сети — её поведение проверяется тестами, а транспорт
 * занимается только доставкой готовой строки.
 */

const CRLF = "\r\n";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export interface MessageOptions {
  /** Отправитель: «Triply <no-reply@example.org>» или голый адрес. */
  from: string;
  date: Date;
  /** Значение для Message-ID, без угловых скобок. */
  messageId: string;
  /** Разделитель частей multipart-письма. Нужен, только если есть HTML. */
  boundary: string;
}

export function buildMessage(mail: Mail, options: MessageOptions): string {
  const headers = [
    `From: ${encodeAddress(options.from)}`,
    `To: ${encodeAddress(mail.to)}`,
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${formatDate(options.date)}`,
    `Message-ID: <${sanitize(options.messageId)}>`,
    "MIME-Version: 1.0",
  ];

  if (!mail.html) {
    return [
      ...headers,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodeBody(mail.text),
    ].join(CRLF);
  }

  // multipart/alternative: почтовый клиент показывает HTML, а всё, что его не
  // умеет — от текстового клиента до предпросмотра в уведомлении — читает
  // текстовую версию.
  const boundary = sanitize(options.boundary);
  return [
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBody(mail.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodeBody(mail.html),
    `--${boundary}--`,
  ].join(CRLF);
}

/**
 * Тело письма в base64 строками по 76 символов.
 *
 * base64 выбран не ради экономии: он разом решает и русский текст, и длинные
 * строки, и запрет на точку в начале строки внутри SMTP-данных.
 */
export function encodeBody(text: string): string {
  const encoded = Buffer.from(text, "utf8").toString("base64");
  const lines: string[] = [];
  for (let at = 0; at < encoded.length; at += 76) {
    lines.push(encoded.slice(at, at + 76));
  }
  return lines.join(CRLF);
}

/**
 * Значение заголовка. Кириллица кодируется по RFC 2047 кусками, которые
 * укладываются в предел длины строки и не разрезают символ пополам.
 */
export function encodeHeader(value: string): string {
  const clean = sanitize(value);
  if (isAscii(clean)) return clean;

  // 30 байт исходного текста дают 40 символов base64 — вместе с обёрткой
  // «=?utf-8?B?…?=» это заметно меньше предельных 75 символов.
  const words: string[] = [];
  let chunk = "";
  for (const character of clean) {
    if (Buffer.byteLength(chunk + character, "utf8") > 30) {
      words.push(encodeWord(chunk));
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) words.push(encodeWord(chunk));

  // Перенос строки внутри заголовка — CRLF плюс пробел: так почтовые клиенты
  // склеивают куски обратно без лишнего пробела между ними.
  return words.join(`${CRLF} `);
}

/**
 * Адрес отправителя или получателя.
 *
 * Кодируется только имя: сам адрес обязан остаться голым ASCII, иначе сервер
 * его не примет.
 */
export function encodeAddress(address: string): string {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(sanitize(address));
  if (!match) return sanitize(address).trim();

  const [, name, mailbox] = match;
  if (!name) return `<${mailbox.trim()}>`;
  return `${encodeHeader(name)} <${mailbox.trim()}>`;
}

/** Дата в формате RFC 5322. Всегда в UTC — часовой пояс сервера ни при чём. */
export function formatDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${DAYS[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ` +
    `${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:` +
    `${pad(date.getUTCSeconds())} +0000`
  );
}

/**
 * Перевод строки в заголовке — это подделка письма: всё после него сервер
 * читает как новый заголовок. Поэтому переносы вырезаются до кодирования.
 */
function sanitize(value: string): string {
  return value.replace(/[\r\n]+/g, " ");
}

/** Печатный ASCII — единственное, что можно писать в заголовок как есть. */
function isAscii(value: string): boolean {
  return /^[\x20-\x7E]*$/.test(value);
}

function encodeWord(chunk: string): string {
  return `=?utf-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`;
}
