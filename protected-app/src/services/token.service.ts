import jwt, { type SignOptions } from "jsonwebtoken";

import { ApiError } from "../lib/api-error.js";

export interface AccessTokenPayload {
  sub: string;
}

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
    private readonly issuer: string,
    private readonly audience: string,
  ) {}

  issue(payload: AccessTokenPayload): string {
    return jwt.sign({}, this.secret, {
      algorithm: "HS256",
      subject: payload.sub,
      issuer: this.issuer,
      audience: this.audience,
      expiresIn: this.expiresIn as SignOptions["expiresIn"],
    });
  }

  verify(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ["HS256"],
        issuer: this.issuer,
        audience: this.audience,
      });
      if (typeof payload === "string" || !payload.sub) {
        throw new Error("Invalid token payload");
      }
      return { sub: payload.sub };
    } catch {
      throw new ApiError(401, "INVALID_TOKEN", "Authentication token is invalid or expired");
    }
  }
}
