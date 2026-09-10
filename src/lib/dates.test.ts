import { describe, expect, it } from "vitest";

import {
  addDaysISO,
  addMonthsISO,
  formatDateNumeric,
  formatMonthTitle,
  fromISODate,
  monthGridISO,
  startOfMonthISO,
  weekdayIndexISO,
} from "./dates";

describe("monthGridISO", () => {
  it("начинает неделю с понедельника, добирая хвост прошлого месяца", () => {
    // 1 июля 2026 — среда, значит перед ним встают 29 и 30 июня.
    const grid = monthGridISO("2026-07-01");
    expect(grid[0]).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
    ]);
  });

  it("всегда отдаёт шесть недель, даже когда месяц укладывается в пять", () => {
    // Февраль 2027 начинается с понедельника и весь помещается в четыре недели.
    for (const month of ["2027-02-01", "2026-07-01", "2026-08-01"]) {
      const grid = monthGridISO(month);
      expect(grid).toHaveLength(6);
      expect(grid.flat()).toHaveLength(42);
    }
  });

  it("не зависит от того, какой день месяца передали", () => {
    expect(monthGridISO("2026-07-23")).toEqual(monthGridISO("2026-07-01"));
  });

  it("содержит все дни месяца по порядку и без пропусков", () => {
    const days = monthGridISO("2026-07-01").flat();
    expect(days.filter((day) => day.startsWith("2026-07"))).toHaveLength(31);
    expect(days.every((day, index) => index === 0 || day === addDaysISO(days[index - 1], 1))).toBe(
      true,
    );
  });

  it("переваливает через год", () => {
    const grid = monthGridISO("2026-01-01");
    expect(grid[0][0]).toBe("2025-12-29");
  });
});

describe("addMonthsISO", () => {
  it("прижимает число к последнему дню короткого месяца", () => {
    expect(addMonthsISO("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonthsISO("2028-03-31", -1)).toBe("2028-02-29");
    expect(addMonthsISO("2026-05-31", 1)).toBe("2026-06-30");
  });

  it("переходит через границу года", () => {
    expect(addMonthsISO("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonthsISO("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("addDaysISO", () => {
  it("считает високосный февраль", () => {
    expect(addDaysISO("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysISO("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("weekdayIndexISO", () => {
  it("нумерует с понедельника", () => {
    expect(weekdayIndexISO("2026-07-06")).toBe(0); // понедельник
    expect(weekdayIndexISO("2026-07-12")).toBe(6); // воскресенье
  });
});

describe("форматирование", () => {
  it("даёт компактную дату с ведущими нулями", () => {
    expect(formatDateNumeric(fromISODate("2026-07-05"))).toBe("05.07.2026");
  });

  it("даёт заголовок месяца в именительном падеже", () => {
    expect(formatMonthTitle("2026-07-01")).toBe("Июль 2026");
  });

  it("сводит любую дату к первому числу месяца", () => {
    expect(startOfMonthISO("2026-07-23")).toBe("2026-07-01");
  });
});
