import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { projectExists } from "./projects";
import { nowIso } from "./time";

export type EntryKind = "idea" | "note" | "decision" | "summary" | "reference";
export type EntryStatus = "active" | "archived";

export interface Entry {
  id: string;
  kind: EntryKind;
  title: string;
  content: string;
  tags: string[];
  project_id: string | null;
  status: EntryStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EntryWithProject extends Entry {
  project_name: string | null;
}

export interface EntryLinkView {
  id: string;
  relation: string;
  direction: "in" | "out";
  created_at: string;
  other_id: string;
  other_kind: EntryKind;
  other_title: string;
}

export interface CreateEntryInput {
  kind: EntryKind;
  title: string;
  content: string;
  tags?: string[];
  project_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SearchEntriesFilters {
  query?: string;
  kind?: EntryKind;
  project_id?: string;
  tag?: string;
  include_archived?: boolean;
  limit?: number;
}

export interface SearchEntryResult {
  id: string;
  kind: EntryKind;
  title: string;
  snippet: string;
  tags: string[];
  project_id: string | null;
  project_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateEntryInput {
  title?: string;
  content?: string;
  tags?: string[];
  project_id?: string | null;
  status?: EntryStatus;
}

export interface DecisionOption {
  label: string;
  pros: string[];
  cons: string[];
}

export interface RecordDecisionInput {
  title: string;
  context: string;
  options: DecisionOption[];
  decision: string;
  rationale?: string;
  project_id?: string | null;
  tags?: string[];
}

function parseTags(value: unknown): string[] {
  if (typeof value !== "string") return [];

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value) return null;

