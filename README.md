# SentinelGate / SentinelVault v1.0

SentinelVault is a security-focused TypeScript/Express backend protected by the first SentinelGate controls. The v1.0 scope demonstrates secure authentication, database-backed authorization state, abuse resistance, structured audit evidence, and repeatable verification.

## What v1.0 includes

- Registration with bcrypt password hashing and an enumeration-resistant response.
- Login with short-lived HS256 JWT access tokens and fixed issuer/audience validation.
- Role and account status revalidation from the database on every protected request.
- Persistent failed-login tracking and a 15-minute lock after five incorrect passwords.
- Separate login and registration rate limits, plus optional Arcjet bot/shield protection.
- Helmet security headers, a configured CORS allowlist, strict request validation, and generic 500 responses.
- Structured audit logs for login success/failure, lockout, profile updates, and admin reads.
- Recursive redaction of password, token, authorization, secret, and cookie fields before audit writes.
- Automated tests for authentication, authorization, rate limiting, lockout, audit redaction, CORS, database health, malformed JSON, and error exposure.

Private file storage, refresh tokens, session revocation, distributed rate limiting, automated response, and a separate SentinelGate defense database are intentionally outside v1.0.

## Architecture

```text
client
  |
  | HTTP / JSON
  v
Express API
  |-- validation, Helmet, CORS
  |-- rate limit and optional Arcjet
  |-- authentication and current DB authorization state
  |-- audit redaction
  v
MySQL-compatible application database
  |-- users
  `-- audit_logs
```

See [Architecture](docs/ARCHITECTURE.md), [Threat model](docs/THREAT_MODEL.md), and [OpenAPI](docs/openapi.yaml) for the detailed contracts and security boundaries.

## Requirements

- Node.js 22.12 or newer
- npm
- Docker Desktop with Linux containers

## Configuration

Copy the safe template and replace every placeholder locally. Never commit `.env`.

```powershell
Copy-Item .env.example .env
Copy-Item .env protected-app/.env
```

Important settings:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Local Prisma connection, normally `127.0.0.1:3307` |
| `DOCKER_DATABASE_URL` | Backend-to-database connection inside Compose |
| `JWT_SECRET` | Random secret of at least 32 characters |
| `JWT_EXPIRES_IN` | Access-token lifetime; default `15m` |
| `JWT_ISSUER` | Required token issuer; default `sentinelgate` |
| `JWT_AUDIENCE` | Required token audience; default `sentinelvault-api` |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API |
| `ARCJET_KEY` | Optional Arcjet key; local rate limiting remains active without it |

Use URL encoding for password characters that have special meaning inside database URLs.

## Run locally

From the repository root:

```powershell
docker compose up --build -d
docker compose ps
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

The published API and database ports bind to loopback only. To stop services without deleting database data:

```powershell
docker compose stop
```

For a local Node process with only the database in Docker:

```powershell
docker compose up -d database
Set-Location protected-app
npm ci
npm run prisma:generate
npx prisma migrate deploy
npm run dev
```

## Verification

Run from `protected-app`:

```powershell
npm run typecheck
npm test
npm run build
npx prisma validate
npx prisma migrate status
npm audit
```

Tests use an in-memory user and audit store, so they do not modify the development database. Database migrations and the Compose health check verify the real persistence path separately.

## API summary

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Check API/database readiness |
| POST | `/api/auth/register` | Public | Submit registration; always returns a generic `202` for valid input |
| POST | `/api/auth/login` | Public | Receive a short-lived access token |
| GET | `/api/users/me` | Bearer token | Read the current profile |
| PATCH | `/api/users/me` | Bearer token | Update the current display name |
| GET | `/api/admin/users` | Current admin role | List users with pagination |
| GET | `/api/admin/users/:id` | Current admin role | Read one user |

Successful responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "code": "...", "message": "..." } }`.

The registration endpoint deliberately does not reveal whether an email already exists. A valid new request and a duplicate request receive the same status and body.

## Security notes

- Password hashes, failed-attempt counters, lock timestamps, tokens, and secrets are excluded from API responses.
- JWT role claims are not trusted for authorization; the current role/status/lock state is loaded from the database.
- Audit details are sanitized before persistence, but access to the audit table must still be restricted operationally.
- The local rate limiter is process-local. Multi-instance production deployment requires a shared rate-limit store or an edge control.
- Lockout can be abused for account-denial attacks. The fixed expiry limits impact; the residual risk is documented in the threat model.
- Stolen access tokens remain usable until expiry unless the account is disabled, locked, or its authorization changes.

## Release

The release checklist and reproducible evidence steps are in [Release checklist](docs/RELEASE_CHECKLIST.md). Changes should be tagged only after CI, Docker health, migrations, and secret checks pass on the release commit.
