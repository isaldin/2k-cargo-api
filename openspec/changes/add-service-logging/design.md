## Goals

- Logs must help debug production incidents quickly.
- Logs must be structured JSON on stdout/stderr so Docker can collect them.
- Logs must be safe: no plaintext passwords, Bearer tokens, cookies, encrypted
  password blobs, full request bodies, or upstream HTML bodies.
- Logs must preserve correlation across request handling, upstream calls, parser
  decisions, and errors.

## Non-Goals

- No external log aggregator in the first implementation.
- No metrics backend or dashboards.
- No tracing system such as OpenTelemetry yet.
- No logging of full upstream HTML. Summaries and short sanitized snippets only.

## Log Format

Each log line should be one JSON object:

```ts
interface AppLog {
  level: 'debug' | 'info' | 'warn' | 'error';
  time: string; // ISO timestamp in UTC
  event: string;
  requestId?: string;
  message?: string;
  context?: string;
  [key: string]: unknown;
}
```

Required fields:

- `level`
- `time`
- `event`

Recommended fields when available:

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`
- `upstreamEndpoint`
- `upstreamStatus`
- `page`
- `packageId`
- `trackCode`
- `packageCount`
- `sessionTokenHash`
- `phoneHash`
- `errorName`
- `errorMessage`

## Request Id

Add middleware that:

1. Reads inbound `X-Request-Id` if present and valid.
2. Otherwise generates a new id.
3. Stores it in request context.
4. Returns it in response header `X-Request-Id`.
5. Makes it available to services/loggers.

Use `crypto.randomUUID()` or a compact monotonic id. Do not reuse session token
as request id.

## Request Logs

Emit one log on request completion:

```json
{
  "level": "info",
  "event": "http.request.completed",
  "requestId": "...",
  "method": "GET",
  "path": "/api/packages",
  "statusCode": 200,
  "durationMs": 123
}
```

For 4xx responses, use `info` unless it indicates likely abuse:

- validation errors: `info`
- missing/invalid auth token: `warn`
- rate limit: `warn`

For 5xx responses, use `error`.

## Business Event Logs

Emit business logs around these operations:

### Auth

- `auth.login.started`
- `auth.login.success`
- `auth.login.failed`
- `auth.logout.started`
- `auth.logout.success`
- `auth.logout.upstream_failed_local_session_removed`

Allowed fields:

- `requestId`
- `phoneHash`
- `sessionTokenHash` after token creation
- `durationMs`
- `reason`

Forbidden fields:

- plaintext phone
- plaintext password
- Bearer token
- cookies

### Packages

- `packages.list.started`
- `packages.list.success`
- `packages.get.started`
- `packages.get.success`
- `packages.create.started`
- `packages.create.success`
- `packages.delete.started`
- `packages.delete.success`
- `packages.patch.started`
- `packages.patch.delete_success_create_failed`
- `packages.patch.success`

Allowed fields:

- `requestId`
- `sessionTokenHash`
- `packageId`
- `trackCode`
- `page`
- `packageCount`
- `currentStatusLabel`
- `durationMs`

`trackCode` is allowed because it is not a credential. If this becomes sensitive
later, hash it using the same strategy as phone/session token.

## Upstream Logs

Wrap upstream calls in a helper that records duration and outcome.

Events:

- `upstream.login.completed`
- `upstream.logout.completed`
- `upstream.list.completed`
- `upstream.add.completed`
- `upstream.delete.completed`
- `upstream.relogin.started`
- `upstream.relogin.success`
- `upstream.relogin.failed`

Fields:

- `requestId`
- `upstreamEndpoint`: logical name, e.g. `login`, `list`, `add`
- `upstreamPath`: path only, e.g. `/login.php`
- `upstreamStatus`
- `durationMs`
- `retryAttempt`
- `sessionExpiredDetected`

For parser diagnostics:

- `site_parser.packages.parsed`
- `site_parser.user_id.resolved`
- `site_parser.user_id.failed`

Parser log fields:

- `packageCount`
- `statusRowsCount`
- `activeStatusCount`
- `inactiveStatusCount`
- `userIdSource`: `cuid` | `html_input` | `html_data_attr` | `script`

Do not log full upstream HTML. On parser failure, log only:

- upstream status
- content-type
- sanitized page title if available
- first 120 characters of normalized text, with digits longer than 4 masked

## Redaction Rules

Must redact or avoid logging:

- `password`
- `SMOKE_PASSWORD`
- `Authorization`
- Bearer token
- `PHPSESSID`
- `cuid`
- `cups`
- serialized cookie jar
- `passwordEncrypted`
- `APP_MASTER_KEY`
- full request body for `/api/auth/login`
- full upstream HTML

Use hashes for correlation:

```ts
hashForLog(value) = 'sha256:' + sha256(value).slice(0, 12)
```

Recommended hashed fields:

- `phoneHash`
- `sessionTokenHash`

## Error Logging

Add a global exception filter or interceptor that logs unexpected errors with:

- `requestId`
- `event: "http.request.failed"`
- `errorName`
- `errorMessage`
- sanitized stack in non-production only
- `statusCode`

Production logs should not include full stack traces by default unless
`LOG_STACKS=true`.

Known expected errors should be logged tersely:

- invalid credentials
- validation errors
- missing token
- package not found

## Log Levels

- `debug`: low-level parser details, disabled by default in production.
- `info`: successful requests and business operations.
- `warn`: expected but important failures, upstream parse drift, auth failures,
  rate limits, relogin attempts.
- `error`: unexpected exceptions, upstream unavailable, repeated relogin
  failure, DB errors.

Config:

```env
LOG_LEVEL=info
LOG_FORMAT=json
LOG_STACKS=false
```

Defaults:

- production: `LOG_LEVEL=info`, `LOG_FORMAT=json`, `LOG_STACKS=false`
- development/test: can use readable format if desired, but JSON is acceptable.

## Implementation Notes

Preferred implementation:

- Add `LoggingModule` / `AppLogger` under `src/common/logging/`.
- Use Nest's logger interface or a small custom logger writing JSON to stdout.
- Add request context via middleware. If async context is needed, use
  `AsyncLocalStorage`.
- Keep service logging explicit around business and upstream boundaries.
- Do not add large dependencies unless there is a clear operational benefit.

## Runbook Commands

Document:

```bash
ssh 2k-cargo-api
cd /opt/2k-cargo-api
sudo docker compose logs --tail=200 app
sudo docker compose logs --tail=200 caddy
sudo docker compose logs -f app
```

Useful filters:

```bash
sudo docker compose logs app | grep '"requestId":"...'
sudo docker compose logs app | grep '"event":"upstream.list.completed"'
sudo docker compose logs app | grep '"level":"error"'
```

If `jq` is installed:

```bash
sudo docker compose logs app --no-log-prefix | jq 'select(.level=="error")'
```
