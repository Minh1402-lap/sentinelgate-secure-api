import type { Request } from "express";

import type { AuditContext } from "../types/audit.js";

export function requestAuditContext(request: Request): AuditContext {
  return {
    ipAddress: request.ip,
    userAgent: request.get("user-agent"),
  };
}
