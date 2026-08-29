import bcrypt from "bcrypt";

import { ApiError } from "../lib/api-error.js";
import type { PublicUser, UserRecord, UserStore } from "../types/user.js";

const PASSWORD_ROUNDS = 12;

export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash: _passwordHash, lockedUntil: _lockedUntil, ...publicUser } = user;
  return publicUser;
}

export class UserService {
  constructor(private readonly users: UserStore) {}

  async register(input: { email: string; password: string; name?: string }): Promise<PublicUser> {
    if (await this.users.findByEmail(input.email)) {
      throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_ROUNDS);
    try {
      return toPublicUser(await this.users.create({ email: input.email, passwordHash, name: input.name }));
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
      }
      throw error;
    }
  }

  async authenticate(email: string, password: string): Promise<PublicUser> {
    const user = await this.users.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }
    if (user.status !== "ACTIVE" || (user.lockedUntil && user.lockedUntil > new Date())) {
      throw new ApiError(403, "ACCOUNT_UNAVAILABLE", "This account is unavailable");
    }
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
