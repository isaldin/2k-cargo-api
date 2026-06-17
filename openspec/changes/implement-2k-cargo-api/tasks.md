## 1. Project Bootstrap and Configuration

- [x] 1.1 Initialize NestJS 10 project with TypeScript, TypeORM, and required dependencies (`@nestjs/axios`, `tough-cookie`, `cheerio`, `class-validator`, `class-transformer`, `@nestjs/config`, `@nestjs/throttler`, `helmet`, `sqlite3`).
- [x] 1.2 Create `src/config/app.config.ts` to load and validate `APP_PORT`, `APP_MASTER_KEY`, `SITE_BASE_URL`, `DATABASE_PATH`, `PACKAGE_SCAN_PAGE_LIMIT`, and `AUTO_RELOGIN_RETRY_LIMIT`.
- [x] 1.3 Add `.env.example` with all required environment variables, including `PACKAGE_SCAN_PAGE_LIMIT=10` and `AUTO_RELOGIN_RETRY_LIMIT=1`.
- [x] 1.4 Add startup validation that `APP_MASTER_KEY` is exactly 32 bytes.

## 2. Common Utilities

- [x] 2.1 Implement `EncryptionService` in `src/common/encryption.service.ts` with AES-256-GCM `encrypt` and `decrypt` methods.
- [x] 2.2 Implement `phone-normalization.util.ts` to strip non-digit characters and ensure Kazakhstan phone format.
- [x] 2.3 Create `src/common/common.module.ts` exporting `EncryptionService`.

## 3. Database and Session Module

- [x] 3.1 Create `src/database/database.module.ts` configuring TypeORM with SQLite using `DATABASE_PATH`.
- [x] 3.2 Define `ApiSession` entity in `src/session/session.entity.ts` with token, phone, encrypted password, cookies, userId, and timestamps.
- [x] 3.3 Implement `SessionService` with create, find by token (updating `lastUsedAt`), update cookies, and delete methods.
- [x] 3.4 Create `src/session/session.module.ts`.

## 4. Site Client Integration

- [x] 4.1 Implement `SiteClientService` login method posting to `/login.php` and extracting `userId` and cookies.
- [x] 4.2 Implement logout method calling `/exit.php`.
- [x] 4.3 Implement `listPackages` parsing HTML from `/view_verified_codes.php?page={N}` into `{ id, trackCode, name }` arrays.
- [x] 4.4 Implement `addPackage` posting to `/process_verification.php` with `user_id`, `track_code`, and `names`.
- [x] 4.5 Implement `deletePackage` posting `delete_item` to `/view_verified_codes.php`.
- [x] 4.6 Add session expiry detection and retriable error for auto-relogin.
- [x] 4.7 Implement auto-relogin orchestration: on retriable session-expired error, decrypt the stored password, call `SiteClientService.login`, persist the new cookies via `SessionService`, and retry the original request with a configurable retry limit.
- [x] 4.8 Create `src/site-client/site-client.module.ts`.

## 5. Auth Module

- [x] 5.1 Create `LoginDto` with phone and password validation rules.
- [x] 5.2 Implement `AuthService.login` to normalize phone, call `SiteClientService.login`, encrypt password, and create an `ApiSession`.
- [x] 5.3 Implement `AuthService.logout` to delete the API session and call upstream logout.
- [x] 5.4 Create `AuthController` with `POST /api/auth/login` and `POST /api/auth/logout`.
- [x] 5.5 Implement `AuthGuard` reading `Authorization: Bearer <token>`, looking up the session, attaching `req.session`, and updating `lastUsedAt`.
- [x] 5.6 Apply throttler to `/api/auth/*` endpoints.
- [x] 5.7 Create `src/auth/auth.module.ts`.

## 6. Packages Module

- [x] 6.1 Create DTOs: `CreatePackageDto`, `UpdatePackageDto`, and `ListPackagesQueryDto`.
- [x] 6.2 Implement `PackagesService` delegating list, add, delete, and update (delete+create) to `SiteClientService`.
- [x] 6.3 Implement `PackagesController` with `GET /api/packages`, `GET /api/packages/:id`, `POST /api/packages`, `DELETE /api/packages/:id`, and `PATCH /api/packages/:id`.
- [x] 6.4 Add route guards to package endpoints.
- [x] 6.5 Create `src/packages/packages.module.ts`.

## 7. Security and Application Wiring

- [x] 7.1 Register `helmet` globally in `src/main.ts`.
- [x] 7.2 Register global `ValidationPipe` with whitelist and forbidNonWhitelisted enabled.
- [x] 7.3 Configure throttler module globally with appropriate limits.
- [x] 7.4 Wire all modules together in `src/app.module.ts`.
- [x] 7.5 Ensure no password or decrypted values are logged anywhere.

## 8. Docker and Deployment

- [x] 8.1 Create `Dockerfile` using `node:20-alpine`.
- [x] 8.2 Create `docker-compose.yml` mounting `./data` and exposing `APP_PORT`.
- [x] 8.3 Add `.dockerignore` to avoid copying node_modules and local data.

## 9. Verification

- [x] 9.1 Run `npm run build` without TypeScript errors.
- [x] 9.2 Run `npm run lint` (or equivalent) and fix issues.
- [x] 9.3 Run `npm run test` if available.
- [x] 9.4 Manually verify login and package endpoints against the upstream site or representative mocks.
