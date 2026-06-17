## Why

We need a stable, programmable REST API wrapper around the 2K Cargo cargo-tracking website (`https://2k-cargo-krg.kz/`) so that users can manage their track codes without interacting directly with the upstream web UI. The upstream site only exposes HTML form endpoints and has no native API, so a wrapper is required to expose convenient endpoints for authentication, listing, adding, deleting, and editing packages.

## What Changes

- Introduce a NestJS 10 application with TypeORM/SQLite session persistence.
- Implement upstream site authentication (`/api/auth/login`, `/api/auth/logout`) with opaque Bearer tokens and encrypted password storage.
- Implement package management endpoints (`/api/packages`) backed by the upstream HTML endpoints.
- Build a `SiteClientService` that manages `tough-cookie` jars, performs login/logout, lists/adds/deletes packages, and auto-relogs on session expiry.
- Add security controls: helmet, throttler on auth endpoints, DTO validation, and AES-256-GCM encryption for passwords.
- Provide Docker and Docker Compose configuration for portable deployment.

## Capabilities

### New Capabilities

- `auth-session-management`: Opaque Bearer token sessions, upstream credential encryption, and auto-relogin.
- `package-management`: List, create, delete, and emulate updates for upstream track codes via delete+create.
- `site-client-integration`: HTTP client wrapper with cookie jar, upstream form parsing, and session refresh logic.
- `security-and-configuration`: Helmet, rate limiting, validation, encryption, and environment-driven configuration.

### Modified Capabilities

- None (no existing specs in `openspec/specs/`).

## Impact

- New NestJS modules: `auth`, `session`, `packages`, `site-client`, `database`, `config`, and `common`.
- New REST endpoints under `/api/auth` and `/api/packages`.
- New SQLite database table `api_sessions` for token/session storage.
- New environment variables in `.env.example` and Docker Compose.
- Adds runtime dependencies: `@nestjs/axios`, `tough-cookie`, `cheerio`, `class-validator`, `class-transformer`, `@nestjs/config`, `@nestjs/throttler`, `helmet`.
