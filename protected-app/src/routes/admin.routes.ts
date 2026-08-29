import { Router } from "express";
import type { UserStore } from "../types/user.js";
import { createGetUserHandler, createListUsersHandler } from "../controllers/user.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import { TokenService } from "../services/token.service.js";
import { UserService } from "../services/user.service.js";

export function createAdminRouter(
  users: UserService,
  tokens: TokenService,
  userStore: UserStore,
): Router {
  const router = Router();
  router.use(authenticate(tokens, userStore), requireAdmin);
  router.get("/users", createListUsersHandler(users));
  router.get("/users/:id", createGetUserHandler(users));
  return router;
}
