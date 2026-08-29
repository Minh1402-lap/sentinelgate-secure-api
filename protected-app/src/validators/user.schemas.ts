import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.union([z.string().trim().min(1).max(100), z.null()]).optional(),
}).strict().refine((value) => value.name !== undefined, { message: "At least one profile field is required" });

export const userIdSchema = z.object({ id: z.string().uuid() });

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
