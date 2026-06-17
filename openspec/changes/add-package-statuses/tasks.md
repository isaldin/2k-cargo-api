## 1. API Contract

- [x] 1.1 Add `PackageStatus` type/DTO in `src/site-client/package.types.ts`.
- [x] 1.2 Extend `Package` with `currentStatus: PackageStatus | null` and
      `statuses: PackageStatus[]`.
- [x] 1.3 Add Swagger `@ApiProperty` metadata for the new fields.
- [x] 1.4 Regenerate `openapi.yaml`.

## 2. Upstream Parser

- [x] 2.1 Update `SiteClientService.parsePackages` to extract status rows from
      the package card/container.
- [x] 2.2 Detect active rows from green upstream markers, primarily
      `text-success`.
- [x] 2.3 Detect inactive/future rows from gray markers, primarily
      `text-secondary`.
- [x] 2.4 Parse trailing timestamps in `(YYYY-MM-DD HH:mm:ss)` format.
- [x] 2.5 Compute `currentStatus` as the last active status in DOM order.
- [x] 2.6 Return `currentStatus: null` when there are no active statuses.

## 3. Tests

- [x] 3.1 Add fixture/helper for current upstream card layout with mixed green
      and gray statuses.
- [x] 3.2 Add e2e test: active rows followed by gray rows returns the lower
      green row as `currentStatus`.
- [x] 3.3 Add e2e test: all rows green returns the last row as
      `currentStatus`.
- [x] 3.4 Add e2e test: no active rows returns `currentStatus: null`.
- [x] 3.5 Keep existing tests for `id`, `trackCode`, and `name` passing.

## 4. Verification

- [x] 4.1 Run `npm test`.
- [x] 4.2 Run `npm run build`.
- [x] 4.3 Run `npm run lint`.
- [ ] 4.4 Run local upstream smoke against a real test account.
- [ ] 4.5 Deploy to VPS and rerun smoke against
      `https://2k-cargo-api.saldin.cloud`.
