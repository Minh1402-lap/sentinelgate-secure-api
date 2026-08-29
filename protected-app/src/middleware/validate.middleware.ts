import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { ApiError } from "../lib/api-error.js";

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) return next(new ApiError(400, "VALIDATION_ERROR", "Request validation failed", result.error.flatten()));
    request.body = result.data;
    next();
  };
}
