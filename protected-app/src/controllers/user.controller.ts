import type { RequestHandler } from "express";

import { ApiError } from "../lib/api-error.js";
import { requestAuditContext } from "../lib/request-audit-context.js";
import { AuditService } from "../services/audit.service.js";
import { UserService } from "../services/user.service.js";
import { userIdSchema, userListQuerySchema } from "../validators/user.schemas.js";

function authenticatedUserId(auth: Express.Request["auth"]): string {
  if (!auth) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  return auth.sub;
}

export function createGetProfileHandler(users: UserService): RequestHandler {
  return async (request, response) => {
    const user = await users.getById(authenticatedUserId(request.auth));
    response.status(200).json({ success: true, data: { user } });
  };
}

export function createUpdateProfileHandler(users: UserService, audit: AuditService): RequestHandler {
  return async (request, response) => {
    const actorId = authenticatedUserId(request.auth);
    const user = await users.updateProfile(actorId, request.body);
    await audit.record("PROFILE_UPDATED", "SUCCESS", {
      actorId,
      context: requestAuditContext(request),
      details: { changedFields: Object.keys(request.body) },
    });
    response.status(200).json({ success: true, data: { user } });
  };
}

export function createListUsersHandler(users: UserService, audit: AuditService): RequestHandler {
  return async (request, response) => {
    const query = userListQuerySchema.safeParse(request.query);
    if (!query.success) throw new ApiError(400, "VALIDATION_ERROR", "Query validation failed", query.error.flatten());
    const data = await users.list(query.data.page, query.data.pageSize);
    await audit.record("ADMIN_USERS_LISTED", "SUCCESS", {
      actorId: authenticatedUserId(request.auth),
      context: requestAuditContext(request),
      details: { page: query.data.page, pageSize: query.data.pageSize },
    });
    response.status(200).json({ success: true, data });
  };
}

export function createGetUserHandler(users: UserService, audit: AuditService): RequestHandler {
  return async (request, response) => {
    const params = userIdSchema.safeParse(request.params);
    if (!params.success) throw new ApiError(400, "VALIDATION_ERROR", "Route parameter validation failed", params.error.flatten());
    const user = await users.getById(params.data.id);
    await audit.record("ADMIN_USER_VIEWED", "SUCCESS", {
      actorId: authenticatedUserId(request.auth),
      context: requestAuditContext(request),
      details: { targetUserId: params.data.id },
    });
    response.status(200).json({ success: true, data: { user } });
  };
}
