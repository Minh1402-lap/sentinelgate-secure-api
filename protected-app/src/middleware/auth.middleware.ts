import type { RequestHandler } from "express";
import type { UserStore } from "../types/user.js";
import { ApiError } from "../lib/api-error.js";
import { TokenService } from "../services/token.service.js";

export function authenticate(tokens: TokenService, users: UserStore): RequestHandler {
  return async(request, _response, next) => {
    const [scheme, token] = request.header("authorization")?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) return next(new ApiError(401, "AUTHENTICATION_REQUIRED", "A bearer token is required"));
    try {
      const payload = tokens.verify(token);
      const user = await users.findById(payload.sub);
      if (!user || user.status !== "ACTIVE"){
        return next(
          new ApiError(401, "ACCOUNT_UNAVAILABLE", "Account is unavailable"),
        );
      }
      if (user.lockedUntil && user.lockedUntil > new Date()){
        return next(
          new ApiError(401, "ACCOUNT_UNAVAILABLE", "Account is unavailable"),
        );
      }
      request.auth ={
        sub: user.id,
        role: user.role,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireAdmin: RequestHandler = (request, _response, next) => {
  if (request.auth?.role !== "ADMIN") return next(new ApiError(403, "ADMIN_REQUIRED", "Administrator access is required"));
  next();
};

