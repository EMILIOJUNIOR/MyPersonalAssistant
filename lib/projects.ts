import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { nowIso } from "./time";

export type ProjectStatus = "active" | "paused" | "done" | "archived";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithCounts extends Project {
  open_tasks: number;
  active_entries: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
}

export interface ListProjectsFilters {
  status?: ProjectStatus;
  limit?: number;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description === null ? null : String(row.description),
    status: row.status as ProjectStatus,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function clampLimit(limit: number | undefined, fallback = 20): number {
  if (limit === undefined) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

export async function projectExists(tenantId: string, id: string): Promise<boolean> {
  const result = await getDb().execute({
    sql: "SELECT 1 FROM projects WHERE tenant_id = ? AND id = ?",
    args: [tenantId, id],
  });

  return result.rows.length > 0;
}

export async function createProject(
  tenantId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const name = input.name.trim();

  if (!name) {
    throw new Error("O nome do projeto não pode ficar vazio.");
  }

  const id = randomUUID();
  const at = nowIso();

  await getDb().execute({
    sql: `INSERT INTO projects
            (id, tenant_id, name, description, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      tenantId,
      name,
      input.description?.trim() || null,
      input.status ?? "active",
      at,
      at,
    ],
  });

  const project = await getProject(tenantId, id);

  if (!project) {
    throw new Error("Projeto não encontrado após a criação.");
  }

  return project;
}

export async function getProject(tenantId: string, id: string): Promise<Project | null> {
  const result = await getDb().execute({
    sql: "SELECT * FROM projects WHERE tenant_id = ? AND id = ?",
    args: [tenantId, id],
  });

  const row = result.rows[0];

  return row ? rowToProject(row as Record<string, unknown>) : null;
}

export async function listProjects(
  tenantId: string,
  filters: ListProjectsFilters = {},
): Promise<ProjectWithCounts[]> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  if (filters.status) {
    conditions.push("p.tenant_id = ? AND p.status = ?");
    args.push(tenantId);
    args.push(filters.status);
  } else {
    conditions.push("p.tenant_id = ?");
    args.push(tenantId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  args.push(clampLimit(filters.limit));

  const result = await getDb().execute({
    sql: `SELECT p.*,
            (SELECT COUNT(*) FROM tasks t
              WHERE t.project_id = p.id AND t.status = 'open') AS open_tasks,
            (SELECT COUNT(*) FROM entries e
              WHERE e.project_id = p.id AND e.status = 'active') AS active_entries
          FROM projects p
          ${where}
          ORDER BY p.updated_at DESC
          LIMIT ?`,
    args,
  });

  return result.rows.map((row) => ({
    ...rowToProject(row as Record<string, unknown>),
    open_tasks: Number(row.open_tasks),
    active_entries: Number(row.active_entries),
  }));
}

export async function updateProject(
  tenantId: string,
  id: string,
  patch: UpdateProjectInput,
): Promise<Project> {
  const sets: string[] = [];
  const args: (string | null)[] = [];

  if (patch.name !== undefined) {
    const name = patch.name.trim();

    if (!name) {
      throw new Error("O nome do projeto não pode ficar vazio.");
    }

    sets.push("name = ?");
    args.push(name);
  }

  if (patch.description !== undefined) {
    sets.push("description = ?");
    args.push(patch.description?.trim() || null);
  }

  if (patch.status !== undefined) {
    sets.push("status = ?");
    args.push(patch.status);
  }

  if (sets.length === 0) {
    const current = await getProject(tenantId, id);

    if (!current) {
      throw new Error("Projeto não encontrado.");
    }

    return current;
  }

  sets.push("updated_at = ?");
  args.push(nowIso());
  args.push(id);

  const result = await getDb().execute({
    sql: `UPDATE projects SET ${sets.join(", ")} WHERE tenant_id = ? AND id = ?`,
    args: [...args.slice(0, -1), tenantId, id],
  });

  if (result.rowsAffected === 0) {
    throw new Error("Projeto não encontrado.");
  }

  const project = await getProject(tenantId, id);

  if (!project) {
    throw new Error("Projeto não encontrado.");
  }

  return project;
}

export async function deleteProject(tenantId: string, id: string): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: "UPDATE tasks SET project_id = NULL WHERE tenant_id = ? AND project_id = ?",
    args: [tenantId, id],
  });
  await db.execute({
    sql: "UPDATE entries SET project_id = NULL WHERE tenant_id = ? AND project_id = ?",
    args: [tenantId, id],
  });

  const result = await db.execute({
    sql: "DELETE FROM projects WHERE tenant_id = ? AND id = ?",
    args: [tenantId, id],
  });

  if (result.rowsAffected === 0) {
    throw new Error("Projeto não encontrado.");
  }
}
