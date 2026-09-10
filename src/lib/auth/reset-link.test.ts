import { describe, expect, it } from "vitest";

import {
  canResend,
  RESEND_COOLDOWN_SECONDS,
  RESET_TTL_MINUTES,
  resetExpiresAt,
  resetPath,
} from "./reset-link";

const NOW = new Date("2026-09-10T08:00:00Z");
const seconds = (count: number) => new Date(NOW.getTime() - count * 1000);

describe("resetExpiresAt", () => {
  it("даёт ссылке ровно отведённый ей час", () => {
    expect(resetExpiresAt(NOW).toISOString()).toBe("2026-09-10T09:00:00.000Z");
    expect(RESET_TTL_MINUTES).toBe(60);
  });
});

describe("canResend", () => {
  it("пропускает первое письмо", () => {
    expect(canResend(null, NOW)).toBe(true);
  });

  it("держит паузу после только что отправленного", () => {
    expect(canResend(NOW, NOW)).toBe(false);
    expect(canResend(seconds(RESEND_COOLDOWN_SECONDS - 1), NOW)).toBe(false);
  });

  it("разрешает повтор, когда пауза вышла", () => {
    expect(canResend(seconds(RESEND_COOLDOWN_SECONDS), NOW)).toBe(true);
    expect(canResend(seconds(RESEND_COOLDOWN_SECONDS + 60), NOW)).toBe(true);
  });
});

describe("resetPath", () => {
  it("экранирует токен: в base64url бывает символ, который в адресе значим", () => {
    expect(resetPath("abc-_123")).toBe("/reset-password?token=abc-_123");
    expect(resetPath("a+b/c=")).toBe("/reset-password?token=a%2Bb%2Fc%3D");
  });
});
