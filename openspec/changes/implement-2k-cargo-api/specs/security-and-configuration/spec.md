## ADDED Requirements

### Requirement: API uses helmet for security headers
The system SHALL register `helmet` as global middleware.

#### Scenario: Any request
- **WHEN** any HTTP request reaches the application
- **THEN** security headers provided by helmet are present in the response

### Requirement: Auth endpoints are rate-limited
The system SHALL apply `@nestjs/throttler` to `/api/auth/*` endpoints to mitigate brute-force attacks.

#### Scenario: Excessive login attempts
- **WHEN** more login requests arrive than the configured throttle limit allows
- **THEN** the system returns HTTP 429

### Requirement: DTO validation rejects invalid input
The system SHALL use `ValidationPipe` globally and reject requests that fail DTO constraints.

#### Scenario: Missing login fields
- **WHEN** a request to POST `/api/auth/login` omits `phone` or `password`
- **THEN** the system returns HTTP 400 with validation error details

### Requirement: Passwords are never exposed
The system SHALL never log, return, or store the upstream password in plain text.

#### Scenario: Login response
- **WHEN** login succeeds
- **THEN** the response body contains only the token, never the password

#### Scenario: Error logs
- **WHEN** an error occurs during login or upstream communication
- **THEN** logs do not include the user's password

### Requirement: Configuration is environment-driven
The system SHALL read `APP_PORT`, `APP_MASTER_KEY`, `SITE_BASE_URL`, `DATABASE_PATH`, `PACKAGE_SCAN_PAGE_LIMIT`, and `AUTO_RELOGIN_RETRY_LIMIT` from environment variables via `@nestjs/config`.

#### Scenario: Missing master key
- **WHEN** `APP_MASTER_KEY` is missing or not 32 bytes
- **THEN** the application fails to start with a descriptive error

#### Scenario: Default package scan page limit
- **WHEN** `PACKAGE_SCAN_PAGE_LIMIT` is not provided
- **THEN** the system uses a default value of `10` for single-package lookups

#### Scenario: Default auto-relogin retry limit
- **WHEN** `AUTO_RELOGIN_RETRY_LIMIT` is not provided
- **THEN** the system uses a default value of `1` for relogin attempts per request

### Requirement: Docker image runs the application
The system SHALL provide a `Dockerfile` using `node:20-alpine` and a `docker-compose.yml` that mounts `./data` for SQLite persistence.

#### Scenario: Docker Compose up
- **WHEN** `docker compose up` is run
- **THEN** the application starts on the port defined by `APP_PORT`
