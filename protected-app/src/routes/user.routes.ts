import { Router } from "express";
import type { UserStore } from "../types/user.js";
import { createGetProfileHandler, createUpdateProfileHandler } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { TokenService } from "../services/token.service.js";
import { UserService } from "../services/user.service.js";
import { updateProfileSchema } from "../validators/user.schemas.js";

export function createUserRouter(
  users: UserService, 
  tokens: TokenService,
  userStore: UserStore,
): Router {
  const router = Router();
  router.use(authenticate(tokens, userStore));
  router.get("/me", createGetProfileHandler(users));
  router.patch("/me", validateBody(updateProfileSchema), createUpdateProfileHandler(users));
  return router;
}