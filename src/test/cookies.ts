/**
 * Cookie-хранилище вместо next/headers.
 *
 * Действия узнают пользователя из настоящей сессии: токен кладётся в cookie, а
 * в базе лежит только его хеш. Подменять `requireUser` нельзя — тогда тест
 * проверял бы мок; подменяем ровно одно, чего нет вне запроса, — сам ящик с
 * cookie.
 */
const jar = new Map<string, string>();

export const testCookies = {
  get(name: string) {
    const value = jar.get(name);
    return value === undefined ? undefined : { name, value };
  },
  set(name: string, value: string) {
    jar.set(name, value);
  },
  delete(name: string) {
    jar.delete(name);
  },
};

/** Забывает всё — так тест начинается «не вошедшим ни под кем». */
export function clearCookies(): void {
  jar.clear();
}
