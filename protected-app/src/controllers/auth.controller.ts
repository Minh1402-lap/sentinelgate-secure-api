import type { RequestHandler } from "express";

import { requestAuditContext } from "../lib/request-audit-context.js";
import { TokenService } from "../services/token.service.js";
import { UserService } from "../services/user.service.js";

export function createRegisterHandler(users: UserService): RequestHandler {
  return async (request, response) => {
    await users.register(request.body);
    response.status(202).json({
      success: true,
      data: {
        message: "If this email can be registered, the account will be created.",
      },
    });
  };
}

export function createLoginHandler(users: UserService, tokens: TokenService): RequestHandler {
  return async (request, response) => {
    const user = await users.authenticate(
      request.body.email,
      request.body.password,
      requestAuditContext(request),
    );
    const accessToken = tokens.issue({ sub: user.id });
    response.status(200).json({ success: true, data: { user, accessToken } });
  };
}
