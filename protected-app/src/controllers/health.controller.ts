import type { RequestHandler } from "express";

import type { DatabaseHealthClient } from "../types/dependencies.js";

export function createHealthHandler(database: DatabaseHealthClient): RequestHandler {
  return async (_request, response) => {
    try {
      await database.$queryRaw`SELECT 1`;
      response.status(200).json({
        success: true,
        data: {
          status: "ok",
          service: "sentinelgate-protected-app",
          database: "connected",
        },
      });
    } catch {
      response.status(503).json({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "The database is unavailable",
        },
      });
    }
  };
}
