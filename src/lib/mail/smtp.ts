import { connect as netConnect, type Socket } from "node:net";
import { hostname } from "node:os";
import { connect as tlsConnect } from "node:tls";

/**
 * Минимальный SMTP-клиент: одно письмо, один получатель.
 *
 * Своя реализация вместо библиотеки — по той же причине, что и своя авторизация:
 * нужного здесь протокола ровно на страницу кода, а всё остальное в почтовых
 * пакетах (пулы соединений, очереди, вложения, подписи) приложению не пригодится.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const CRLF = "\r\n";

export interface SmtpOptions {
  host: string;
  port: number;
  /** Шифрование с первого байта (обычно порт 465). Иначе пробуем STARTTLS. */
  secure: boolean;
  user?: string;
  password?: string;
  timeoutMs?: number;
}

export interface SmtpEnvelope {
  /** Адрес возврата: голый адрес без имени. */
  from: string;
  to: string;
  /** Готовое письмо целиком — заголовки и тело. */
  message: string;
}

/** Ответ сервера: код и строки без кода в начале. */
interface Reply {
  code: number;
  lines: string[];
}

export async function sendSmtp(options: SmtpOptions, envelope: SmtpEnvelope): Promise<void> {
  const connection = await SmtpConnection.open(options);

  try {
    await connection.expect([220]);

    let capabilities = await ehlo(connection);

    if (!options.secure && capabilities.has("STARTTLS")) {
      await connection.command("STARTTLS", [220]);
      await connection.upgrade(options.host);
      capabilities = await ehlo(connection);
    }

    if (options.user) {
      // Логин и пароль по открытому каналу — это пароль, отданный любому, кто
      // слушает сеть. Если сервер не предложил STARTTLS, отправлять нечего.
      if (!connection.encrypted) {
        throw new Error(
          "SMTP: сервер не поддерживает шифрование, пароль отправлять некуда. " +
            "Нужен порт 465 (MAIL_SMTP_SECURE=1) или сервер со STARTTLS.",
        );
      }
      await authenticate(connection, capabilities, options.user, options.password ?? "");
    }

    await connection.command(`MAIL FROM:<${envelope.from}>`, [250]);
    await connection.command(`RCPT TO:<${envelope.to}>`, [250, 251]);
    await connection.command("DATA", [354]);

    // Точка в начале строки завершает данные, поэтому настоящие точки
    // удваиваются. Тело у нас в base64 и таких строк не даёт, но правило
    // протокола не должно зависеть от того, чем закодировано тело.
    const body = envelope.message.replace(/\r\n\./g, `${CRLF}..`);
    await connection.send(`${body}${CRLF}.${CRLF}`);
    await connection.expect([250]);

    await connection.command("QUIT", [221]).catch(() => {
      // Сервер вправе закрыть соединение, не дожидаясь ответа: письмо уже принято.
    });
  } finally {
    connection.close();
  }
}

async function ehlo(connection: SmtpConnection): Promise<Set<string>> {
  const reply = await connection.command(`EHLO ${clientName()}`, [250]);

  const capabilities = new Set<string>();
  // Первая строка ответа — приветствие сервера, расширения идут следом.
  for (const line of reply.lines.slice(1)) {
    const [keyword, ...rest] = line.trim().toUpperCase().split(/\s+/);
    if (!keyword) continue;
    capabilities.add(keyword);
    // AUTH перечисляет механизмы в той же строке: «AUTH PLAIN LOGIN».
    if (keyword === "AUTH") for (const method of rest) capabilities.add(`AUTH ${method}`);
  }
  return capabilities;
}

async function authenticate(
  connection: SmtpConnection,
  capabilities: Set<string>,
  user: string,
  password: string,
): Promise<void> {
  if (capabilities.has("AUTH PLAIN")) {
    const credentials = Buffer.from(`\0${user}\0${password}`, "utf8").toString("base64");
    await connection.command(`AUTH PLAIN ${credentials}`, [235]);
    return;
  }

  if (capabilities.has("AUTH LOGIN")) {
    await connection.command("AUTH LOGIN", [334]);
    await connection.command(Buffer.from(user, "utf8").toString("base64"), [334]);
    await connection.command(Buffer.from(password, "utf8").toString("base64"), [235]);
    return;
  }

  throw new Error("SMTP: сервер не поддерживает ни AUTH PLAIN, ни AUTH LOGIN");
}

