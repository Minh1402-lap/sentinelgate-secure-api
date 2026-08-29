import type { RequestHandler } from "express";

import { TokenService } from "../services/token.service.js";
import { UserService } from "../services/user.service.js";

export function createRegisterHandler(users: UserService): RequestHandler {
  return async (request, response) => {
    const user = await users.register(request.body);
    response.status(201).json({ success: true, data: { user } });
  };
}

export function createLoginHandler(users: UserService, tokens: TokenService): RequestHandler {
  return async (request, response) => {
    const user = await users.authenticate(request.body.email, request.body.password);
    const accessToken = tokens.issue({ sub: user.id, role: user.role });
    response.status(200).json({ success: true, data: { user, accessToken } });
  };
}
