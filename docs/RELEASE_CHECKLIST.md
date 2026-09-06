# SentinelGate v1.0 Release Checklist

## Automated gates

- [ ] `npm ci`
- [ ] `npm run prisma:generate`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npx prisma validate`
- [ ] `npx prisma migrate status`
- [ ] `npm audit --audit-level=high`

## Runtime evidence

- [ ] `docker compose up --build -d` completes.
- [ ] Database and backend report healthy.
- [ ] `/api/health` returns HTTP 200 with database availability.
- [ ] Registration returns the same HTTP 202 body for a new and duplicate email.
- [ ] Five incorrect logins persist a lock; correct login remains denied after backend restart.
- [ ] Audit rows exist for login, lockout, profile update, and admin reads without sensitive values.
- [ ] Disabled-user and downgraded-admin tokens are rejected/forbidden as documented.

## Release hygiene

- [ ] `.env` and credentials are absent from tracked files and Git history.
- [ ] README, OpenAPI, architecture, and threat model match the shipped behavior.
- [ ] Working tree contains only intended release changes.
- [ ] CI is green on the release commit.
- [ ] Create annotated tag `v1.0` only after every required gate passes.

## Demonstration order

1. Show Compose health and `/api/health`.
2. Show enumeration-resistant registration.
3. Log in and access `/api/users/me`.
4. Trigger five failed logins and show persistent lockout after restart.
5. Show current-role/current-status authorization behavior.
6. Query sanitized `audit_logs` evidence.
7. Show the CI run, threat model, and zero-vulnerability audit result.
