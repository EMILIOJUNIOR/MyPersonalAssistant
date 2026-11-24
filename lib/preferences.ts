import { getDb } from "./db";
import { nowIso } from "./time";

const MAX_NAME_LENGTH = 80;

export async function getUserName(tenantId: string): Promise<string | null> {
  const result = await getDb().execute({
    sql: "SELECT user_name FROM tenant_preferences WHERE tenant_id = ?",
    args: [tenantId],
  });
  const value = result.rows[0]?.user_name;
  return typeof value === "string" && value.trim() ? value : null;
}

export async function setUserName(tenantId: string, value: string): Promise<string> {
  const name = value.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Diga um nome válido para eu usar.");
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error(`O nome deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`);
  }

  await getDb().execute({
    sql: `INSERT INTO tenant_preferences (tenant_id, user_name, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT (tenant_id) DO UPDATE SET user_name = excluded.user_name, updated_at = excluded.updated_at`,
    args: [tenantId, name, nowIso(), nowIso()],
  });

  return name;
}
