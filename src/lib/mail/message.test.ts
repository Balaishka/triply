import { describe, expect, it } from "vitest";

import { buildMessage, encodeAddress, encodeBody, encodeHeader, formatDate } from "./message";

const OPTIONS = {
  from: "Triply <no-reply@triply.test>",
  date: new Date("2026-09-10T08:05:03Z"),
  messageId: "abc123@triply.test",
  boundary: "triply-boundary",
};

const decode = (base64: string) => Buffer.from(base64.split("\r\n").join(""), "base64").toString("utf8");

describe("encodeHeader", () => {
  it("оставляет ASCII как есть", () => {
    expect(encodeHeader("Password reset")).toBe("Password reset");
  });

  it("кодирует кириллицу и разбирается обратно", () => {
    const encoded = encodeHeader("Восстановление пароля в Triply");

    expect(encoded).toMatch(/^=\?utf-8\?B\?/);
    const decoded = encoded
      .split("\r\n ")
      .map((word) => decode(word.replace(/^=\?utf-8\?B\?/, "").replace(/\?=$/, "")))
      .join("");
    expect(decoded).toBe("Восстановление пароля в Triply");
  });

  it("держит куски в пределах длины строки заголовка", () => {
    const encoded = encodeHeader("Очень длинная тема письма про восстановление пароля в Triply");

    for (const line of encoded.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it("вырезает переносы строк — через них подделывают заголовки", () => {
    expect(encodeHeader("Subject\nBcc: victim@example.org")).toBe("Subject Bcc: victim@example.org");

    // Перенос остаётся только там, где заголовок сворачивается сам: такая
    // строка продолжается пробелом и новым заголовком не становится.
    const folded = encodeHeader("Тема\r\nBcc: victim@example.org").split("\r\n");
    for (const line of folded.slice(1)) {
      expect(line.startsWith(" ")).toBe(true);
    }
  });
});

describe("encodeAddress", () => {
  it("не трогает голый адрес", () => {
    expect(encodeAddress("anna@triply.test")).toBe("anna@triply.test");
  });

  it("кодирует имя, но не сам адрес", () => {
    const encoded = encodeAddress("Триплай <no-reply@triply.test>");

    expect(encoded).toContain("<no-reply@triply.test>");
    expect(encoded).toMatch(/^=\?utf-8\?B\?/);
  });

  it("оставляет латинское имя читаемым", () => {
    expect(encodeAddress("Triply <no-reply@triply.test>")).toBe("Triply <no-reply@triply.test>");
  });
});

describe("encodeBody", () => {
  it("режет base64 на строки не длиннее 76 символов", () => {
    const encoded = encodeBody("а".repeat(500));

    for (const line of encoded.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
    expect(decode(encoded)).toBe("а".repeat(500));
  });

  it("не порождает строк, начинающихся с точки — их SMTP понял бы как конец письма", () => {
    const encoded = encodeBody(".\n.\n. точка в начале строки");

    expect(encoded.split("\r\n").some((line) => line.startsWith("."))).toBe(false);
  });
});

describe("formatDate", () => {
  it("пишет дату по RFC 5322 в UTC", () => {
    expect(formatDate(new Date("2026-09-10T08:05:03Z"))).toBe("Thu, 10 Sep 2026 08:05:03 +0000");
  });
});

describe("buildMessage", () => {
  it("собирает простое письмо с заголовками и телом", () => {
    const message = buildMessage(
      { to: "anna@triply.test", subject: "Reset", text: "Ссылка внутри" },
      OPTIONS,
    );

    const [headers, body] = message.split("\r\n\r\n");
    expect(headers).toContain("From: Triply <no-reply@triply.test>");
    expect(headers).toContain("To: anna@triply.test");
    expect(headers).toContain("Subject: Reset");
    expect(headers).toContain("Date: Thu, 10 Sep 2026 08:05:03 +0000");
    expect(headers).toContain("Message-ID: <abc123@triply.test>");
    expect(headers).toContain("Content-Type: text/plain; charset=utf-8");
    expect(decode(body)).toBe("Ссылка внутри");
  });

  it("кладёт текст и HTML в multipart, текстовую часть первой", () => {
    const message = buildMessage(
      {
        to: "anna@triply.test",
        subject: "Reset",
        text: "Текстовая версия",
        html: "<p>HTML-версия</p>",
      },
      OPTIONS,
    );

    expect(message).toContain('Content-Type: multipart/alternative; boundary="triply-boundary"');
    expect(message.endsWith("--triply-boundary--")).toBe(true);

    const parts = message.split("--triply-boundary");
    // Шапка, текстовая часть, HTML-часть и хвост «--».
    expect(parts).toHaveLength(4);
    expect(decode(parts[1].split("\r\n\r\n")[1])).toBe("Текстовая версия");
    expect(decode(parts[2].split("\r\n\r\n")[1])).toBe("<p>HTML-версия</p>");
  });

  it("не даёт подделать заголовки через адрес получателя", () => {
    const message = buildMessage(
      { to: "anna@triply.test\r\nBcc: victim@example.org", subject: "Reset", text: "текст" },
      OPTIONS,
    );

    expect(message).not.toContain("Bcc:\r\n");
    expect(message.split("\r\n\r\n")[0].split("\r\n").filter((line) => line.startsWith("To:"))).toHaveLength(1);
  });
});
