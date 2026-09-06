import type { UserRole } from "./user.js";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sub: string;
        role: UserRole;
      };
    }
  }
}

export {};
