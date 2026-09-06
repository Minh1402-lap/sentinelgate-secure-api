import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";

import { ApiError } from "./lib/api-error.js";
import { AuditService } from "./services/audit.service.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createAdminRouter } from "./routes/admin.routes.js";
import { createAuthRouter } from "./routes/auth.routes.js";
import { createUserRouter } from "./routes/user.routes.js";
import { TokenService } from "./services/token.service.js";
import { UserService } from "./services/user.service.js";
import type { DatabaseHealthClient } from "./types/dependencies.js";
import type { AuditStore } from "./types/audit.js";
import type { UserStore } from "./types/user.js";

export interface AppDependencies {
  database: DatabaseHealthClient;
  auditStore: AuditStore;
  userStore: UserStore;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtIssuer: string;
  jwtAudience: string;
  corsOrigins: string[];
  arcjetKey?: string;
}

export function createApp({ database, auditStore, userStore, jwtSecret, jwtExpiresIn, jwtIssuer, jwtAudience, corsOrigins, arcjetKey }: AppDependencies): Express {
  const app = express();
  const audit = new AuditService(auditStore);
  const users = new UserService(userStore, audit);
  const tokens = new TokenService(jwtSecret, jwtExpiresIn, jwtIssuer, jwtAudience);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed"));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  }));
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/health", createHealthRouter(database));
  app.use("/api/auth", createAuthRouter(users, tokens, arcjetKey));
  app.use("/api/users", createUserRouter(users, tokens, userStore, audit));
  app.use("/api/admin", createAdminRouter(users, tokens, userStore, audit));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
