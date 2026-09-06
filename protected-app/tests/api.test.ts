import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { afterEach, test } from "node:test";
import jwt from "jsonwebtoken";

import { createApp } from "../src/app.js";
import { safeErrorSummary } from "../src/middleware/error.middleware.js";
import { AuditService } from "../src/services/audit.service.js";
import type { AuditStore, AuditWriteInput } from "../src/types/audit.js";
import type { UserRecord, UserStore } from "../src/types/user.js";

const JWT_SECRET = "test-only-secret-that-is-at-least-32-characters";
const JWT_ISSUER = "sentinelgate-test";
const JWT_AUDIENCE = "sentinelvault-test-api";
const servers: Server[] = [];

process.env.NODE_ENV = "test";

class MemoryAuditStore implements AuditStore {
  records: AuditWriteInput[] = [];

  async write(input: AuditWriteInput) {
    this.records.push(input);
  }
}

class MemoryUserStore implements UserStore {
  users: UserRecord[] = [];

  async findByEmail(email: string) {
    return this.users.find((user) => user.email === email) ?? null;
  }

  async findById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async create(input: {
    email: string;
    passwordHash: string;
    name?: string;
  }) {
    const now = new Date();

    const user: UserRecord = {
      id: crypto.randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name ?? null,
      role: "USER",
      status: "ACTIVE",
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(user);
    return user;
  }

  async updateProfile(
    id: string,
    input: { name?: string | null },
  ) {
    const user = await this.findById(id);
    if (!user) return null;

    if (input.name !== undefined) {
      user.name = input.name;
    }

    user.updatedAt = new Date();
    return user;
  }

  async recordFailedLogin(
    id: string,
    threshold: number,
    lockUntil: Date,
  ) {
    const user = await this.findById(id);
    if (!user) throw new Error("User not found");

    user.failedLoginAttempts += 1;
    const justLocked = user.failedLoginAttempts === threshold;

    if (user.failedLoginAttempts >= threshold) {
      user.lockedUntil = lockUntil;
    }

    user.updatedAt = new Date();
    return {
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      justLocked,
    };
  }

  async resetLoginFailures(id: string) {
    const user = await this.findById(id);
    if (!user) return;

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.updatedAt = new Date();
  }

  async list({
    skip,
    take,
  }: {
    skip: number;
    take: number;
  }) {
    return {
      users: this.users.slice(skip, skip + take),
      total: this.users.length,
    };
  }
}

async function harness<T extends AuditStore = MemoryAuditStore>(
  databaseAvailable = true,
  auditStore: T = new MemoryAuditStore() as unknown as T,
) {
  const store = new MemoryUserStore();
  const database = {
    async $queryRaw() {
      if (!databaseAvailable) throw new Error("offline");
      return [{ result: 1 }];
    },
  };
  const app = createApp({
    database,
    auditStore,
    userStore: store,
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: "15m",
    jwtIssuer: JWT_ISSUER,
    jwtAudience: JWT_AUDIENCE,
    corsOrigins: ["https://app.sentinelgate.test"],
  });
  const server = createServer(app).listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return { baseUrl: `http://127.0.0.1:${address.port}`, store, auditStore };
}

async function jsonRequest(baseUrl: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  return { response, body: await response.json() as Record<string, any> };
}

async function registerAndLogin(baseUrl: string) {
  const credentials = { email: "User@Example.com", password: "correct-horse-battery" };
  await jsonRequest(baseUrl, "/api/auth/register", { method: "POST", body: JSON.stringify(credentials) });
  const login = await jsonRequest(baseUrl, "/api/auth/login", { method: "POST", body: JSON.stringify(credentials) });
  return login.body.data.accessToken as string;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

test("health succeeds when the database is available", async () => {
  const { baseUrl } = await harness();
  const { response, body } = await jsonRequest(baseUrl, "/api/health");
  assert.equal(response.status, 200);
  assert.equal(body.data.database, "connected");
});

test("health returns 503 when the database is unavailable", async () => {
  const { baseUrl } = await harness(false);
  const { response, body } = await jsonRequest(baseUrl, "/api/health");
  assert.equal(response.status, 503);
  assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
});

test("malformed JSON is rejected as a client error", async () => {
  const { baseUrl } = await harness();
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{email:",
  });
  const body = await response.json() as Record<string, any>;

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_JSON");
});

test("CORS allows configured origins and rejects untrusted origins", async () => {
  const { baseUrl } = await harness();
  const allowed = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: "https://app.sentinelgate.test" },
  });
  assert.equal(allowed.status, 200);
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "https://app.sentinelgate.test",
  );

  const denied = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: "https://attacker.example" },
  });
  const deniedBody = await denied.json() as Record<string, any>;
  assert.equal(denied.status, 403);
  assert.equal(deniedBody.error.code, "ORIGIN_NOT_ALLOWED");
});

