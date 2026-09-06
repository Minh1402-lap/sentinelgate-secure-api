# SentinelGate v1.0 Threat Model

## Scope and security objective

This model covers the SentinelVault HTTP API, its authentication and authorization controls, the application database, and audit records. The objective is to prevent unauthorized account access, limit automated abuse, preserve useful investigation evidence, and avoid exposing credentials or internal failures.

The future public gateway, private file storage, a separate SentinelGate defense database, detection pipelines, and automated response are outside v1.0.

## Assets

- Passwords and bcrypt password hashes.
- JWT signing secret and issued access tokens.
- User identity, profile, role, status, and lockout state.
- Administrative user-list data.
- Audit evidence: actor, action, outcome, source IP, user-agent, and sanitized metadata.
- Database credentials and service availability.

## Actors

- Anonymous client: may register, log in, and check health.
- Authenticated user: may read and update their own profile.
- Administrator: may list and view users.
- Internet attacker: attempts credential stuffing, brute force, enumeration, token forgery, injection, or denial of service.
- Malicious/compromised account: attempts privilege escalation or access after disablement/demotion.
- Operator: configures secrets, migrations, deployment, and access to audit data.

## Trust boundaries

1. Client to API: all headers, JSON, IP information, and tokens are untrusted.
2. Browser origin to API: only configured CORS origins receive browser access; CORS is not authentication.
3. API to database: a credentialed private connection stores users, lockout state, and v1.0 audit logs.
4. JWT to live authorization state: signature/claims establish token authenticity, while current role/status/lock state comes from the database.
5. Application audit boundary: event details are sanitized before persistence. Audit readers remain privileged operators.
6. Future SentinelVault-to-SentinelGate boundary: security events must eventually cross a narrow validated interface instead of sharing application credentials.

## Primary threats and controls

| Threat | Impact | v1.0 controls | Residual risk |
| --- | --- | --- | --- |
| Password brute force / credential stuffing | Account takeover | bcrypt, per-IP login limit, optional Arcjet, persistent per-account lockout | Distributed attacks and lockout abuse remain possible |
| Email enumeration | Privacy loss and targeted attacks | Valid new/duplicate registrations return the same `202` body; bcrypt work occurs before existence handling | Timing may still vary slightly due to database writes |
| JWT forgery or algorithm confusion | Authentication bypass | HS256 allowlist, fixed issuer/audience, strong secret validation, short expiry | Secret compromise invalidates the trust model |
| Stale role/status in a token | Privilege retention | Every protected request reloads current user role/status/lock state | Database availability is required for authorization |
| Stolen access token | Session hijack | Short expiry and live disable/lock/role checks | No token revocation or refresh-token rotation in v1.0 |
| Mass assignment / privilege escalation | Admin access | Strict Zod schemas and profile update allowlist | Future write endpoints require equivalent validation |
| Injection / malformed payload | Data corruption or service failure | JSON size limit, schema validation, Prisma parameterization, malformed JSON handling | Parser/library vulnerabilities require patch management |
| Cross-origin browser abuse | Unauthorized frontend access | Explicit CORS allowlist and no credentialed cookies | Non-browser clients are unaffected by CORS |
| Sensitive data in API errors/logs | Credential or topology disclosure | Generic 500 response, safe error summary, audit-key redaction | Operators must restrict infrastructure logs and database access |
| Audit tampering or loss | Weakened investigation | Structured append-only application writes and indexed timestamps/actions | v1.0 audit logs share the application DB and lack cryptographic integrity |
| Dependency compromise | Runtime/build compromise | Lockfile, CI install, automated test/build, `npm audit` release check | Registry or maintainer compromise cannot be eliminated locally |
| Database outage | Authentication/API outage | Health endpoint returns 503; generic unexpected errors | v1.0 has no database failover |

## Abuse cases to verify

- Five incorrect passwords create five failed-login events and one account-lock event.
- Lockout remains after the API process restarts because state is stored in the database.
- A disabled user cannot use an older valid token.
- A downgraded administrator loses admin access without waiting for token expiry.
- HS384, wrong issuer/audience/signature, and expired tokens are rejected.
- Duplicate registration cannot be distinguished by status or response body.
- Audit metadata never stores password/token/authorization/secret/cookie values.
- Unexpected failures return a generic response and a safe log summary.

## Operational assumptions

- TLS terminates at a trusted reverse proxy or gateway in production.
- `JWT_SECRET` and database credentials are generated securely and injected through a secret manager or protected environment.
- Proxy trust is configured only for known proxies; otherwise source IP attribution may be wrong.
- Database and audit access are limited by least privilege and backups are protected.
- CORS origins are set to production domains, not wildcard values.

## Deferred improvements

- Shared/distributed rate-limit storage.
- Session table, logout revocation, refresh-token rotation, and token versioning.
- MFA and breached-password screening.
- Dedicated immutable SentinelGate event/audit store with retention and integrity controls.
- Detection rules, policy evaluation, and reversible automated response.
- High availability for the database and API.
