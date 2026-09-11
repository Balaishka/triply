import { describe, expect, it } from "vitest";

import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/next-path";

describe("возврат после входа", () => {
  it("пропускает путь внутри приложения", () => {
    expect(safeNextPath("/join/abc123")).toBe("/join/abc123");
  });

  it("сохраняет параметры пути", () => {
    expect(safeNextPath("/friends?q=anna")).toBe("/friends?q=anna");
  });

  it("без параметра ведёт на главную", () => {
    expect(safeNextPath(undefined)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath(["/join/abc123"])).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("не уводит на чужой сайт", () => {
    expect(safeNextPath("https://зло.example/login")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("//зло.example/login")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("/\\зло.example/login")).toBe(DEFAULT_AFTER_LOGIN);
  });

  // Перевод строки в середине адреса браузеры выбрасывают, и «/\n//зло.example»
  // после этого снова становится чужим сайтом.
  it("не пускает путь с пробелами и переводами строк", () => {
    expect(safeNextPath("/\n//зло.example")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath("/join/ abc123")).toBe(DEFAULT_AFTER_LOGIN);
  });
});
