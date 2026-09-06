import type {
  AuditAction,
  AuditContext,
  AuditOutcome,
  AuditStore,
  AuditValue,
} from "../types/audit.js";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /password|token|authorization|secret|cookie/i;
const MAX_DETAIL_DEPTH = 5;
const MAX_DETAIL_ENTRIES = 50;
const MAX_STRING_LENGTH = 1_000;

function sanitizeValue(value: unknown, key: string, depth: number): AuditValue {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (depth >= MAX_DETAIL_DEPTH) return "[TRUNCATED]";

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_DETAIL_ENTRIES)
      .map((entry) => sanitizeValue(entry, "", depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_DETAIL_ENTRIES)
        .filter(([, entry]) => entry !== undefined)
        .map(([entryKey, entry]) => [entryKey, sanitizeValue(entry, entryKey, depth + 1)]),
    );
  }

  return String(value).slice(0, MAX_STRING_LENGTH);
}

function sanitizeDetails(details?: Record<string, unknown>): Record<string, AuditValue> | undefined {
  if (!details) return undefined;
  return sanitizeValue(details, "", 0) as Record<string, AuditValue>;
}

export class AuditService {
  constructor(private readonly store: AuditStore) {}

  async record(
    action: AuditAction,
    outcome: AuditOutcome,
    input: {
      actorId?: string;
      context?: AuditContext;
      details?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    await this.store.write({
      actorId: input.actorId,
      action,
      outcome,
      ipAddress: input.context?.ipAddress?.slice(0, 45),
      userAgent: input.context?.userAgent?.slice(0, 512),
      details: sanitizeDetails(input.details),
    });
  }
}
