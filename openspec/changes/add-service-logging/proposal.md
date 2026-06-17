## Why

The service is now deployed to production and depends on an upstream HTML site.
When something fails, we need enough logs to answer:

- did the request reach our API?
- which endpoint failed?
- did the upstream call fail, return unexpected HTML, or parse incorrectly?
- did auto-relogin happen?
- did the local session/database operation fail?
- what request id should be used to correlate all related log lines?

Current logging is insufficient for production troubleshooting. The app mostly
relies on Nest startup logs and does not emit structured application logs around
auth, package operations, upstream calls, parsing decisions, relogin, or
unexpected errors.

## What Changes

- Add structured JSON application logging.
- Add per-request correlation id (`requestId`) and return it as
  `X-Request-Id`.
- Log request start/end with method, path, status, duration, and sanitized
  context.
- Log upstream calls with endpoint name, upstream status, duration, retry
  attempt, and sanitized diagnostics.
- Log business operations: login/logout/list/get/create/delete/patch.
- Log parser summaries for package list responses, including package count and
  status parsing counts.
- Log auto-relogin attempts and outcomes.
- Add global exception logging for unexpected errors.
- Redact credentials, Bearer tokens, cookies, encrypted password blobs, and
  request bodies containing secrets.
- Document Docker/Caddy log inspection commands in the runbook.

## Current State

Current application logging support:

- Nest startup logs only.
- No request id.
- No structured JSON logs.
- No explicit upstream call logs.
- No parser diagnostics.
- No production runbook section for app logs.

## Target Outcome

Operators can diagnose production issues from:

```bash
ssh 2k-cargo-api
cd /opt/2k-cargo-api
sudo docker compose logs --tail=200 app
sudo docker compose logs --tail=200 caddy
```

Every application log line should be machine-parseable JSON and contain enough
context to correlate failures without exposing secrets.

Example:

```json
{
  "level": "info",
  "time": "2026-06-17T05:30:00.123Z",
  "requestId": "01JZ...",
  "event": "packages.list.success",
  "method": "GET",
  "path": "/api/packages",
  "statusCode": 200,
  "durationMs": 842,
  "sessionTokenHash": "sha256:9b4f...",
  "phoneHash": "sha256:6a9c...",
  "page": 1,
  "packageCount": 5,
  "activeStatusCount": 15,
  "inactiveStatusCount": 10
}
```

## Impact

- Adds logging infrastructure, likely under `src/common/logging/`.
- Adds middleware/interceptor/filter wiring in `src/main.ts` or `AppModule`.
- Adds focused logs in `AuthService`, `PackagesService`, and
  `SiteClientService`.
- Adds tests proving redaction and request id behavior.
- Updates `README.md` or `ansible/README.md` with production log commands.
