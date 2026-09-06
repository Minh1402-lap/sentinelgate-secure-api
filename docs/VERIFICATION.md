# SentinelGate v1.0 Verification Evidence

Verified locally on 2026-09-06 with Node.js 22, Docker Desktop, the canonical root Compose stack, and MySQL 8.4.

## Static and automated gates

| Gate | Result |
| --- | --- |
| Prisma Client generation | Pass, Prisma 7.10.0 |
| TypeScript typecheck | Pass |
| Automated tests | Pass, 22/22 |
| Production build | Pass |
| Prisma schema validation | Pass |
| Prisma migration status | Pass, 4 migrations applied |
| OpenAPI recommended lint | Pass, 0 errors/warnings |
| npm dependency audit | Pass, 0 vulnerabilities |
| Docker image build | Pass, production dependencies reported 0 vulnerabilities |

## Runtime smoke test

| Scenario | Expected | Observed |
| --- | --- | --- |
| API/database health | HTTP 200, database connected | Pass |
| New registration | HTTP 202 generic response | Pass |
| Duplicate registration | Same HTTP 202 body | Pass |
| Valid login | HTTP 200 | Pass |
| Profile update | HTTP 200 plus audit event | Pass |
| Admin list/view | HTTP 200 plus audit events | Pass |
| Admin role downgraded with old token | HTTP 403 | Pass |
| User disabled with old token | HTTP 401 | Pass |
| Five incorrect logins | Five HTTP 401 responses | Pass |
| Correct password after backend restart | HTTP 403 `ACCOUNT_UNAVAILABLE` | Pass |
| Sensitive values in smoke-test audit rows | Zero matching rows | Pass |

## Audit evidence observed

- `LOGIN_SUCCEEDED / SUCCESS`
- `LOGIN_FAILED / FAILURE`
- `LOGIN_FAILED / DENIED`
- `ACCOUNT_LOCKED / SUCCESS`
- `PROFILE_UPDATED / SUCCESS`
- `ADMIN_USERS_LISTED / SUCCESS`
- `ADMIN_USER_VIEWED / SUCCESS`

The smoke test used disposable unique email addresses. Tokens, database credentials, and password values were kept in process memory and were not printed into this evidence file.

## Reproduction

Run the commands in the README verification section, then follow the demonstration order in `RELEASE_CHECKLIST.md`. CI repeats the database-independent generation, typecheck, test, build, schema validation, OpenAPI lint, and dependency audit gates.
