## Context

The project is a fresh NestJS 10 REST API wrapper around the 2K Cargo cargo-tracking website. The upstream site exposes only HTML form endpoints (login, list packages, add package, delete package, logout) and has no native edit endpoint. The wrapper must authenticate on behalf of users, persist session state securely, and expose a clean JSON API for package management.

Current state: repository contains `AGENTS.md` with researched upstream endpoints and intended architecture, but no implementation yet.

Constraints:
- Upstream sessions are cookie-based (`PHPSESSID`, `cuid`, `cups`).
- Upstream has no PATCH/PUT endpoint; edits must be emulated as delete+create.
- Passwords must be encrypted at rest with a user-supplied 32-byte master key.
- No upstream response caching.

## Goals / Non-Goals

**Goals:**
- Provide `/api/auth/login` and `/api/auth/logout` with opaque Bearer tokens.
- Provide `/api/packages` CRUD endpoints backed by upstream HTML pages.
- Maintain upstream cookie sessions per API user with auto-relogin on expiry.
- Encrypt sensitive session data (upstream password) using AES-256-GCM.
- Secure the API with helmet, rate limiting on auth endpoints, and DTO validation.
- Ship Docker and Docker Compose setup for easy deployment.

**Non-Goals:**
- Caching upstream responses.
- Web UI or frontend.
- Real-time tracking updates/webhooks.
- Support for upstream endpoints other than login/logout/package management.

## Decisions

1. **NestJS 10 + TypeORM + SQLite**
   - Rationale: Team familiarity, built-in DI, minimal infrastructure, and sufficient for session persistence.
   - Alternative considered: Fastify + Prisma + Postgres — rejected to keep deployment simple.

2. **AES-256-GCM for password encryption**
   - Rationale: Authenticated encryption prevents tampering and provides strong confidentiality.
   - Master key is provided via `APP_MASTER_KEY` environment variable and must be exactly 32 bytes.

3. **tough-cookie CookieJar per session**
   - Rationale: The upstream site uses multiple cookies; a serialized CookieJar lets us restore and refresh sessions per API token.
   - Stored as a text blob in SQLite alongside the session row.

4. **Emulated delete+create for PATCH**
   - Rationale: The upstream site has no edit endpoint. Delete then create gives the closest behavior, with the trade-off that the upstream item id changes and the operation is not atomic.

5. **Auto-relogin on session expiry**
   - Rationale: Improves API reliability; users shouldn't need to re-login when the upstream PHP session expires.
   - Requires decrypting the stored password, which is why encryption must be reversible.

6. **Rate limiting only on auth endpoints**
   - Rationale: Auth endpoints are high-risk for brute force; package endpoints are protected by valid Bearer tokens.

## Risks / Trade-offs

- **[Risk]** Upstream HTML structure changes and breaks parsing.
  - **Mitigation**: Isolate parsing in `SiteClientService`; add integration tests that assert on representative HTML snapshots.
- **[Risk]** Auto-relogin decrypts passwords frequently.
  - **Mitigation**: Keep master key only in memory; never log decrypted values; limit retries to avoid infinite loops.
- **[Risk]** Emulated delete+create for PATCH may lose the package if create fails after delete.
  - **Mitigation**: Return the newly created package when the operation succeeds; document that the id changes and that the operation is not atomic; consider adding manual reconciliation if upstream adds edit support.
- **[Trade-off]** SQLite is simple but not horizontally scalable.
  - **Mitigation**: Document that sessions are node-local; load balancing requires sticky sessions or external session store (future work).
