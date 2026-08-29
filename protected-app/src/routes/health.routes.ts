import { Router } from "express";

import { createHealthHandler } from "../controllers/health.controller.js";
import type { DatabaseHealthClient } from "../types/dependencies.js";

export function createHealthRouter(database: DatabaseHealthClient): Router {
  const router = Router();
  router.get("/", createHealthHandler(database));
  return router;
}
