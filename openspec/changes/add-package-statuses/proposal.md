## Why

The API currently returns only package identity fields: `id`, `trackCode`, and
`name`. The upstream package page also contains package status lines, but the
wrapper parser discards them. Users need the API to expose both the full visible
status list and the actual current status.

The current upstream HTML distinguishes status state visually:

- active/completed status rows are green;
- inactive/future status rows are gray;
- rows are ordered from older to newer, so the lower active row is the freshest
  active status.

This matters because gray rows can appear below active rows. For example,
`Прибыл в Алмату` and `Прибыл в город Караганда` can be visible but gray; they
must not be treated as current until they become green.

## What Changes

- Extend package parsing to extract status rows from upstream HTML cards.
- Add status fields to API package responses without removing existing fields.
- Determine `currentStatus` as the last green/active status row in DOM order.
- Preserve inactive gray rows in `statuses[]` with `active: false`.
- Add fixtures and e2e tests covering active green rows, inactive gray rows, and
  the "lower green row wins" rule.
- Regenerate OpenAPI after implementation.

## Current API Support

Not supported.

Current `Package` response schema:

```json
{
  "id": 175357,
  "trackCode": "JT5495066836397",
  "name": "Органайзер в рюкзак"
}
```

Current parser location:

- `src/site-client/site-client.service.ts`
- `parsePackages(html: string): Package[]`

Current OpenAPI schema also exposes only `id`, `trackCode`, and `name`.

## Target API Shape

Package responses should remain backward compatible and add:

```json
{
  "id": 175357,
  "trackCode": "JT5495066836397",
  "name": "Органайзер в рюкзак",
  "currentStatus": {
    "label": "В пути",
    "timestamp": "2026-06-15T12:01:06+05:00",
    "rawTimestamp": "2026-06-15 12:01:06",
    "active": true
  },
  "statuses": [
    {
      "label": "Принят на складе Китая",
      "timestamp": "2026-06-14T11:34:29+05:00",
      "rawTimestamp": "2026-06-14 11:34:29",
      "active": true
    },
    {
      "label": "Отправлен со склада Китая",
      "timestamp": "2026-06-15T12:00:13+05:00",
      "rawTimestamp": "2026-06-15 12:00:13",
      "active": true
    },
    {
      "label": "В пути",
      "timestamp": "2026-06-15T12:01:06+05:00",
      "rawTimestamp": "2026-06-15 12:01:06",
      "active": true
    },
    {
      "label": "Прибыл в Алмату",
      "timestamp": null,
      "rawTimestamp": null,
      "active": false
    },
    {
      "label": "Прибыл в город Караганда",
      "timestamp": null,
      "rawTimestamp": null,
      "active": false
    }
  ]
}
```

## Impact

- Public API response schema changes additively.
- `GET /api/packages`, `GET /api/packages/:id`, `POST /api/packages`, and
  `PATCH /api/packages/:id` should all return the enriched package shape.
- Existing clients reading only `id`, `trackCode`, and `name` should continue to
  work.
