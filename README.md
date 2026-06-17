# 2K Cargo API Wrapper

REST API wrapper over the 2K Cargo tracking website at
`https://2k-cargo-krg.kz/`.

The service logs in to the upstream website with a user's 2K Cargo credentials,
stores an encrypted local API session, and exposes JSON endpoints for package
listing, creation, deletion, and update. The upstream website does not provide a
native edit endpoint, so package updates are implemented as delete plus create.

## Features

- Login with a 2K Cargo phone/password pair.
- Opaque Bearer API tokens for wrapper sessions.
- Upstream password encryption at rest with AES-256-GCM.
- SQLite persistence for API sessions.
- Automatic upstream relogin when upstream cookies expire.
- Package list, get, create, delete, and patch endpoints.
- DTO validation, Helmet, auth rate limiting, and OpenAPI docs.
- TypeORM migrations for production schema setup.
- Docker and Ansible deployment assets.
- Optional idle session TTL.

## Stack

- Node.js 20 recommended, Node.js 18 minimum.
- NestJS 11 + TypeScript.
- TypeORM + SQLite.
- Axios + tough-cookie for upstream sessions.
- Cheerio for upstream HTML parsing.
- Docker Compose for runtime.
- Ansible + Caddy for VPS deployment.

## API

The app uses the global `/api` prefix.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | No | Create wrapper session. |
| `POST` | `/api/auth/logout` | Bearer | Logout upstream and remove local session. |
| `GET` | `/api/packages?page=1` | Bearer | List packages from upstream. |
| `GET` | `/api/packages/:id` | Bearer | Get package by upstream item id. |
| `POST` | `/api/packages` | Bearer | Add package. |
| `DELETE` | `/api/packages/:id` | Bearer | Delete package. |
| `PATCH` | `/api/packages/:id` | Bearer | Update package via delete plus create. |

Interactive docs are available at:

```text
http://localhost:3000/api/docs
```

The generated OpenAPI file is committed as `openapi.yaml`. Regenerate it after
API changes:

```bash
npm run openapi:generate
```

## Configuration

Copy the example env file:

```bash
cp .env.example .env
```

Variables:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `APP_PORT` | No | `3000` | HTTP port. |
| `APP_MASTER_KEY` | Yes | none | Must be exactly 32 bytes. Keep it stable. Losing it makes stored upstream passwords undecryptable. |
| `SITE_BASE_URL` | No | `https://2k-cargo-krg.kz` | Upstream site URL. |
| `DATABASE_PATH` | No | `./data/sessions.sqlite` | SQLite database path. |
| `DATABASE_SYNCHRONIZE` | No | `true` outside production, `false` in production | Keep `false` in production and use migrations. |
| `PACKAGE_SCAN_PAGE_LIMIT` | No | `10` | Page scan limit for lookup operations. |
| `AUTO_RELOGIN_RETRY_LIMIT` | No | `1` | Retries after upstream session expiry. |
| `SESSION_TTL_SECONDS` | No | disabled | Optional idle TTL for wrapper sessions. |
| `LOG_LEVEL` | No | `info` | Application log level: `debug`, `info`, `warn`, `error`. |
| `LOG_FORMAT` | No | `json` | Output format: `json` for aggregators, `pretty` for local development. |
| `LOG_STACKS` | No | `false` | Include stack traces in error logs. Keep `false` in production. |

## Local Development

Install dependencies:

```bash
npm install
```

Prepare local environment:

```bash
cp .env.example .env
mkdir -p data
```

Start the app:

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api`.

## Docker

Run locally with Docker Compose:

```bash
cp .env.example .env
docker compose up --build
```

The Compose file mounts `./data` into the container for SQLite persistence.

For production, keep:

```env
DATABASE_SYNCHRONIZE=false
```

The app runs TypeORM migrations at startup.

## Usage Examples

Login:

```bash
curl -sS -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"77000000000","password":"YOUR_PASSWORD"}'
```

List packages:

```bash
curl -sS http://localhost:3000/api/packages?page=1 \
  -H "Authorization: Bearer $TOKEN"
```

Create package:

```bash
curl -sS -X POST http://localhost:3000/api/packages \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"trackCode":"ABC123456789","name":"Sneakers order #42"}'
```

Update package:

```bash
curl -sS -X PATCH http://localhost:3000/api/packages/12345 \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Updated order #42"}'
```

`PATCH` deletes the old upstream item and creates a new one, so the returned
package has a new upstream id.

Delete package:

```bash
curl -i -X DELETE http://localhost:3000/api/packages/12345 \
  -H "Authorization: Bearer $TOKEN"
