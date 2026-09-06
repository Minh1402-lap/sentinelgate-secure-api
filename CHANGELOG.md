# Changelog

All notable changes to SentinelGate are documented in this file.

## 1.0.0 - 2026-09-06

### Added

- Database-backed registration, login, profile, and administrator read APIs.
- Persistent failed-login tracking and timed account lockout.
- Structured audit events for login, lockout, profile updates, and admin reads.
- Audit metadata redaction and bounded network metadata.
- Optional Arcjet request protection and local endpoint rate limits.
- CORS allowlist, Helmet headers, strict validation, and generic error responses.
- OpenAPI contract, threat model, architecture, release checklist, and GitHub Actions CI.

### Security

- Fixed HS256 JWT algorithm, issuer, audience, signature, and expiry verification.
- Revalidated current role, status, and lockout state from the database.
- Made registration responses enumeration-resistant.
- Updated Prisma to 7.10 and pinned patched transitive dependencies.
- Added tests for JWT rejection, role downgrade, disabled users, audit redaction, rate limits, lockout, CORS, and error disclosure.
