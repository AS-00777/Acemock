import mysql from "mysql2/promise";
import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { env } from "./env";

function parseDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must start with mysql://");

  const host = url.hostname;
  const port = url.port ? Number(url.port) : 3306;
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);
  const database = url.pathname.replace(/^\//, "");

  if (!host || !user || !database) throw new Error("Invalid DATABASE_URL");
  return { host, port, user, password, database };
}

const cfg = parseDatabaseUrl(env.DATABASE_URL);

export const pool: Pool = mysql.createPool({
  host: cfg.host,
  port: cfg.port,
  user: cfg.user,
  password: cfg.password,
  database: cfg.database,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
});

export async function exec(sql: string, params: any[] = []): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

export async function query<T extends RowDataPacket[]>(sql: string, params: any[] = []): Promise<T> {
  const [rows] = await pool.execute<T>(sql, params);
  return rows;
}
