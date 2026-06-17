## Context

The upstream package list is HTML. Current observed card layout:

```html
<div class="card">
  <div class="card-body">
    <form method="POST">
      <button type="submit" class="btn btn-danger float-right" name="delete_item" value="176109">Х</button>
    </form>
    <h5 class="card-title">Трек-код: JT5495066836397</h5>
    <h6 class="card-subtitle mb-2 text-muted">Наименование: Органайзер в рюкзак</h6>
    <ul class="list-group list-group-flush">
      <li class="list-group-item text-success">Принят на складе Китая (2026-06-14 11:34:29)</li>
      <li class="list-group-item text-success">Отправлен со склада Китая (2026-06-15 12:00:13)</li>
      <li class="list-group-item text-success">В пути (2026-06-15 12:01:06)</li>
      <li class="list-group-item text-secondary">Прибыл в Алмату</li>
      <li class="list-group-item text-secondary">Прибыл в город Караганда</li>
    </ul>
  </div>
</div>
```

Observed class names:

- `text-success`: active/completed status row.
- `text-secondary`: inactive/future status row.

The current status is not simply the last visible row. It is the last active
green row in DOM order.

## API Contract

Add a `PackageStatus` DTO/type:

```ts
export class PackageStatus {
  label: string;
  timestamp: string | null;
  rawTimestamp: string | null;
  active: boolean;
}
```

Extend `Package`:

```ts
export class Package {
  id: number;
  trackCode: string;
  name: string;
  currentStatus: PackageStatus | null;
  statuses: PackageStatus[];
}
```

`timestamp` should be an ISO-8601 string with the service timezone offset. The
deployment timezone is `Asia/Almaty`, currently UTC+05:00 on 2026-06-17. Keep
`rawTimestamp` so clients can compare against the exact upstream text if needed.

If timezone conversion is considered too risky for the first implementation,
ship `timestamp: null` and `rawTimestamp` first, but keep the field in the
contract.

## Parsing Rules

For each parsed package card/container:

1. Extract package id from `button[name="delete_item"]`,
   `input[name="delete_item"]`, or `delete_item=<id>` URLs.
2. Extract `trackCode` from `Трек-код: ...`.
3. Extract `name` from `Наименование: ...`.
4. Extract candidate status rows from list items inside the same package
   container, preferably:
   - `.list-group-item`
   - `li`
5. For each status row:
   - `rawText` is trimmed row text.
   - `active = true` when the row itself has `text-success` or contains an
     active success/check icon that upstream uses for green rows.
   - `active = false` when the row has `text-secondary`, muted/gray styling, or
     does not match the active marker.
   - parse trailing timestamp only when text ends with
     `(YYYY-MM-DD HH:mm:ss)`.
   - `label` is row text without the trailing timestamp parentheses.
6. `statuses` preserves upstream DOM order.
7. `currentStatus` is the last item in `statuses` where `active === true`.
8. If no active statuses exist, return `currentStatus: null`.

Do not infer current status from gray rows, even if they appear below active
rows. Do not infer current status from the most recent timestamp alone; visual
active state is authoritative.

## Status Examples

### Current Status Is "В пути"

Rows:

```text
green Принят на складе Китая (2026-06-14 11:34:29)
green Отправлен со склада Китая (2026-06-15 12:00:13)
green В пути (2026-06-15 12:01:06)
gray  Прибыл в Алмату
gray  Прибыл в город Караганда
```

Result:

```json
{
  "currentStatus": {
    "label": "В пути",
    "rawTimestamp": "2026-06-15 12:01:06",
    "active": true
  }
}
```

### Current Status Is "Прибыл в город Караганда"

Rows:

```text
green Принят на складе Китая (2026-06-14 11:34:29)
green Отправлен со склада Китая (2026-06-15 12:00:13)
green В пути (2026-06-15 12:01:06)
green Прибыл в Алмату (2026-06-16 18:00:00)
green Прибыл в город Караганда (2026-06-17 09:00:00)
```

Result:

```json
{
  "currentStatus": {
    "label": "Прибыл в город Караганда",
    "rawTimestamp": "2026-06-17 09:00:00",
    "active": true
  }
}
```

## Compatibility

This is an additive response change. Existing package endpoints keep the same
paths and status codes. Existing clients that ignore unknown fields remain
compatible.

## Open Questions

- Should `timestamp` be normalized to `Asia/Almaty` ISO strings immediately, or
  should the first release expose only `rawTimestamp`?
- Does upstream ever mark active rows with an icon instead of `text-success`?
  If yes, add that fixture before implementation.
