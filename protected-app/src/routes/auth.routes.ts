import { Router } from "express";

import { createLoginHandler, createRegisterHandler } from "../controllers/auth.controller.js";
import { TokenService } from "../services/token.service.js";
import { UserService } from "../services/user.service.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { loginSchema, registerSchema } from "../validators/auth.schemas.js";
import { createLoginRateLimiter, createRegisterRateLimiter } from "../middleware/rate-limit.middleware.js";

export function createAuthRouter(users: UserService, tokens: TokenService): Router {
  const router = Router();
  const loginRateLimiter = createLoginRateLimiter();
  const registerRateLimiter = createRegisterRateLimiter();

  router.post(
    "/register",
    registerRateLimiter,
    validateBody(registerSchema),
    createRegisterHandler(users),
  );

  router.post(
    "/login",
    loginRateLimiter,
    validateBody(loginSchema),
    createLoginHandler(users, tokens),
  );

  return router;
}
