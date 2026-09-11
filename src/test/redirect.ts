/**
 * Переход вместо next/navigation.
 *
 * `redirect()` в Next прерывает выполнение исключением — здесь так же, но
 * исключение своё и несёт адрес: успешные действия ничего не возвращают, и
 * проверить их можно только по тому, куда они увели.
 */
export class TestRedirect extends Error {
  constructor(readonly to: string) {
    super(`redirect(${to})`);
    this.name = "TestRedirect";
  }
}

/** Ждёт от действия перехода и возвращает адрес. */
export async function expectRedirect(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    if (error instanceof TestRedirect) return error.to;
    throw error;
  }
  throw new Error("Действие завершилось без перехода, хотя переход ожидался");
}
