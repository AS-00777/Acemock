import { app } from "./app";
import { env } from "./config/env";
import { pool } from "./config/db";

const server = app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
