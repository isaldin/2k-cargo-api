# План тестового покрытия 2K Cargo API

## Цель
Покрыть API wrapper полноценными unit + e2e тестами на Jest.

## Стек
- Jest 29 + ts-jest
- supertest для e2e
- nock для мока upstream (2k-cargo-krg.kz)
- SQLite in-memory (`:memory:`) для тестовой БД
- dotenv через `.env.test`

## Файловая структура

```
.env.test
package.json
src/
  common/
    encryption.service.spec.ts
    phone-normalization.util.spec.ts
test/
  jest-e2e.json
  setup.ts
  helpers/
    app.helper.ts
    session.factory.ts
    nock.helper.ts
  fixtures/
    login-redirect.txt
    packages-page.html
    packages-page-empty.html
    add-response.txt
    session-expired.html
  e2e/
    auth.e2e-spec.ts
    packages.e2e-spec.ts
    relogin.e2e-spec.ts
```

## Конфигурация

### `.env.test`
```env
APP_PORT=3001
APP_MASTER_KEY=0123456789abcdef0123456789abcdef
SITE_BASE_URL=https://2k-cargo-krg.kz
DATABASE_PATH=:memory:
PACKAGE_SCAN_PAGE_LIMIT=5
AUTO_RELOGIN_RETRY_LIMIT=2
```

### `test/jest-e2e.json`
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "setupFilesAfterEnv": ["<rootDir>/setup.ts"]
}
```

### Скрипты `package.json`
Существующий `test` заменяем на запуск unit + e2e, добавляем `test:unit`:
```json
"test:unit": "jest --testRegex='.*\\.spec\\.ts$'",
"test:e2e": "jest --config ./test/jest-e2e.json",
"test": "npm run test:unit && npm run test:e2e"
```

### Dev-зависимости (добавить в package.json при реализации)
```json
"dotenv": "^16.3.1",
"nock": "^13.5.0",
"supertest": "^6.3.4",
"@types/supertest": "^6.0.2"
```

## Unit-тесты

### `src/common/encryption.service.spec.ts`
- encrypt → decrypt round-trip
- decrypt с другим ключом падает
- decrypt битого буфера падает
- ciphertext не равен plaintext

### `src/common/phone-normalization.util.spec.ts`
- `+7 (707) 300-67-89` → `77073006789`
- `77073006789` → `77073006789`
- номер из 10 цифр → OK
- номер из 15 цифр → OK
- 9 цифр → ошибка
- 16 цифр → ошибка
- пустая строка → ошибка
- строка без цифр → ошибка
- пробелы/тире/скобки/плюс корректно игнорируются

## E2E-тесты

### `test/e2e/auth.e2e-spec.ts`
#### `POST /api/auth/login`
- 201 + token при успехе
- 400 при невалидном phone/password
- 401 при неправильных кредах upstream
- upstream не 302 → **401** (любой status !== 302)
- 302 без `cuid` cookie → 502
- 302 с нечисловым `cuid` → 502
- `cuid` cookie парсится как `userId` — assert через чтение `ApiSession` из БД, потому что login response возвращает только `{ token }`

#### Важность maxRedirects
Текущий axios-клиент в `src/site-client/site-client.service.ts:38` не задаёт `maxRedirects: 0`, но код ожидает именно 302 на login. Это потенциальный баг. `nockLogin` не должен маскировать redirect-following. При реализации либо:
- тест POST /api/auth/login → 201 фиксирует текущее поведение и требует добавить `maxRedirects: 0`, либо
- сразу добавляем `maxRedirects: 0` в код axios-клиента.

#### `POST /api/auth/logout`
- 204 при валидном токене
- 401 без токена
- upstream logout падает → сессия всё равно удаляется

### `test/e2e/packages.e2e-spec.ts`
- `GET /api/packages?page=1` → 200 + список
- `GET /api/packages?page=2` → пагинация / пусто
- `GET /api/packages?page=abc` → 400
- `GET /api/packages?page=0` → 400
- `GET /api/packages/:id` → 200 если найден, 404 если нет
- `GET /api/packages/abc` → 400 (ParseIntPipe)
- `POST /api/packages` → 201, возвращает созданный пакет
- `POST /api/packages` с пустым body → 400
- `POST /api/packages` с лишним полем → 400 (forbidNonWhitelisted)
- `DELETE /api/packages/:id` → 204
- `PATCH /api/packages/:id` → 200, новый id, delete+create
- `PATCH` с падением create после delete → HTTP 502
- 401 на всех роутах без токена

Примечание: PATCH с пустым `{}` **не будет 400**, потому что `UpdatePackageDto` оба поля optional. Этот кейс в план не входит.

Примечание: после `addPackage` сервис делает `findPackageByTrackCode`, поэтому для `POST` и `PATCH` нужен дополнительный nock на `GET /view_verified_codes.php`, возвращающий страницу с созданным пакетом.

### `test/e2e/relogin.e2e-spec.ts`
- `GET /api/packages` возвращает session-expired → service делает relogin → retry → 200
- relogin retry limit исчерпан → 401
- пароль берётся из БД и расшифровывается
- cookies обновляются в `ApiSession` после relogin
- userId в памяти меняется, но в БД **не сохраняется** (текущее поведение `withRelogin` вызывает только `updateCookies`)

## Helpers

### `test/setup.ts`
- `dotenv.config({ path: '.env.test' })`
- `nock.disableNetConnect()`
- `nock.enableNetConnect('127.0.0.1')`
- `afterEach(() => nock.cleanAll())`
- очистка БД между тестами

### `test/helpers/app.helper.ts`
- `bootstrapApp(): Promise<INestApplication>`
- Создаёт `Test.createTestingModule({ imports: [AppModule] })`
- Применяет `ValidationPipe` с такими же настройками как в `main.ts`:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
  - `enableImplicitConversion: false`
- Применяет `helmet`, `setGlobalPrefix('api')`

### `test/helpers/session.factory.ts`
- `createSession(app, overrides?): Promise<{ token, session }>`
- Шифрует пароль через `EncryptionService`
- Создаёт запись `ApiSession` в БД с cookies / userId
- Возвращает Bearer токен

### `test/helpers/nock.helper.ts`
- `nockLogin({ phone, password, userId = 123 })` → 302 + cookies
- `nockLogout()` → 200
- `nockList({ page, packages })` → HTML страницы
- `nockAdd({ userId, trackCode, name, response = 'OK' })` → text
- `nockDelete({ itemId })` → 200
- `nockSessionExpired()` → 302 на login.php или HTML с формой логина
- `nockListWithPackage({ page, package })` — helper для `findPackageByTrackCode`

## Фикстуры

- `login-redirect.txt` — пустой ответ 302 с `Set-Cookie: PHPSESSID=..., cuid=123; cups=...`
- `packages-page.html` — HTML с несколькими карточками пакетов
- `packages-page-empty.html` — HTML без пакетов
- `add-response.txt` — текст `OK` или `already exists`
- `session-expired.html` — HTML с формой логина

## Особенности реализации

- SQLite in-memory через `DATABASE_PATH=:memory:` в `.env.test`
- Все запросы к upstream перехватываются nock
- Локальные запросы к `127.0.0.1` разрешены
- Сессии создаются напрямую в БД через factory
- Приложение пересоздаётся между файлами
- Axios-клиенту upstream, вероятно, потребуется `maxRedirects: 0`