test("registration normalizes email, hashes password, and omits passwordHash", async () => {
  const { baseUrl, store } = await harness();
  const { response, body } = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST", body: JSON.stringify({ email: "  Alice@Example.COM ", password: "strong-password", name: "Alice" }),
  });
  assert.equal(response.status, 202);
  assert.equal(typeof body.data.message, "string");
  assert.notEqual(store.users[0]?.passwordHash, "strong-password");
  assert.equal(store.users[0]?.email, "alice@example.com");
  assert.match(store.users[0]?.passwordHash ?? "", /^\$2/);
});

test("duplicate registration does not disclose whether the email exists", async () => {
  const { baseUrl, store } = await harness();
  const request = { method: "POST", body: JSON.stringify({ email: "same@example.com", password: "strong-password" }) };
  const first = await jsonRequest(baseUrl, "/api/auth/register", request);
  const duplicate = await jsonRequest(baseUrl, "/api/auth/register", request);
  assert.equal(first.response.status, 202);
  assert.equal(duplicate.response.status, first.response.status);
  assert.deepEqual(duplicate.body, first.body);
  assert.equal(store.users.length, 1);
});

test("login succeeds with valid credentials and fails for an incorrect password", async () => {
  const { baseUrl, auditStore } = await harness();
  await jsonRequest(baseUrl, "/api/auth/register", { method: "POST", body: JSON.stringify({ email: "login@example.com", password: "valid-password" }) });
  const valid = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    headers: { "user-agent": "SentinelGate-Test" },
    body: JSON.stringify({ email: "LOGIN@example.com", password: "valid-password" }),
  });
  assert.equal(valid.response.status, 200);
  assert.equal(typeof valid.body.data.accessToken, "string");
  assert.equal("passwordHash" in valid.body.data.user, false);
  const invalid = await jsonRequest(baseUrl, "/api/auth/login", { method: "POST", body: JSON.stringify({ email: "login@example.com", password: "wrong-password" }) });
  assert.equal(invalid.response.status, 401);

  assert.deepEqual(
    auditStore.records.map(({ action, outcome }) => ({ action, outcome })),
    [
      { action: "LOGIN_SUCCEEDED", outcome: "SUCCESS" },
      { action: "LOGIN_FAILED", outcome: "FAILURE" },
    ],
  );
  assert.equal(auditStore.records[0]?.userAgent, "SentinelGate-Test");
  assert.equal(typeof auditStore.records[0]?.ipAddress, "string");
  assert.equal(JSON.stringify(auditStore.records).includes("valid-password"), false);
  assert.equal(JSON.stringify(auditStore.records).includes("wrong-password"), false);
});

test("audit details redact credential and token fields recursively", async () => {
  const auditStore = new MemoryAuditStore();
  const audit = new AuditService(auditStore);

  await audit.record("LOGIN_FAILED", "FAILURE", {
    details: {
      email: "audit@example.com",
      password: "must-not-appear",
      nested: {
        accessToken: "must-not-appear-either",
        authorization: "Bearer secret-token",
      },
    },
  });

  assert.deepEqual(auditStore.records[0]?.details, {
    email: "audit@example.com",
    password: "[REDACTED]",
    nested: {
      accessToken: "[REDACTED]",
      authorization: "[REDACTED]",
    },
  });
});

test("login rate limiter blocks the sixth failed attempt", async () => {
  const { baseUrl } = await harness();
  await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "limited@example.com", password: "valid-password" }),
  });
  const invalidLogin = {
    method: "POST",
    body: JSON.stringify({ email: "limited@example.com", password: "wrong-password" }),
  };
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await jsonRequest(baseUrl, "/api/auth/login", invalidLogin);
    assert.equal(result.response.status, 401, `attempt ${attempt} should reach normal authentication`);
    assert.equal(result.body.error.code, "INVALID_CREDENTIALS");
  }
  const blocked = await jsonRequest(baseUrl, "/api/auth/login", invalidLogin);
  assert.equal(blocked.response.status, 429);
  assert.equal(blocked.body.error.code, "RATE_LIMIT_EXCEEDED");
  assert.ok(blocked.response.headers.get("ratelimit"));
  assert.ok(blocked.response.headers.get("ratelimit-policy"));
  assert.ok(blocked.response.headers.get("retry-after"));
});

test("profile rejects missing authentication", async () => {
  const { baseUrl } = await harness();
  assert.equal((await jsonRequest(baseUrl, "/api/users/me")).response.status, 401);
});

