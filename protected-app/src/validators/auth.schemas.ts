import { z } from "zod";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const registrationPassword = z.string().min(12).max(128);
const loginPassword = z.string().min(1).max(128);

export const registerSchema = z.object({
  email,
  password: registrationPassword,
  name: z.string().trim().min(1).max(100).optional(),
}).strict();

export const loginSchema = z.object({ email, password: loginPassword }).strict();
