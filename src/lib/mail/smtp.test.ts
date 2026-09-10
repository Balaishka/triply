import { createServer, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { sendSmtp } from "./smtp";

/**
 * Клиент проверяется против сервера-заглушки в том же процессе: сеть не нужна,
 * а разговор по протоколу виден целиком.
 */

interface FakeServer {
  port: number;
  /** Всё, что клиент прислал, одной строкой. */
  transcript: () => string;
  close: () => Promise<void>;
}

/**
 * Сервер отвечает по сценарию: на каждую команду — своя реплика. `replies`
 * подменяет ответ для команды, начинающейся с ключа.
 */
function startServer(options: { ehlo: string[]; replies?: Record<string, string> }): Promise<FakeServer> {
  let received = "";
  const replies = options.replies ?? {};

  const server: Server = createServer((socket: Socket) => {
    let inData = false;

    socket.setEncoding("utf8");
    socket.write("220 fake ESMTP\r\n");

    socket.on("data", (chunk: string) => {
      received += chunk;

      for (const line of chunk.split("\r\n").slice(0, -1)) {
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write(`${replies["."] ?? "250 принято"}\r\n`);
          }
          continue;
        }

        const command = line.toUpperCase();
        const override = Object.entries(replies).find(([key]) => command.startsWith(key));

        if (override) {
          socket.write(`${override[1]}\r\n`);
          continue;
        }

        if (command.startsWith("EHLO")) socket.write(`${options.ehlo.join("\r\n")}\r\n`);
        else if (command.startsWith("DATA")) {
          inData = true;
          socket.write("354 давайте письмо\r\n");
        } else if (command.startsWith("QUIT")) {
          socket.write("221 пока\r\n");
          socket.end();
        } else socket.write("250 ок\r\n");
      }
    });

    socket.on("error", () => {
      // Клиент рвёт соединение после QUIT — это не повод падать.
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        port,
        transcript: () => received,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

const LETTER = {
  from: "no-reply@triply.test",
  to: "anna@triply.test",
  message: "Subject: Привет\r\n\r\ntext",
};

let running: FakeServer | null = null;

afterEach(async () => {
  await running?.close();
  running = null;
});

describe("sendSmtp", () => {
  it("проходит разговор целиком и отдаёт письмо", async () => {
    running = await startServer({ ehlo: ["250-fake", "250 SIZE 10240000"] });

    await sendSmtp({ host: "127.0.0.1", port: running.port, secure: false }, LETTER);

    const transcript = running.transcript();
    expect(transcript).toContain("EHLO ");
    expect(transcript).toContain("MAIL FROM:<no-reply@triply.test>");
    expect(transcript).toContain("RCPT TO:<anna@triply.test>");
    expect(transcript).toContain("DATA\r\n");
    expect(transcript).toContain("Subject: Привет");
    expect(transcript).toContain("\r\n.\r\n");
    expect(transcript).toContain("QUIT");
  });

  it("удваивает точку в начале строки, чтобы письмо не оборвалось на ней", async () => {
    running = await startServer({ ehlo: ["250 fake"] });

    await sendSmtp(
      { host: "127.0.0.1", port: running.port, secure: false },
      { ...LETTER, message: "Subject: тест\r\n\r\n. точка в начале" },
    );

    expect(running.transcript()).toContain("\r\n.. точка в начале\r\n.\r\n");
  });

  it("не отправляет пароль по открытому каналу", async () => {
    running = await startServer({ ehlo: ["250-fake", "250 AUTH PLAIN LOGIN"] });

    const attempt = sendSmtp(
      { host: "127.0.0.1", port: running.port, secure: false, user: "anna", password: "secret" },
      LETTER,
    );

    await expect(attempt).rejects.toThrow(/шифрование/);
    expect(running.transcript()).not.toContain("AUTH");
  });

  it("докладывает об отказе сервера вместе с кодом", async () => {
    running = await startServer({
      ehlo: ["250 fake"],
      replies: { "RCPT TO": "550 такого ящика нет" },
    });

    await expect(
      sendSmtp({ host: "127.0.0.1", port: running.port, secure: false }, LETTER),
    ).rejects.toThrow(/550/);
  });

  it("разбирает многострочный ответ на EHLO", async () => {
    running = await startServer({
      ehlo: ["250-fake здоровается", "250-PIPELINING", "250-8BITMIME", "250 SMTPUTF8"],
    });

    await sendSmtp({ host: "127.0.0.1", port: running.port, secure: false }, LETTER);

    expect(running.transcript()).toContain("MAIL FROM:");
  });
});
