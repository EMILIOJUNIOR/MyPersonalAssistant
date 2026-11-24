import { randomUUID } from "node:crypto";

import { getDb } from "../../lib/db";
import { nowIso } from "../../lib/time";

const MAX_ENTRY_CHARS = 2_000;
const MEMORY_TAG = '"preference"';

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export async function readMemory(): Promise<string | null> {
  const result = await getDb().execute({
    sql: `SELECT content FROM entries
          WHERE kind = 'note' AND status = 'active' AND tags LIKE ?
          ORDER BY created_at ASC`,
    args: [`%${MEMORY_TAG}%`],
  });

  if (result.rows.length === 0) return null;
  return result.rows.map((row) => `- ${String(row.content)}`).join("\n");
}

export interface RememberResult {
  added: boolean;
  total: number;
}

export async function remember(text: string): Promise<RememberResult> {
  const entry = normalize(text);
  if (entry.length < 3) {
    throw new Error("A nota está vazia ou curta demais para ser lembrada.");
  }
  if (entry.length > MAX_ENTRY_CHARS) {
    throw new Error(
      `A nota tem ${entry.length} caracteres; o limite é ${MAX_ENTRY_CHARS}. Resuma em uma frase.`,
    );
  }

  const existing = await getDb().execute({
    sql: `SELECT id FROM entries
          WHERE kind = 'note' AND status = 'active' AND tags LIKE ? AND lower(content) = lower(?)`,
    args: [`%${MEMORY_TAG}%`, entry],
  });

  if (existing.rows.length > 0) {
    const count = await countMemory();
    return { added: false, total: count };
  }

  const at = nowIso();
  await getDb().execute({
    sql: `INSERT INTO entries
          (id, kind, title, content, tags, status, metadata, created_at, updated_at)
          VALUES (?, 'note', 'Preferência', ?, ?, 'active', NULL, ?, ?)`,
    args: [randomUUID(), entry, `["preference"]`, at, at],
  });

  return { added: true, total: await countMemory() };
}

export interface ForgetResult {
  removed: number;
  total: number;
}

export async function forget(text: string): Promise<ForgetResult> {
  const needle = normalize(text);
  if (needle.length < 3) {
    throw new Error("Diga um trecho da nota que devo esquecer.");
  }

  const result = await getDb().execute({
    sql: `UPDATE entries
          SET status = 'archived', updated_at = ?
          WHERE kind = 'note' AND status = 'active' AND tags LIKE ? AND lower(content) LIKE lower(?)`,
    args: [nowIso(), `%${MEMORY_TAG}%`, `%${needle}%`],
  });

  if (result.rowsAffected === 0) {
    throw new Error(`Não encontrei nenhuma nota com "${text}".`);
  }

  return { removed: result.rowsAffected, total: await countMemory() };
}

async function countMemory(): Promise<number> {
  const result = await getDb().execute({
    sql: `SELECT COUNT(*) AS count FROM entries
          WHERE kind = 'note' AND status = 'active' AND tags LIKE ?`,
    args: [`%${MEMORY_TAG}%`],
  });
  return Number(result.rows[0]?.count ?? 0);
}
