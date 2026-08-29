import express, { type Express } from "express";
import helmet from "helmet";

import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createAdminRouter } from "./routes/admin.routes.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createUserRouter } from "./routes/user.routes.js";
import { TokenService } from "./services/token.service.js";
import { UserService } from "./services/user.service.js";
import type { DatabaseHealthClient } from "./types/dependencies.js";
import type { UserStore } from "./types/user.js";

export interface AppDependencies {
  database: DatabaseHealthClient;
  userStore: UserStore;
  jwtSecret: string;
  jwtExpiresIn: string;
}

export function createApp({ database, userStore, jwtSecret, jwtExpiresIn }: AppDependencies): Express {
  const app = express();
  const users = new UserService(userStore);
  const tokens = new TokenService(jwtSecret, jwtExpiresIn);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/health", createHealthRouter(database));
  app.use("/api/auth", createAuthRouter(users, tokens));
  app.use("/api/users", createUserRouter(users, tokens, userStore));
  app.use("/api/admin", createAdminRouter(users, tokens, userStore));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