```

Logout:

```bash
curl -i -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

## Tests and Checks

Run the full automated test suite:

```bash
npm test
```

Run unit or e2e tests separately:

```bash
npm run test:unit
npm run test:e2e
```

Build and lint:

```bash
npm run build
npm run lint
```

Audit dependencies:

```bash
npm audit --audit-level=moderate
```

## Upstream Smoke Test

The smoke script validates the deployed service against the real upstream with a
test 2K Cargo account. It runs:

```text
login -> list -> create -> get -> delete -> logout
```

Run it from a trusted machine:

```bash
APP_BASE_URL=https://api.example.com \
SMOKE_PHONE=77000000000 \
SMOKE_PASSWORD='YOUR_PASSWORD' \
SMOKE_TRACK_CODE="SMOKE-$(date -u +%Y%m%d%H%M%S)" \
SMOKE_PACKAGE_NAME='Smoke Test Package' \
npm run smoke:upstream
```

The script requires `SMOKE_TRACK_CODE` to start with `SMOKE-`, never logs the
password, and attempts cleanup on failure.

## Production Logs

Every request and business operation emits structured JSON logs to stdout/stderr.
The `X-Request-Id` response header is also included in every response and can be
used to correlate all log lines for a single request.

On the VPS, inspect recent application logs:

```bash
ssh 2k-cargo-api
cd /opt/2k-cargo-api
sudo docker compose logs --tail=200 app
sudo docker compose logs --tail=200 caddy
```

Follow logs live:

```bash
sudo docker compose logs -f app
```

Filter by `requestId`, event, or level:

```bash
sudo docker compose logs app | grep '"requestId":"01JZ...'
sudo docker compose logs app | grep '"event":"upstream.list.completed"'
sudo docker compose logs app | grep '"level":"error"'
```

If `jq` is available:

```bash
sudo docker compose logs app --no-log-prefix | jq 'select(.level=="error")'
```

Log configuration:

- `LOG_LEVEL=info` — recommended in production.
- `LOG_FORMAT=json` — recommended for Docker log drivers.
- `LOG_STACKS=false` — keep `false` in production to avoid leaking internals.

Secrets such as passwords, Bearer tokens, cookies, and the master key are
redacted before writing to the log stream.

## VPS Deployment

Ansible deployment assets live in `ansible/`.

Start with [ansible/README.md](ansible/README.md).

The cookbook covers:

- creating a dedicated VPS user;
- importing SSH keys;
- configuring local SSH aliases;
- setting non-secret vars and encrypted Ansible Vault secrets;
- giving the VPS GitHub repository access;
- installing Docker and Caddy;
- deploying the app with Docker Compose;
- setting up SQLite backups.

Typical deploy command:

```bash
ANSIBLE_CONFIG=ansible/ansible.cfg \
ansible-playbook -i ansible/inventory.ini ansible/playbooks/deploy.yml --ask-vault-pass
```

Do not commit real `ansible/inventory.ini` or
`ansible/group_vars/cargo_api/vault.yml`.

## Security Notes

- `APP_MASTER_KEY` must be stable and secret. Rotate it only with a migration
  plan for existing encrypted passwords.
- Upstream passwords are encrypted at rest, but the service can decrypt them for
  automatic relogin.
- Bearer tokens are opaque. Without `SESSION_TTL_SECONDS`, they remain valid
  until explicit logout.
- Keep `DATABASE_SYNCHRONIZE=false` in production.
- Do not expose the app container directly in production; use the provided Caddy
  reverse proxy or an equivalent TLS proxy.
- Never log or commit upstream account passwords.

## Pre-Push Checklist

Run before pushing deployment-ready changes:

```bash
npm test
npm run build
npm run lint
npm audit --audit-level=moderate
npm run openapi:generate
docker compose build app
```

Check that these files are not committed with real local data or secrets:

- `.env`
- `data/*.sqlite`
- `ansible/inventory.ini`
- `ansible/group_vars/cargo_api/vault.yml`

## Project Layout

```text
src/
  auth/          Login/logout API and Bearer auth guard
  common/        Encryption, validation, and shared utilities
  config/        Environment parsing and validation
  database/      TypeORM setup
  migrations/    Production database migrations
  packages/      Package REST API
  session/       Local API session persistence
  site-client/   2K Cargo upstream integration
test/
  e2e/           End-to-end tests with nock
  helpers/       Test app/session/nock helpers
ansible/         VPS deployment cookbook
scripts/         OpenAPI and upstream smoke scripts
```
