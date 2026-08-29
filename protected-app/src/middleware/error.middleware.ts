import type { ErrorRequestHandler, RequestHandler } from "express";

import { ApiError } from "../lib/api-error.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (response.headersSent) {
    return;
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) },
    });
    return;
  }

  if (process.env.NODE_ENV !== "test") {
    console.error("Unhandled request error", error instanceof Error ? error.message : "Unknown error");
  }

  response.status(500).json({
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" },
  });
};