/** Имя, которым представляемся в EHLO. */
function clientName(): string {
  const name = process.env.MAIL_SMTP_CLIENT_NAME ?? hostname();
  return /^[A-Za-z0-9.-]+$/.test(name) ? name : "localhost";
}

/**
 * Соединение с сервером: команды и разбор многострочных ответов.
 *
 * Ответы складываются в очередь, потому что приветствие приходит до того, как
 * мы успели его попросить.
 */
class SmtpConnection {
  private socket: Socket;
  private readonly timeoutMs: number;
  private readonly host: string;
  private buffer = "";
  private lines: string[] = [];
  private ready: Reply[] = [];
  private waiters: Array<(result: Reply | Error) => void> = [];
  private failure: Error | null = null;

  private constructor(socket: Socket, host: string, timeoutMs: number) {
    this.socket = socket;
    this.host = host;
    this.timeoutMs = timeoutMs;
    this.listen();
  }

  static open(options: SmtpOptions): Promise<SmtpConnection> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const socket = options.secure
        ? tlsConnect({ host: options.host, port: options.port, servername: options.host })
        : netConnect({ host: options.host, port: options.port });

      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`SMTP: ${options.host}:${options.port} не отвечает`));
      }, timeoutMs);

      socket.once(options.secure ? "secureConnect" : "connect", () => {
        clearTimeout(timer);
        resolve(new SmtpConnection(socket, options.host, timeoutMs));
      });

      socket.once("error", (error: Error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  get encrypted(): boolean {
    return "encrypted" in this.socket && this.socket.encrypted === true;
  }

  /** Поднимает шифрование на уже открытом сокете после команды STARTTLS. */
  upgrade(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const plain = this.socket;
      // Старые обработчики сняты: дальше тот же сокет читает уже TLS-обёртка.
      plain.removeAllListeners("data");
      plain.removeAllListeners("error");
      plain.removeAllListeners("timeout");
      plain.removeAllListeners("close");

      const secure = tlsConnect({ socket: plain, servername: host }, () => {
        this.socket = secure;
        this.buffer = "";
        this.lines = [];
        this.listen();
        resolve();
      });

      secure.once("error", reject);
    });
  }

  async command(text: string, expected: number[]): Promise<Reply> {
    await this.send(`${text}${CRLF}`);
    return this.expect(expected);
  }

  send(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.write(text, "utf8", (error) => (error ? reject(error) : resolve()));
    });
  }

  async expect(expected: number[]): Promise<Reply> {
    const reply = await this.read();
    if (!expected.includes(reply.code)) {
      throw new Error(`SMTP: ответ ${reply.code} — ${reply.lines.join(" ")}`);
    }
    return reply;
  }

  close(): void {
    this.socket.destroy();
  }

  private read(): Promise<Reply> {
    const next = this.ready.shift();
    if (next) return Promise.resolve(next);
    if (this.failure) return Promise.reject(this.failure);

    return new Promise((resolve, reject) => {
      this.waiters.push((result) => (result instanceof Error ? reject(result) : resolve(result)));
    });
  }

  private listen(): void {
    this.socket.setEncoding("utf8");
    this.socket.setTimeout(this.timeoutMs);
    this.socket.on("data", (chunk: string) => this.consume(chunk));
    this.socket.on("error", (error: Error) => this.fail(error));
    this.socket.on("timeout", () => this.fail(new Error(`SMTP: ${this.host} молчит слишком долго`)));
    this.socket.on("close", () => this.fail(new Error("SMTP: сервер закрыл соединение")));
  }

  private consume(chunk: string): void {
    this.buffer += chunk;

    let breakAt = this.buffer.indexOf(CRLF);
    while (breakAt >= 0) {
      const line = this.buffer.slice(0, breakAt);
      this.buffer = this.buffer.slice(breakAt + CRLF.length);
      this.lines.push(line.slice(4));

      // «250-РАСШИРЕНИЕ» — продолжение, «250 OK» — последняя строка ответа.
      if (/^\d{3}(?: |$)/.test(line)) {
        this.deliver({ code: Number(line.slice(0, 3)), lines: this.lines });
        this.lines = [];
      }

      breakAt = this.buffer.indexOf(CRLF);
    }
  }

  private deliver(reply: Reply): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter(reply);
    else this.ready.push(reply);
  }

  private fail(error: Error): void {
    // Закрытие после QUIT — обычное дело: ошибка нужна лишь тому, кто ещё ждёт ответа.
    this.failure ??= error;
    const waiting = this.waiters;
    this.waiters = [];
    for (const waiter of waiting) waiter(error);
  }
}
