import { describe, expect, it } from "vitest";

import { formatAmount, minorUnitsPerMajor, parseAmount } from "./money";

/** Intl разделяет разряды неразрывным пробелом — для сравнения приводим к обычному. */
const normalizeSpaces = (value: string) => value.replace(/\s/g, " ");

describe("parseAmount", () => {
  it("принимает и запятую, и точку", () => {
    expect(parseAmount("1234,56", "RUB")).toBe(123_456);
    expect(parseAmount("1234.56", "RUB")).toBe(123_456);
  });

  it("терпит пробелы из копипаста, включая неразрывные", () => {
    expect(parseAmount("1 234,56", "RUB")).toBe(123_456);
    expect(parseAmount("1 234,56", "RUB")).toBe(123_456);
    expect(parseAmount("1 234,56", "RUB")).toBe(123_456);
  });

  it("округляет лишние знаки, а не отбрасывает их", () => {
    expect(parseAmount("10,999", "RUB")).toBe(1100);
  });

  it("учитывает валюты без дробной части", () => {
    expect(minorUnitsPerMajor("JPY")).toBe(1);
    expect(parseAmount("1500", "JPY")).toBe(1500);
    expect(parseAmount("1500", "RUB")).toBe(150_000);
  });

  it("отвергает мусор и отрицательные суммы", () => {
    expect(parseAmount("", "RUB")).toBeNull();
    expect(parseAmount("сто рублей", "RUB")).toBeNull();
    expect(parseAmount("-100", "RUB")).toBeNull();
    expect(parseAmount("1.2.3", "RUB")).toBeNull();
  });
});

describe("formatAmount", () => {
  it("показывает копейки у рубля и не показывает у иены", () => {
    expect(normalizeSpaces(formatAmount(123_456, "RUB"))).toBe("1 234,56");
    expect(normalizeSpaces(formatAmount(1500, "JPY"))).toBe("1 500");
  });
});
