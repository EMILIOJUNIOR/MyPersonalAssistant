import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL não configurada. Adicione ao .env.local.",
  );
}

const db = createClient({
  url,
  authToken: url.startsWith("file:")
    ? undefined
    : process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id         TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
`);

const migrationsDir = path.resolve("db/migrations");
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();

for (const file of files) {
  const alreadyApplied = await db.execute({
    sql: "SELECT 1 FROM _migrations WHERE id = ?",
    args: [file],
  });

  if (alreadyApplied.rows.length > 0) {
    console.log(`- ${file} (já aplicada)`);
    continue;
  }

  const sql = await readFile(path.join(migrationsDir, file), "utf8");
  const tx = await db.transaction("write");

  try {
    await tx.executeMultiple(sql);
    await tx.execute({
      sql: "INSERT INTO _migrations (id, applied_at) VALUES (?, ?)",
      args: [file, new Date().toISOString()],
    });
    await tx.commit();
    console.log(`+ ${file} aplicada`);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

const tables = await db.execute(
  "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
);
console.log("\nTabelas:", tables.rows.map((row) => row.name).join(", "));

for (const table of ["tasks", "reminders"]) {
  const columns = await db.execute(`PRAGMA table_info(${table})`);
  console.log(
    `${table}: ${columns.rows.map((row) => row.name).join(", ")}`,
  );
}