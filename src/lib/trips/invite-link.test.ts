import { describe, expect, it } from "vitest";

import { inviteOutcome, invitePath } from "@/lib/trips/invite-link";

describe("адрес приглашения", () => {
  it("ведёт на страницу с токеном", () => {
    expect(invitePath("abc123")).toBe("/join/abc123");
  });
});

describe("чем кончается переход по ссылке", () => {
  it("нет ссылки — нечего открывать", () => {
    expect(inviteOutcome(null)).toBe("broken");
  });

  it("активная поездка пускает постороннего", () => {
    expect(inviteOutcome({ tripStatus: "ACTIVE", viewerIsMember: false })).toBe("join");
  });

  it("в завершённую поездку приходить поздно", () => {
    expect(inviteOutcome({ tripStatus: "COMPLETED", viewerIsMember: false })).toBe("completed");
  });

  it("участника ведёт в поездку, а не предлагает вступить", () => {
    expect(inviteOutcome({ tripStatus: "ACTIVE", viewerIsMember: true })).toBe("member");
  });

  // Ссылкой из старого чата участник пользуется как закладкой: завершение
  // поездки не повод показывать ему отказ.
  it("участника ведёт в поездку и после её завершения", () => {
    expect(inviteOutcome({ tripStatus: "COMPLETED", viewerIsMember: true })).toBe("member");
  });
});
