import jwt, { type SignOptions } from "jsonwebtoken";

import { ApiError } from "../lib/api-error.js";
import type { UserRole } from "../types/user.js";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}

export class TokenService {
  constructor(private readonly secret: string, private readonly expiresIn: string) {}

  issue(payload: AccessTokenPayload): string {
    return jwt.sign({ role: payload.role }, this.secret, {
      subject: payload.sub,
      expiresIn: this.expiresIn as SignOptions["expiresIn"],
    });
  }

  verify(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.secret);
      if (typeof payload === "string" || !payload.sub || (payload.role !== "USER" && payload.role !== "ADMIN")) {
        throw new Error("Invalid token payload");
      }
      return { sub: payload.sub, role: payload.role };
    } catch {
      throw new ApiError(401, "INVALID_TOKEN", "Authentication token is invalid or expired");
    }
  }
}
