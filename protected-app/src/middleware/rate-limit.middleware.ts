import { rateLimit } from "express-rate-limit";

export function createLoginRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,

    handler: (_request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many login attempts. Please try again later.",
        },
      });
    },
  });
}

export function createRegisterRateLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,

    handler: (_request, response) => {
      response.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many registration attempts. Please try again later.",
        },
      });
    },
  });
}