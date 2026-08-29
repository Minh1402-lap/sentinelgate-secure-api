export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "DISABLED";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Omit<UserRecord, "passwordHash" | "lockedUntil">;

export interface UserStore {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: { email: string; passwordHash: string; name?: string }): Promise<UserRecord>;
  updateProfile(id: string, input: { name?: string | null }): Promise<UserRecord | null>;
  list(input: { skip: number; take: number }): Promise<{ users: UserRecord[]; total: number }>;
}
