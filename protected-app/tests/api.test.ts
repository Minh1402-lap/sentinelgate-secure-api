import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { afterEach, test } from "node:test";

import { createApp } from "../src/app.js";
import type { UserRecord, UserStore } from "../src/types/user.js";

const JWT_SECRET = "test-only-secret-that-is-at-least-32-characters";
const servers: Server[] = [];

class MemoryUserStore implements UserStore {
  users: UserRecord[] = [];

  async findByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async create(input: { email: string; passwordHash: string; name?: string }) {
    const now = new Date();
    const user: UserRecord = {
      id: crypto.randomUUID(), email: input.email, passwordHash: input.passwordHash,
      name: input.name ?? null, role: "USER", status: "ACTIVE", lockedUntil: null,
      createdAt: now, updatedAt: now,
    };
    this.users.push(user);
    return user;
  }
  async updateProfile(id: string, input: { name?: string | null }) {
    const user = await this.findById(id);
    if (!user) return null;
    if (input.name !== undefined) user.name = input.name;
    user.updatedAt = new Date();
    return user;
  }
  async list({ skip, take }: { skip: number; take: number }) {
    return { users: this.users.slice(skip, skip + take), total: this.users.length };
  }
}

async function harness(databaseAvailable = true) {
  const store = new MemoryUserStore();
  const database = {
    async $queryRaw() {
      if (!databaseAvailable) throw new Error("offline");
      return [{ result: 1 }];
    },
  };
  const app = createApp({ database, userStore: store, jwtSecret: JWT_SECRET, jwtExpiresIn: "15m" });
  const server = createServer(app).listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  return { baseUrl: `http://127.0.0.1:${address.port}`, store };
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

test("registration normalizes email, hashes password, and omits passwordHash", async () => {
  const { baseUrl, store } = await harness();
  const { response, body } = await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST", body: JSON.stringify({ email: "  Alice@Example.COM ", password: "strong-password", name: "Alice" }),
  });
  assert.equal(response.status, 201);
  assert.equal(body.data.user.email, "alice@example.com");
  assert.equal("passwordHash" in body.data.user, false);
  assert.notEqual(store.users[0]?.passwordHash, "strong-password");
  assert.match(store.users[0]?.passwordHash ?? "", /^\$2/);
});

test("duplicate registration is rejected", async () => {
  const { baseUrl } = await harness();
  const request = { method: "POST", body: JSON.stringify({ email: "same@example.com", password: "strong-password" }) };
  assert.equal((await jsonRequest(baseUrl, "/api/auth/register", request)).response.status, 201);
  assert.equal((await jsonRequest(baseUrl, "/api/auth/register", request)).response.status, 409);
});

test("login succeeds with valid credentials and fails for an incorrect password", async () => {
  const { baseUrl } = await harness();
  await jsonRequest(baseUrl, "/api/auth/register", { method: "POST", body: JSON.stringify({ email: "login@example.com", password: "valid-password" }) });
  const valid = await jsonRequest(baseUrl, "/api/auth/login", { method: "POST", body: JSON.stringify({ email: "LOGIN@example.com", password: "valid-password" }) });
  assert.equal(valid.response.status, 200);
  assert.equal(typeof valid.body.data.accessToken, "string");
  assert.equal("passwordHash" in valid.body.data.user, false);
  const invalid = await jsonRequest(baseUrl, "/api/auth/login", { method: "POST", body: JSON.stringify({ email: "login@example.com", password: "wrong-password" }) });
  assert.equal(invalid.response.status, 401);
});
test("login rate limiter blocks the sixth failed attempt", async () => {
  const { baseUrl } = await harness();

  await jsonRequest(baseUrl, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: "limited@example.com",
      password: "valid-password",
    }),
  });

  const invalidLogin = {
    method: "POST",
    body: JSON.stringify({
      email: "limited@example.com",
      password: "wrong-password",
    }),
  };

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await jsonRequest(
      baseUrl,
      "/api/auth/login",
      invalidLogin,
    );

    assert.equal(
      result.response.status,
      401,
      `attempt ${attempt} should reach normal authentication`,
    );

    assert.equal(result.body.error.code, "INVALID_CREDENTIALS");
  }

  const blocked = await jsonRequest(
    baseUrl,
    "/api/auth/login",
    invalidLogin,
  );

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
  const { baseUrl } = await harness();
  const token = await registerAndLogin(baseUrl);
  const headers = { authorization: `Bearer ${token}` };
  const profile = await jsonRequest(baseUrl, "/api/users/me", { headers });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.data.user.email, "user@example.com");
  const updated = await jsonRequest(baseUrl, "/api/users/me", { method: "PATCH", headers, body: JSON.stringify({ name: "Updated Name" }) });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.data.user.name, "Updated Name");
  assert.equal("passwordHash" in updated.body.data.user, false);
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
  const { baseUrl, store } = await harness();
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
});

test("registration limiter blocks the sixth request without consuming the login quota", async () => {
  const { baseUrl } = await harness();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const registration = await jsonRequest(
      baseUrl,
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email: `register-${attempt}@example.com`,
          password: "valid-password",
        }),
      },
    );

    assert.equal(
      registration.response.status,
      201,
      `registration attempt ${attempt} should succeed`,
    );
  }

  const blocked = await jsonRequest(
    baseUrl,
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        email: "register-6@example.com",
        password: "valid-password",
      }),
    },
  );

  assert.equal(blocked.response.status, 429);
  assert.equal(blocked.body.error.code, "RATE_LIMIT_EXCEEDED");
  assert.ok(blocked.response.headers.get("ratelimit"));
  assert.ok(blocked.response.headers.get("ratelimit-policy"));
  assert.ok(blocked.response.headers.get("retry-after"));

  const login = await jsonRequest(
    baseUrl,
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email: "register-1@example.com",
        password: "valid-password",
      }),
    },
  );

  assert.equal(
    login.response.status,
    200,
    "registration quota must not consume the login quota",
  );
});
test("disabled users cannot use an existing token", async () => {
  const { baseUrl, store } = await harness();
  const token = await registerAndLogin(baseUrl);

  const user = store.users[0];
  assert(user);

  // Giả lập admin đã disable user trong database.
  user.status = "DISABLED";

  const result = await jsonRequest(baseUrl, "/api/users/me", {
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(result.response.status, 401);
  assert.equal(result.body.error.code, "ACCOUNT_UNAVAILABLE");
});
test("an admin token loses access when the user's role is downgraded", async () => {
  const { baseUrl, store } = await harness();

  await registerAndLogin(baseUrl);

  const user = store.users[0];
  assert(user);

  // Cấp ADMIN, rồi login để token cũ mang role ADMIN.
  user.role = "ADMIN";
  const login = await jsonRequest(baseUrl, "/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "user@example.com",
      password: "correct-horse-battery",
    }),
  });
  const adminToken = login.body.data.accessToken as string;

  // Sau đó hạ quyền trong "database".
  user.role = "USER";

  const result = await jsonRequest(baseUrl, "/api/admin/users", {
    headers: { authorization: `Bearer ${adminToken}` },
  });

  assert.equal(result.response.status, 403);
  assert.equal(result.body.error.code, "ADMIN_REQUIRED");
});