  try {
    const parsed: unknown = JSON.parse(value);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function serializeTags(tags: string[] | undefined): string {
  const unique = [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  return JSON.stringify(unique);
}

function rowToEntry(row: Record<string, unknown>): Entry {
  return {
    id: String(row.id),
    kind: row.kind as EntryKind,
    title: String(row.title),
    content: String(row.content),
    tags: parseTags(row.tags),
    project_id: row.project_id === null ? null : String(row.project_id),
    status: row.status as EntryStatus,
    metadata: parseMetadata(row.metadata),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function clampLimit(limit: number | undefined, fallback = 10): number {
  if (limit === undefined) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), 20);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

async function assertProject(projectId: string): Promise<void> {
  if (!(await projectExists(projectId))) {
    throw new Error("Projeto não encontrado. Crie o projeto antes de vincular.");
  }
}

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  const title = input.title.trim();
  const content = input.content.trim();

  if (!title) {
    throw new Error("O título da entrada não pode ficar vazio.");
  }

  if (!content) {
    throw new Error("O conteúdo da entrada não pode ficar vazio.");
  }

  if (input.project_id) {
    await assertProject(input.project_id);
  }

  const id = randomUUID();
  const at = nowIso();

  await getDb().execute({
    sql: `INSERT INTO entries
            (id, kind, title, content, tags, project_id, status, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    args: [
      id,
      input.kind,
      title,
      content,
      serializeTags(input.tags),
      input.project_id ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      at,
      at,
    ],
  });

  const entry = await getEntry(id);

  if (!entry) {
    throw new Error("Entrada não encontrada após a criação.");
  }

  return entry;
}

export async function getEntry(id: string): Promise<Entry | null> {
  const result = await getDb().execute({
    sql: "SELECT * FROM entries WHERE id = ?",
    args: [id],
  });

  const row = result.rows[0];

  return row ? rowToEntry(row as Record<string, unknown>) : null;
}

export async function getEntryWithLinks(
  id: string,
): Promise<{ entry: EntryWithProject; links: EntryLinkView[] } | null> {
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT e.*, p.name AS project_name
          FROM entries e
          LEFT JOIN projects p ON p.id = e.project_id
          WHERE e.id = ?`,
    args: [id],
  });

  const row = result.rows[0];

  if (!row) return null;

  const entry: EntryWithProject = {
    ...rowToEntry(row as Record<string, unknown>),
    project_name: row.project_name === null ? null : String(row.project_name),
  };

  const linksResult = await db.execute({
    sql: `SELECT l.id, l.relation, l.created_at,
            CASE WHEN l.from_entry_id = ? THEN 'out' ELSE 'in' END AS direction,
            e.id AS other_id, e.kind AS other_kind, e.title AS other_title
          FROM entry_links l
          JOIN entries e
            ON e.id = CASE
              WHEN l.from_entry_id = ? THEN l.to_entry_id
              ELSE l.from_entry_id
            END
          WHERE l.from_entry_id = ? OR l.to_entry_id = ?
          ORDER BY l.created_at DESC`,
    args: [id, id, id, id],
  });

  const links = linksResult.rows.map((link) => ({
    id: String(link.id),
    relation: String(link.relation),
    direction: link.direction as "in" | "out",
    created_at: String(link.created_at),
    other_id: String(link.other_id),
    other_kind: link.other_kind as EntryKind,
    other_title: String(link.other_title),
  }));

  return { entry, links };
}

export async function searchEntries(
  filters: SearchEntriesFilters = {},
): Promise<SearchEntryResult[]> {
  const conditions: string[] = ["1 = 1"];
  const args: (string | number)[] = [];

  if (!filters.include_archived) {
    conditions.push("e.status = 'active'");
  }

  if (filters.kind) {
    conditions.push("e.kind = ?");
    args.push(filters.kind);
  }

  if (filters.project_id) {
    conditions.push("e.project_id = ?");
    args.push(filters.project_id);
  }

  if (filters.query) {
    const like = `%${escapeLike(filters.query.trim())}%`;
    conditions.push(
      "(e.title LIKE ? ESCAPE '\\' OR e.content LIKE ? ESCAPE '\\' OR e.tags LIKE ? ESCAPE '\\')",
    );
    args.push(like, like, like);
  }

  if (filters.tag) {
    conditions.push("e.tags LIKE ? ESCAPE '\\'");
    args.push(`%"${escapeLike(filters.tag.trim())}"%`);
  }

  args.push(clampLimit(filters.limit));

  const result = await getDb().execute({
    sql: `SELECT e.id, e.kind, e.title,
            SUBSTR(e.content, 1, 200) AS snippet,
            e.tags, e.project_id, e.created_at, e.updated_at,
            p.name AS project_name
          FROM entries e
          LEFT JOIN projects p ON p.id = e.project_id
          WHERE ${conditions.join(" AND ")}
          ORDER BY e.created_at DESC
          LIMIT ?`,
    args,
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    kind: row.kind as EntryKind,
    title: String(row.title),
    snippet: String(row.snippet),
    tags: parseTags(row.tags),
    project_id: row.project_id === null ? null : String(row.project_id),
    project_name: row.project_name === null ? null : String(row.project_name),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function updateEntry(
  id: string,
  patch: UpdateEntryInput,
): Promise<Entry> {
  const sets: string[] = [];
  const args: (string | null)[] = [];

  if (patch.title !== undefined) {
    const title = patch.title.trim();

    if (!title) {
      throw new Error("O título da entrada não pode ficar vazio.");
    }

    sets.push("title = ?");
    args.push(title);
  }

  if (patch.content !== undefined) {
    const content = patch.content.trim();

    if (!content) {
      throw new Error("O conteúdo da entrada não pode ficar vazio.");
    }

    sets.push("content = ?");
    args.push(content);
  }

  if (patch.tags !== undefined) {
    sets.push("tags = ?");
    args.push(serializeTags(patch.tags));
  }

  if (patch.project_id !== undefined) {
    if (patch.project_id) {
      await assertProject(patch.project_id);
    }

    sets.push("project_id = ?");
    args.push(patch.project_id);
  }

  if (patch.status !== undefined) {
    sets.push("status = ?");
    args.push(patch.status);
  }

  if (sets.length === 0) {
    const current = await getEntry(id);

    if (!current) {
      throw new Error("Entrada não encontrada.");
    }

    return current;
  }

  sets.push("updated_at = ?");
  args.push(nowIso());
  args.push(id);

  const result = await getDb().execute({
    sql: `UPDATE entries SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  if (result.rowsAffected === 0) {
    throw new Error("Entrada não encontrada.");
  }

  const entry = await getEntry(id);

  if (!entry) {
    throw new Error("Entrada não encontrada.");
  }

  return entry;
}

export async function linkEntries(
  fromEntryId: string,
  toEntryId: string,
  relation = "related",
): Promise<EntryLinkView & { from_entry_id: string; to_entry_id: string }> {
  if (fromEntryId === toEntryId) {
    throw new Error("Uma entrada não pode ser vinculada a ela mesma.");
  }

  const normalizedRelation = relation.trim().slice(0, 40) || "related";
  const db = getDb();
  const existing = await db.execute({
    sql: "SELECT id FROM entries WHERE id IN (?, ?)",
    args: [fromEntryId, toEntryId],
  });

  if (existing.rows.length !== 2) {
    throw new Error("Uma ou ambas as entradas não foram encontradas.");
  }

  const id = randomUUID();
  const at = nowIso();

  try {
    await db.execute({
      sql: `INSERT INTO entry_links
              (id, from_entry_id, to_entry_id, relation, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [id, fromEntryId, toEntryId, normalizedRelation, at],
    });
  } catch (error) {
    const duplicate = await db.execute({
      sql: `SELECT id, relation, created_at FROM entry_links
            WHERE from_entry_id = ? AND to_entry_id = ? AND relation = ?`,
      args: [fromEntryId, toEntryId, normalizedRelation],
    });

    const row = duplicate.rows[0];

    if (!row) throw error;

    return {
      id: String(row.id),
      relation: String(row.relation),
      direction: "out",
      created_at: String(row.created_at),
      other_id: toEntryId,
      other_kind: "note",
      other_title: "",
      from_entry_id: fromEntryId,
      to_entry_id: toEntryId,
    };
  }

  const target = await getEntry(toEntryId);

  return {
    id,
    relation: normalizedRelation,
    direction: "out",
    created_at: at,
    other_id: toEntryId,
    other_kind: target?.kind ?? "note",
    other_title: target?.title ?? "",
    from_entry_id: fromEntryId,
    to_entry_id: toEntryId,
  };
}

export async function recordDecision(
  input: RecordDecisionInput,
): Promise<{ entry: Entry; metadata: Record<string, unknown> }> {
  const content = [
    `**Contexto:** ${input.context.trim()}`,
    `**Decisão:** ${input.decision.trim()}`,
    input.rationale ? `**Justificativa:** ${input.rationale.trim()}` : null,
    "",
    "## Opções consideradas",
    ...input.options.map((option) =>
      [
        `### ${option.label.trim()}`,
        `**Prós:** ${option.pros.join("; ") || "—"}`,
        `**Contras:** ${option.cons.join("; ") || "—"}`,
      ].join("\n"),
    ),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const metadata = {
    options: input.options,
    decision: input.decision.trim(),
    rationale: input.rationale?.trim() ?? null,
  };

  const entry = await createEntry({
    kind: "decision",
    title: input.title,
    content,
    tags: input.tags,
    project_id: input.project_id,
    metadata,
  });

  return { entry, metadata };
}

export async function deleteEntry(id: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: "DELETE FROM entry_links WHERE from_entry_id = ? OR to_entry_id = ?",
    args: [id, id],
  });

  const result = await db.execute({
    sql: "DELETE FROM entries WHERE id = ?",
    args: [id],
  });

  if (result.rowsAffected === 0) {
    throw new Error("Entrada não encontrada.");
  }
}
