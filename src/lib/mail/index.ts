import { createTransport } from "@/lib/mail/transport";
import type { Mail } from "@/lib/mail/types";

export type { Mail } from "@/lib/mail/types";
export { passwordResetMail } from "@/lib/mail/templates";

/**
 * Отправка письма.
 *
 * Единственная дверь наружу: остальному приложению не нужно знать ни про SMTP,
 * ни про то, что в разработке письмо просто печатается в консоль.
 */
export async function sendMail(mail: Mail): Promise<void> {
  await createTransport().send(mail);
}
