# 2K Cargo API Wrapper — AGENTS.md

## Project Goal
REST API wrapper over the cargo tracking website `https://2k-cargo-krg.kz/`.
The wrapper authenticates on the upstream site with user-provided credentials
and exposes convenient endpoints for listing, adding, deleting and editing
track codes (packages). The upstream site has no edit endpoint, so updates are
implemented as atomic delete+create.

## Stack
- NestJS 10 + TypeScript
- TypeORM + sqlite3
- @nestjs/axios
- tough-cookie
- cheerio
- class-validator / class-transformer
- @nestjs/config
- @nestjs/throttler
- helmet
- crypto (Node built-in)

## Upstream Endpoints (researched)

### Login
- POST `https://2k-cargo-krg.kz/login.php`
- Form fields: `n` (phone), `p` (password), `mem=1`
- Response: 302 redirect to `/index.php`
- Cookies on success: `PHPSESSID`, `cuid`, `cups`

### List packages
- GET `https://2k-cargo-krg.kz/view_verified_codes.php?page={N}`
- Returns HTML with package cards

### Add package
- POST `https://2k-cargo-krg.kz/process_verification.php`
- Fields: `user_id`, `track_code`, `names`
- Plain text response

### Delete package
- POST `https://2k-cargo-krg.kz/view_verified_codes.php`
- Field: `delete_item={item_id}`

### Logout
- GET `https://2k-cargo-krg.kz/exit.php`

## Project Structure
```
src/
  app.module.ts
  main.ts
  config/
    app.config.ts
  database/
    database.module.ts
  auth/
    auth.controller.ts
    auth.service.ts
    auth.module.ts
    auth.guard.ts
    dto/login.dto.ts
  packages/
    packages.controller.ts
    packages.service.ts
    packages.module.ts
    dto/
      create-package.dto.ts
      update-package.dto.ts
      list-packages-query.dto.ts
    entities/
      package.entity.ts
  site-client/
    site-client.service.ts
    site-client.module.ts
  session/
    session.entity.ts
    session.service.ts
    session.module.ts
  common/
    encryption.service.ts
    phone-normalization.util.ts
Dockerfile
docker-compose.yml
.env.example
```

## Modules & Responsibilities

### EncryptionService (`src/common/encryption.service.ts`)
- Encrypts/decrypts sensitive values using AES-256-GCM with the master key.
- `encrypt(plainText: string, masterKey: Buffer): Buffer`
- `decrypt(encrypted: Buffer, masterKey: Buffer): string`

### ApiSession (`src/session/session.entity.ts`)
```ts
@Entity('api_sessions')
export class ApiSession {
  @PrimaryColumn()
  token: string;

  @Column()
  phone: string;

  @Column('blob')
  passwordEncrypted: Buffer;

  @Column({ type: 'text', nullable: true })
  siteCookies: string;

  @Column({ nullable: true })
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUsedAt: Date;
}
```

### SessionService (`src/session/session.service.ts`)
- Create, find by token, update cookies, delete.
- Generates opaque random token with `crypto.randomUUID()`.
- Updates `lastUsedAt` on every lookup.

### SiteClientService (`src/site-client/site-client.service.ts`)
- Maintains a `tough-cookie` CookieJar per session.
- Methods:
  - `login(phone: string, password: string): Promise<{ userId: number, cookies: string }>`
  - `logout(cookies: string): Promise<void>`
  - `listPackages(cookies: string, page?: number): Promise<Package[]>`
  - `addPackage(cookies: string, userId: number, trackCode: string, name: string): Promise<void>`
  - `deletePackage(cookies: string, itemId: number): Promise<void>`
- Auto-relogin: when a request indicates the upstream session expired,
  decrypt the stored password, call login again, update cookies in DB,
  retry the original request.

### AuthController (`src/auth/auth.controller.ts`)
- `POST /api/auth/login` → `{ token }`
- `POST /api/auth/logout` → 204

### AuthGuard (`src/auth/auth.guard.ts`)
- Reads `Authorization: Bearer <token>`.
- Looks up session, attaches `req.session`.
- Updates `lastUsedAt`.

### PackagesController (`src/packages/packages.controller.ts`)
- `GET /api/packages?page=1`
- `GET /api/packages/:id`
- `POST /api/packages`
- `DELETE /api/packages/:id`
- `PATCH /api/packages/:id`

### PackagesService (`src/packages/packages.service.ts`)
- Delegates to `SiteClientService`.
- `update` is implemented as atomic `delete + create` because upstream has no edit endpoint.

## Configuration
Environment variables (see `.env.example`):
```env
APP_PORT=3000
APP_MASTER_KEY=your-32-byte-key-here
SITE_BASE_URL=https://2k-cargo-krg.kz
DATABASE_PATH=./data/sessions.sqlite
```

## Business Rules
1. Phone normalization: accept `77073006789` or `+7 (707) 300-67-89`, store and send upstream as digits only.
2. Auth tokens are opaque, Bearer, valid until explicit logout.
3. Upstream passwords are encrypted at rest with the master key.
4. Auto-relogin is enabled; the wrapper will decrypt the password and refresh the upstream session.
5. No caching of upstream responses.
6. `PATCH /api/packages/:id` is emulated via delete+create; the returned package will have a new id.

## Security
- Use `helmet` globally.
- Rate-limit auth endpoints with `@nestjs/throttler`.
- Validate all DTOs with `ValidationPipe`.
- Never log or return the upstream password.

## Docker
- Use `node:20-alpine`.
- Mount `./data` volume for SQLite persistence.
- Expose port from `APP_PORT`.
