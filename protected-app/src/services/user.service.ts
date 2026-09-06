import bcrypt from "bcrypt";

import { ApiError } from "../lib/api-error.js";
import { AuditService } from "./audit.service.js";
import type { AuditContext } from "../types/audit.js";
import type { PublicUser, UserRecord, UserStore } from "../types/user.js";

const PASSWORD_ROUNDS = 12;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;

export function toPublicUser(user: UserRecord): PublicUser {
  const {
    passwordHash: _passwordHash,
    failedLoginAttempts: _failedLoginAttempts,
    lockedUntil: _lockedUntil,
    ...publicUser
  } = user;

  return publicUser;
}
export class UserService {
  constructor(
    private readonly users: UserStore,
    private readonly audit: AuditService,
  ) {}

  async register(input: { email: string; password: string; name?: string }): Promise<void> {
    const passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);

    if (await this.users.findByEmail(input.email)) return;

    try {
      await this.users.create({ email: input.email, passwordHash, name: input.name });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        return;
      }
      throw error;
    }
  }

  async authenticate(
    email: string,
    password: string,
    context?: AuditContext,
  ): Promise<PublicUser> {
    const user = await this.users.findByEmail(email);

    if (!user) {
      await this.audit.record("LOGIN_FAILED", "FAILURE", {
        context,
        details: { email, reason: "INVALID_CREDENTIALS" },
      });
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect",
      );
    }

    const now = new Date();
    const isLocked =
      user.lockedUntil !== null &&
      user.lockedUntil > now;

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      let lockResult: Awaited<ReturnType<UserStore["recordFailedLogin"]>> | undefined;

      if (user.status === "ACTIVE" && !isLocked) {
        const lockExpired =
          user.lockedUntil !== null &&
          user.lockedUntil <= now;

        if (lockExpired) {
          await this.users.resetLoginFailures(user.id);
        }

        lockResult = await this.users.recordFailedLogin(
          user.id,
          MAX_FAILED_LOGIN_ATTEMPTS,
          new Date(now.getTime() + ACCOUNT_LOCK_DURATION_MS),
        );
      }

      await this.audit.record("LOGIN_FAILED", "FAILURE", {
        actorId: user.id,
        context,
        details: { reason: "INVALID_CREDENTIALS" },
      });

      if (lockResult?.justLocked) {
        await this.audit.record("ACCOUNT_LOCKED", "SUCCESS", {
          actorId: user.id,
          context,
          details: {
            failedLoginAttempts: lockResult.failedLoginAttempts,
            lockedUntil: lockResult.lockedUntil?.toISOString(),
          },
        });
      }

      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect",
      );
    }

    if (user.status !== "ACTIVE" || isLocked) {
      await this.audit.record("LOGIN_FAILED", "DENIED", {
        actorId: user.id,
        context,
        details: { reason: "ACCOUNT_UNAVAILABLE" },
      });
      throw new ApiError(
        403,
        "ACCOUNT_UNAVAILABLE",
        "This account is unavailable",
      );
    }

    if (
      user.failedLoginAttempts > 0 ||
      user.lockedUntil !== null
    ) {
      await this.users.resetLoginFailures(user.id);
    }

    await this.audit.record("LOGIN_SUCCEEDED", "SUCCESS", {
      actorId: user.id,
      context,
    });
    return toPublicUser(user);
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    return toPublicUser(user);
  }

  async updateProfile(id: string, input: { name?: string | null }): Promise<PublicUser> {
    const user = await this.users.updateProfile(id, input);
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    return toPublicUser(user);
  }

  async list(page: number, pageSize: number) {
    const result = await this.users.list({ skip: (page - 1) * pageSize, take: pageSize });
    return { users: result.users.map(toPublicUser), pagination: { page, pageSize, total: result.total } };
  }
}
