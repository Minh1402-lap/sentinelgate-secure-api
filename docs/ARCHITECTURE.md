# SentinelGate v1.0 Architecture

## Runtime components

### Protected application

The TypeScript/Express API owns registration, authentication, self-service profile access, and role-gated administrator reads. HTTP middleware applies security headers, a CORS allowlist, request-size limits, schema validation, local rate limits, and optional Arcjet protection.

### Application database

The MySQL-compatible database stores users and structured audit logs. Prisma owns the schema and four migrations. Lockout state is database-backed, so restarting the API does not unlock an account.

### Audit boundary

Controllers and authentication services emit typed events through `AuditService`. The service truncates network fields and recursively replaces values under sensitive keys before `AuditStore` writes them. The current Prisma implementation stores events in `audit_logs`; this is application audit evidence, not the future SentinelGate defense event store.

### Future SentinelGate defense system

The gateway, normalized security-event transport, detection engine, policy evaluator, defender, and separate defense database remain future components. They must use narrow authenticated interfaces rather than direct access to SentinelVault tables.

## Request flow

```text
request
  -> Helmet / CORS / JSON limit
  -> optional Arcjet + endpoint rate limit
  -> input validation
  -> JWT verification (HS256 + issuer + audience + expiry)
  -> current user lookup (role + status + lock)
  -> controller/service
  -> audit sanitization and persistence
  -> generic response envelope
```

Public health and authentication routes skip JWT authentication. Protected routes always query current user state after token verification. Admin middleware authorizes the database role, not a role claim cached in the token.

## Data model

### `users`

- Identity and normalized unique email.
- Bcrypt password hash.
- Optional display name.
- Current role and account status.
- Failed-login count and lock expiry.
- Creation/update timestamps.

### `audit_logs`

- Optional actor relation; logs survive actor deletion through `SET NULL`.
- Typed action and outcome.
- Bounded IP address and user-agent.
- Sanitized JSON details.
- Indexed actor/action timestamps for investigation queries.

## Deployment boundaries

- Compose publishes API port 3000 and database port 3307 on loopback only.
- The backend reaches the database through the private Compose network.
- Production TLS should terminate at a trusted gateway or reverse proxy.
- Proxy trust must be enabled only for known proxy hops before relying on forwarded client IP values.
- Secrets belong in a protected environment/secret manager; `.env` is ignored by Git.

## Availability and failure behavior

- `/api/health` reports database unavailability with HTTP 503.
- Unexpected exceptions return a generic HTTP 500 without exception messages or stack traces.
- Audit persistence is fail-closed for audited successful actions: a login/profile/admin response is not reported successful when its required audit write fails.
- The local rate limiter is process-local and must be replaced with shared state for horizontal scaling.
