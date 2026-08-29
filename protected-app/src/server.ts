import { createServer } from "node:http";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { prismaUserStore } from "./lib/user-store.js";

const app = createApp({
  database: prisma,
  userStore: prismaUserStore,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
});
const server = createServer(app);
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down`);

  server.close(async (serverError) => {
    try {
      await prisma.$disconnect();
    } catch (databaseError) {
      console.error("Database disconnect failed", databaseError instanceof Error ? databaseError.message : "Unknown error");
      process.exitCode = 1;
    }

    if (serverError) {
      console.error("HTTP server shutdown failed", serverError.message);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason instanceof Error ? reason.message : "Unknown reason");
  void shutdown("unhandledRejection");
});

try {
  await prisma.$connect();
  server.listen(env.PORT, env.HOST, () => {
    console.log(`SentinelGate backend listening on ${env.HOST}:${env.PORT}`);
  });
} catch (error) {
  console.error("Application startup failed", error instanceof Error ? error.message : "Unknown error");
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
}
