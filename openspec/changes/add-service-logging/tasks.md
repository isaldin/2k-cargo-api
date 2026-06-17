## 1. Logging Infrastructure

- [x] 1.1 Add logging config: `LOG_LEVEL`, `LOG_FORMAT`, `LOG_STACKS`.
- [x] 1.2 Add `AppLogger` that writes structured JSON logs to stdout/stderr.
- [x] 1.3 Add redaction/hash helpers for phone, session token, headers, and
      sensitive fields.
- [x] 1.4 Add request id middleware that reads/generates `X-Request-Id` and
      writes it back to responses.
- [x] 1.5 Add request context storage so services can include `requestId`.

## 2. HTTP Request Logging

- [x] 2.1 Add interceptor/middleware for request completion logs.
- [x] 2.2 Include method, path, statusCode, durationMs, and requestId.
- [x] 2.3 Log 5xx responses at `error`, auth/rate-limit 4xx at `warn`, normal
      2xx/3xx/validation 4xx at `info`.
- [x] 2.4 Add global exception logging for unexpected errors.

## 3. Business Logs

- [x] 3.1 Add auth logs for login/logout start, success, and failure.
- [x] 3.2 Add package logs for list/get/create/delete/patch start, success, and
      important failure paths.
- [x] 3.3 Add explicit log for PATCH delete succeeded but create failed.
- [x] 3.4 Ensure no auth log includes plaintext phone, password, token, or
      cookies.

## 4. Upstream and Parser Logs

- [x] 4.1 Wrap upstream HTTP calls with duration/status logging.
- [x] 4.2 Log session-expired detection and relogin attempts/outcomes.
- [x] 4.3 Log user id resolution source: `cuid`, `html_input`,
      `html_data_attr`, or `script`.
- [x] 4.4 Log package parser summary: packageCount, statusRowsCount,
      activeStatusCount, inactiveStatusCount.
- [x] 4.5 On parser failure, log sanitized diagnostics only; never log full
      upstream HTML.

## 5. Tests

- [x] 5.1 Unit-test redaction helper for password, Authorization, cookies,
      APP_MASTER_KEY, and serialized CookieJar-like fields.
- [x] 5.2 E2E-test `X-Request-Id` response header is returned.
- [x] 5.3 E2E-test inbound `X-Request-Id` is preserved when valid.
- [x] 5.4 E2E-test login failure logs do not contain plaintext password.
- [x] 5.5 Unit-test logger level filtering.
- [x] 5.6 Unit-test parser summary counts for mixed active/inactive statuses.

## 6. Documentation and Deployment

- [x] 6.1 Update `.env.example` with logging variables and safe defaults.
- [x] 6.2 Update Docker Compose/Ansible env template to pass logging vars.
- [x] 6.3 Update `README.md` or `ansible/README.md` with log inspection
      commands.
- [x] 6.4 Document how to correlate incidents by `requestId`.

## 7. Verification

- [x] 7.1 Run `npm test`.
- [x] 7.2 Run `npm run build`.
- [x] 7.3 Run `npm run lint`.
- [x] 7.4 Run local smoke and inspect app logs for request id and upstream
      events.
- [ ] 7.5 Deploy to VPS and verify `docker compose logs app` contains JSON
      logs and no secrets.
