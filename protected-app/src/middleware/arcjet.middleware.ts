import arcjet, { detectBot, shield, tokenBucket } from "@arcjet/node";
import { isSpoofedBot } from "@arcjet/inspect";
import type { RequestHandler } from "express";

/**
 * Protect public authentication endpoints from automated abuse before their
 * validation and business logic run. The local express-rate-limit rules stay
 * in place as a fallback if Arcjet is not configured.
 */
export function createArcjetAuthProtection(key?: string): RequestHandler {
  if (!key) {
    return (_request, _response, next) => next();
  }

  const client = arcjet({
    key,
    rules: [
      shield({ mode: "LIVE" }),
      detectBot({
        mode: "LIVE",
        allow: ["CATEGORY:SEARCH_ENGINE"],
      }),
      tokenBucket({
        mode: "LIVE",
        refillRate: 5,
        interval: "15m",
        capacity: 5,
      }),
    ],
  });

  return async (request, response, next) => {
    try {
      const decision = await client.protect(request, {
        // Express resolves this from the socket unless trusted proxies are configured.
        // Supplying it explicitly also makes localhost requests testable.
        ipSrc: request.ip,
        requested: 1,
      });

      if (decision.isDenied()) {
        if (decision.reason.isRateLimit()) {
          response.status(429).json({
            success: false,
            error: {
              code: "ARCJET_RATE_LIMITED",
              message: "Too many requests. Please try again later.",
            },
          });
          return;
        }

        response.status(403).json({
          success: false,
          error: {
            code: decision.reason.isBot() ? "ARCJET_BOT_BLOCKED" : "ARCJET_REQUEST_BLOCKED",
            message: "This request was blocked by security controls.",
          },
        });
        return;
      }

      if (decision.results.some(isSpoofedBot)) {
        response.status(403).json({
          success: false,
          error: {
            code: "ARCJET_SPOOFED_BOT",
            message: "This request was blocked by security controls.",
          },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