test("profile read and update succeed with a valid token", async () => {
  const { baseUrl, auditStore } = await harness();
  const token = await registerAndLogin(baseUrl);
  const headers = { authorization: `Bearer ${token}` };
  const profile = await jsonRequest(baseUrl, "/api/users/me", { headers });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.data.user.email, "user@example.com");
  const updated = await jsonRequest(baseUrl, "/api/users/me", { method: "PATCH", headers, body: JSON.stringify({ name: "Updated Name" }) });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.user.name, "Updated Name");
  assert.equal("passwordHash" in updated.body.data.user, false);
  const audit = auditStore.records.find(({ action }) => action === "PROFILE_UPDATED");
  assert.equal(audit?.outcome, "SUCCESS");
  assert.deepEqual(audit?.details, { changedFields: ["name"] });
  assert.equal(JSON.stringify(audit).includes("Updated Name"), false);
});

test("invalid and sensitive profile fields are rejected", async () => {
  const { baseUrl } = await harness();
  const token = await registerAndLogin(baseUrl);
  const result = await jsonRequest(baseUrl, "/api/users/me", {
    method: "PATCH", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ role: "ADMIN" }),
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.error.code, "VALIDATION_ERROR");
});

test("admin user reads require an administrator token", async () => {
  const { baseUrl, store, auditStore } = await harness();
  const userToken = await registerAndLogin(baseUrl);
  const forbidden = await jsonRequest(baseUrl, "/api/admin/users", { headers: { authorization: `Bearer ${userToken}` } });
  assert.equal(forbidden.response.status, 403);
  const user = store.users[0];
  assert(user);
  user.role = "ADMIN";
  const login = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST", body: JSON.stringify({ email: "user@example.com", password: "correct-horse-battery" }),
  });
  const admin = await jsonRequest(baseUrl, "/api/admin/users?page=1&pageSize=10", {
    headers: { authorization: `Bearer ${login.body.data.accessToken}` },
  });
  assert.equal(admin.response.status, 200);
  assert.equal(admin.body.data.pagination.total, 1);
  assert.equal("passwordHash" in admin.body.data.users[0], false);
  const detail = await jsonRequest(baseUrl, `/api/admin/users/${user.id}`, {
    headers: { authorization: `Bearer ${login.body.data.accessToken}` },
  });
  assert.equal(detail.response.status, 200);
  assert.deepEqual(
    auditStore.records
      .filter(({ action }) => action.startsWith("ADMIN_"))
      .map(({ action, outcome }) => ({ action, outcome })),
    [
      { action: "ADMIN_USERS_LISTED", outcome: "SUCCESS" },
      { action: "ADMIN_USER_VIEWED", outcome: "SUCCESS" },
    ],
  );
  assert.deepEqual(
    auditStore.records.find(({ action }) => action === "ADMIN_USER_VIEWED")?.details,
    { targetUserId: user.id },
  );
});

test("registration limiter blocks the sixth request without consuming the login quota", async () => {
  const { baseUrl } = await harness();
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const registration = await jsonRequest(baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: `register-${attempt}@example.com`, password: "valid-password" }),
    });
    assert.equal(registration.response.status, 202, `registration attempt ${attempt} should be accepted`);
  }
  const blocked = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: "register-6@example.com", password: "valid-password" }),
  });
  assert.equal(blocked.response.status, 429);
  assert.equal(blocked.body.error.code, "RATE_LIMIT_EXCEEDED");
  assert.ok(blocked.response.headers.get("ratelimit"));
  assert.ok(blocked.response.headers.get("ratelimit-policy"));
  assert.ok(blocked.response.headers.get("retry-after"));
  const login = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "register-1@example.com", password: "valid-password" }),
  });
  assert.equal(login.response.status, 200, "registration quota must not consume the login quota");
});

