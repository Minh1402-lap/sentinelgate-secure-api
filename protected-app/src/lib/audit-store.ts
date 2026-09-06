import { Prisma } from "../../generated/prisma/client.js";

import { prisma } from "./prisma.js";
import type { AuditStore } from "../types/audit.js";

export const prismaAuditStore: AuditStore = {
  async write(input) {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        outcome: input.outcome,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        ...(input.details
          ? { details: input.details as Prisma.InputJsonValue }
          : {}),
      },
    });
  },
};
