# SentinelGate / SentinelVault backend MVP

This repository currently contains the SentinelVault protected application backend: a TypeScript/Express API backed by MySQL 8.4 and Prisma ORM 7. SentinelGate detection and automated response capabilities are reserved for a later security phase.

## Prerequisites

- Node.js 22.12 or newer, npm, and Docker Desktop with Linux containers

## Environment setup (Windows PowerShell)

Copy the safe template and replace every placeholder locally. Never commit `.env`.

```powershell
Copy-Item .env.example .env
Copy-Item .env protected-app/.env
```

The root file configures Compose; `protected-app/.env` configures Prisma and local Node development. Compose gives the backend the private `database:3306` address, while local Node uses `127.0.0.1:3307`. Percent-encode URL-significant password characters in the database URL values.

Create the configured shadow database once before using `prisma migrate dev`:

```powershell
docker compose up -d database
docker exec -it sentinelvault-database mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS sentinelvault_shadow;"
```

The interactive password prompt keeps the root password out of shell history.

## Local development

```powershell
Set-Location protected-app
npm ci
npx prisma generate
npx prisma migrate dev
npm run dev
```

The API listens on `http://127.0.0.1:3000` by default. Verification commands are:

```powershell
npm run typecheck
npm test
npm run build
npx prisma validate
npx prisma migrate status
```

Tests exercise the real Express routes with an in-memory repository and never alter the development database.

## Docker workflow

```powershell
# Database only for local Node development
docker compose up -d database

# Database and backend
docker compose up --build -d
docker compose ps
```

Published ports bind to loopback only. The backend reaches MySQL over `backend-network`, and `database-data` remains persistent.

## API

Success responses use `{ "success": true, "data": ... }`. Errors use `{ "success": false, "error": { "code": "...", "message": "..." } }` and may contain validation details.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Check API and database connectivity |
| POST | `/api/auth/register` | Public | Register an account |
| POST | `/api/auth/login` | Public | Receive an access token |
| GET | `/api/users/me` | Bearer token | Read own profile |
| PATCH | `/api/users/me` | Bearer token | Update own display name |
| GET | `/api/admin/users` | Admin token | Paginated user list |
| GET | `/api/admin/users/:id` | Admin token | Read one user |

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health

$register = @{ email = "alice@example.com"; password = "choose-a-long-password"; name = "Alice" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/auth/register -ContentType application/json -Body $register

$login = @{ email = "alice@example.com"; password = "choose-a-long-password" } | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/auth/login -ContentType application/json -Body $login
$headers = @{ Authorization = "Bearer $($session.data.accessToken)" }
Invoke-RestMethod -Uri http://127.0.0.1:3000/api/users/me -Headers $headers

$profile = @{ name = "Alice Updated" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri http://127.0.0.1:3000/api/users/me -Headers $headers -ContentType application/json -Body $profile
```

## Current boundary

The Product MVP includes database-backed health, registration/login, JWT access authentication, self-service profile access, and minimal role-gated admin reads. Passwords are bcrypt-hashed and stripped from every API response.

Private file storage, gateway routing, security-event generation, detection, rate limiting, MFA, refresh-token rotation, account-lockout policy, vulnerability assessment, and automated defensive response remain future product/security-phase work.