test("disabled users cannot use an existing token", async () => {
  const { baseUrl, store } = await harness();
  const token = await registerAndLogin(baseUrl);
  const user = store.users[0];
  assert(user);
  user.status = "DISABLED";
  const result = await jsonRequest(baseUrl, "/api/users/me", {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(result.response.status, 401);
  assert.equal(result.body.error.code, "ACCOUNT_UNAVAILABLE");
});

test("JWT verification enforces algorithm, issuer, audience, signature, and expiry", async () => {
  const { baseUrl, store } = await harness();
  await registerAndLogin(baseUrl);
  const user = store.users[0];
  assert(user);

  const invalidTokens = [
    jwt.sign({}, JWT_SECRET, {
      algorithm: "HS384",
      subject: user.id,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: "15m",
    }),
    jwt.sign({}, JWT_SECRET, {
      algorithm: "HS256",
      subject: user.id,
      issuer: "wrong-issuer",
      audience: JWT_AUDIENCE,
      expiresIn: "15m",
    }),
    jwt.sign({}, JWT_SECRET, {
      algorithm: "HS256",
      subject: user.id,
      issuer: JWT_ISSUER,
      audience: "wrong-audience",
      expiresIn: "15m",
    }),
    jwt.sign({}, "different-test-secret-that-is-at-least-32-characters", {
      algorithm: "HS256",
      subject: user.id,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: "15m",
    }),
    jwt.sign({}, JWT_SECRET, {
      algorithm: "HS256",
      subject: user.id,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      expiresIn: -1,
    }),
  ];

  for (const token of invalidTokens) {
    const result = await jsonRequest(baseUrl, "/api/users/me", {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(result.response.status, 401);
    assert.equal(result.body.error.code, "INVALID_TOKEN");
  }
});

test("unexpected failures return a generic 500 without exposing internals", async () => {
  const failingAuditStore: AuditStore = {
    async write() {
      throw new Error("database password and internal stack must stay private");
    },
  };
  const { baseUrl } = await harness(true, failingAuditStore);
  const credentials = {
    email: "generic-error@example.com",
    password: "valid-password",
  };
  await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  const result = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  assert.equal(result.response.status, 500);
  assert.deepEqual(result.body, {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  });
  assert.equal(JSON.stringify(result.body).includes("database password"), false);
  assert.deepEqual(
    safeErrorSummary(new Error("database password and internal stack must stay private")),
    { errorType: "Error" },
  );
});

test("an admin token loses access when the user's role is downgraded", async () => {
  const { baseUrl, store } = await harness();
  await registerAndLogin(baseUrl);
  const user = store.users[0];
  assert(user);
  user.role = "ADMIN";
  const login = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "user@example.com", password: "correct-horse-battery" }),
  });
  const adminToken = login.body.data.accessToken as string;
  user.role = "USER";
  const result = await jsonRequest(baseUrl, "/api/admin/users", {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.error.code, "ADMIN_REQUIRED");
});

test("five incorrect passwords lock the account", async () => {
  const { baseUrl, store, auditStore } = await harness();

  const credentials = {
    email: "lockout@example.com",
    password: "valid-password",
  };

  await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await jsonRequest(
      baseUrl,
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: credentials.email,
          password: "wrong-password",
        }),
      },
    );

    assert.equal(
      result.response.status,
      401,
      `attempt ${attempt} should return invalid credentials`,
    );

    assert.equal(
      result.body.error.code,
      "INVALID_CREDENTIALS",
    );
  }

  const user = store.users[0];
  assert(user);

  assert.equal(user.failedLoginAttempts, 5);
  assert(user.lockedUntil);
  assert.ok(user.lockedUntil.getTime() > Date.now());
  assert.equal(
    auditStore.records.filter(({ action }) => action === "LOGIN_FAILED").length,
    5,
  );
  assert.equal(
    auditStore.records.filter(({ action }) => action === "ACCOUNT_LOCKED").length,
    1,
  );
  assert.equal(
    auditStore.records.find(({ action }) => action === "ACCOUNT_LOCKED")?.outcome,
    "SUCCESS",
  );
});

test("locked account rejects the correct password", async () => {
  const { baseUrl, store } = await harness();

  const credentials = {
    email: "locked@example.com",
    password: "valid-password",
  };

  await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  const user = store.users[0];
  assert(user);

  user.failedLoginAttempts = 5;
  user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);

  const result = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  assert.equal(result.response.status, 403);
  assert.equal(result.body.error.code, "ACCOUNT_UNAVAILABLE");
  assert.equal(user.failedLoginAttempts, 5);
  assert(user.lockedUntil);
});

test("successful login resets previous failures", async () => {
  const { baseUrl, store } = await harness();

  const credentials = {
    email: "reset@example.com",
    password: "valid-password",
  };

  await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  const user = store.users[0];
  assert(user);

  user.failedLoginAttempts = 3;

  const result = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  assert.equal(result.response.status, 200);
  assert.equal(user.failedLoginAttempts, 0);
  assert.equal(user.lockedUntil, null);

  assert.equal(
    "failedLoginAttempts" in result.body.data.user,
    false,
  );

  assert.equal(
    "lockedUntil" in result.body.data.user,
    false,
  );
});

test("an expired account lock allows login and resets its state", async () => {
  const { baseUrl, store } = await harness();

  const credentials = {
    email: "expired-lock@example.com",
    password: "valid-password",
  };

  await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  const user = store.users[0];
  assert(user);

  user.failedLoginAttempts = 5;
  user.lockedUntil = new Date(Date.now() - 1000);

  const result = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  assert.equal(result.response.status, 200);
  assert.equal(user.failedLoginAttempts, 0);
  assert.equal(user.lockedUntil, null);
});
