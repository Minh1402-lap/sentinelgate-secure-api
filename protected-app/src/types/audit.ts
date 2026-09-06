export type AuditAction =
  | "LOGIN_SUCCEEDED"
  | "LOGIN_FAILED"
  | "ACCOUNT_LOCKED"
  | "PROFILE_UPDATED"
  | "ADMIN_USERS_LISTED"
  | "ADMIN_USER_VIEWED";

export type AuditOutcome = "SUCCESS" | "FAILURE" | "DENIED";

export type AuditValue =
  | string
  | number
  | boolean
  | null
  | AuditValue[]
  | { [key: string]: AuditValue };

export interface AuditContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditWriteInput {
  actorId?: string;
  action: AuditAction;
  outcome: AuditOutcome;
  ipAddress?: string;
  userAgent?: string;
  details?: { [key: string]: AuditValue };
}

export interface AuditStore {
  write(input: AuditWriteInput): Promise<void>;
}
