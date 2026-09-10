import { describe, expect, it } from "vitest";

import {
  canResendEmailChange,
  confirmEmailPath,
  EMAIL_CHANGE_COOLDOWN_SECONDS,
  EMAIL_CHANGE_TTL_MINUTES,
  emailChangeExpiresAt,
} from "./email-change-link";

const NOW = new Date("2026-09-10T08:00:00Z");
const seconds = (count: number) => new Date(NOW.getTime() - count * 1000);

describe("emailChangeExpiresAt", () => {
  it("даёт ссылке ровно отведённый ей час", () => {
    expect(emailChangeExpiresAt(NOW).toISOString()).toBe("2026-09-10T09:00:00.000Z");
    expect(EMAIL_CHANGE_TTL_MINUTES).toBe(60);
  });
});

describe("canResendEmailChange", () => {
  it("пропускает первое письмо", () => {
    expect(canResendEmailChange(null, NOW)).toBe(true);
  });

  it("держит паузу после только что отправленного", () => {
    expect(canResendEmailChange(NOW, NOW)).toBe(false);
    expect(canResendEmailChange(seconds(EMAIL_CHANGE_COOLDOWN_SECONDS - 1), NOW)).toBe(false);
  });

  it("разрешает повтор, когда пауза вышла", () => {
    expect(canResendEmailChange(seconds(EMAIL_CHANGE_COOLDOWN_SECONDS), NOW)).toBe(true);
    expect(canResendEmailChange(seconds(EMAIL_CHANGE_COOLDOWN_SECONDS + 60), NOW)).toBe(true);
  });
});

describe("confirmEmailPath", () => {
  it("экранирует токен: в base64url бывает символ, который в адресе значим", () => {
    expect(confirmEmailPath("abc-_123")).toBe("/confirm-email?token=abc-_123");
    expect(confirmEmailPath("a+b/c=")).toBe("/confirm-email?token=a%2Bb%2Fc%3D");
  });
});
