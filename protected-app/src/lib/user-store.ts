import { prisma } from "./prisma.js";
import type { UserRecord, UserStore } from "../types/user.js";

function asUserRecord(user: Awaited<ReturnType<typeof prisma.user.findUnique>>): UserRecord | null {
  return user as UserRecord | null;
}

export const prismaUserStore: UserStore = {
  async findByEmail(email) {
    return asUserRecord(await prisma.user.findUnique({ where: { email } }));
  },
  async findById(id) {
    return asUserRecord(await prisma.user.findUnique({ where: { id } }));
  },
  async create(input) {
    return (await prisma.user.create({ data: input })) as UserRecord;
  },
  async updateProfile(id, input) {
    const result = await prisma.user.updateMany({ where: { id }, data: input });
    if (result.count === 0) return null;
    return asUserRecord(await prisma.user.findUnique({ where: { id } }));
  },
  async list({ skip, take }) {
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
      prisma.user.count(),
    ]);
    return { users: users as UserRecord[], total };
  },
};
