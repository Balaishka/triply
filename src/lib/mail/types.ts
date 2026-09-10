/** Письмо, каким его видит приложение: без заголовков, кодировок и MIME. */
export interface Mail {
  to: string;
  subject: string;
  text: string;
  /** HTML-версия. Необязательна: текстовая доходит всегда и везде. */
  html?: string;
}

/**
 * Способ доставки. Их два: настоящий SMTP и вывод в лог для разработки —
 * поэтому отправка писем не требует ни почтового сервера под рукой, ни ключей
 * от внешнего сервиса.
 */
export interface MailTransport {
  readonly name: string;
  send(mail: Mail): Promise<void>;
}
