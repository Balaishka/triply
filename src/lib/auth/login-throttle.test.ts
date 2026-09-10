import { describe, expect, it } from "vitest";

import {
  ATTEMPT_MEMORY_MINUTES,
  attemptsForgotten,
  countFailure,
  FIRST_LOCK_SECONDS,
  FREE_ATTEMPTS,
  formatRetryAfter,
  lockedUntil,
  lockSeconds,
  MAX_LOCK_SECONDS,
  retryAfterSeconds,
} from "./login-throttle";

const NOW = new Date("2026-09-10T08:00:00Z");
const minutesAgo = (count: number) => new Date(NOW.getTime() - count * 60 * 1000);

describe("lockSeconds", () => {
  it("прощает первые промахи", () => {
    expect(lockSeconds(0)).toBe(0);
    expect(lockSeconds(FREE_ATTEMPTS)).toBe(0);
  });

  it("включает паузу сразу после превышения и удваивает её", () => {
    expect(lockSeconds(FREE_ATTEMPTS + 1)).toBe(FIRST_LOCK_SECONDS);
    expect(lockSeconds(FREE_ATTEMPTS + 2)).toBe(FIRST_LOCK_SECONDS * 2);
    expect(lockSeconds(FREE_ATTEMPTS + 3)).toBe(FIRST_LOCK_SECONDS * 4);
  });

  it("не растит паузу выше потолка", () => {
    expect(lockSeconds(FREE_ATTEMPTS + 20)).toBe(MAX_LOCK_SECONDS);
    // Упорный перебор не должен переполнить степень до бессмысленного числа.
    expect(lockSeconds(10_000)).toBe(MAX_LOCK_SECONDS);
  });
});

describe("lockedUntil", () => {
  it("не назначает срок, пока попытки есть", () => {
    expect(lockedUntil(FREE_ATTEMPTS, NOW)).toBeNull();
  });

  it("отсчитывает паузу от текущего момента", () => {
    expect(lockedUntil(FREE_ATTEMPTS + 1, NOW)?.toISOString()).toBe("2026-09-10T08:00:30.000Z");
  });
});

describe("retryAfterSeconds", () => {
  it("без паузы разрешает попытку", () => {
    expect(retryAfterSeconds(null, NOW)).toBe(0);
  });

  it("считает остаток и не уходит в минус после срока", () => {
    expect(retryAfterSeconds(new Date(NOW.getTime() + 45_000), NOW)).toBe(45);
    expect(retryAfterSeconds(minutesAgo(5), NOW)).toBe(0);
  });
});

describe("countFailure", () => {
  it("начинает счёт с первого промаха", () => {
    expect(countFailure(null, NOW)).toBe(1);
  });

  it("копит промахи, пока они помнятся", () => {
    expect(countFailure({ failures: 3, lastFailedAt: minutesAgo(10) }, NOW)).toBe(4);
  });

  it("забывает старые: месяц опечаток не должен складываться в блокировку", () => {
    const forgotten = minutesAgo(ATTEMPT_MEMORY_MINUTES);
    expect(attemptsForgotten(forgotten, NOW)).toBe(true);
    expect(countFailure({ failures: 9, lastFailedAt: forgotten }, NOW)).toBe(1);
  });
});

describe("formatRetryAfter", () => {
  it("склоняет секунды и минуты", () => {
    expect(formatRetryAfter(30)).toBe("30 секунд");
    expect(formatRetryAfter(1)).toBe("1 секунду");
    expect(formatRetryAfter(60)).toBe("1 минуту");
    expect(formatRetryAfter(120)).toBe("2 минуты");
    expect(formatRetryAfter(MAX_LOCK_SECONDS)).toBe("30 минут");
  });

  it("округляет вверх: обещать меньше, чем придётся ждать, нельзя", () => {
    expect(formatRetryAfter(90)).toBe("2 минуты");
  });
});
