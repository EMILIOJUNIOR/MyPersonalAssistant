import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { projectExists } from "./projects";
import { localLabel, normalizeInstant, nowIso } from "./time";

export type TaskStatus = "open" | "done" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  project_id: string | null;
  entry_id: string | null;
}

export interface TaskView extends Task {
  due_local: string | null;
  overdue: boolean;
  project_name?: string | null;
}

export interface CreateTaskInput {
  title: string;
  notes?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
  project_id?: string | null;
}

export interface ListTasksFilters {
  status?: TaskStatus | "all";
  priority?: TaskPriority;
  project_id?: string;
  overdue_only?: boolean;
  limit?: number;
}

export interface UpdateTaskInput {
  title?: string;
  notes?: string | null;
  priority?: TaskPriority;
  due_at?: string | null;
  project_id?: string | null;
}

export function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    notes: row.notes === null ? null : String(row.notes),
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    due_at: row.due_at === null ? null : String(row.due_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    completed_at: row.completed_at === null ? null : String(row.completed_at),
    project_id: row.project_id === null ? null : String(row.project_id),
    entry_id: row.entry_id === null ? null : String(row.entry_id),
  };
}

export function toTaskView(row: Record<string, unknown>): TaskView {
  const task = rowToTask(row);
  const now = nowIso();

  return {
    ...task,
    due_local: task.due_at ? localLabel(task.due_at) : null,
    overdue:
      task.status === "open" &&
      task.due_at !== null &&
      task.due_at < now,
    project_name:
      "project_name" in row
        ? row.project_name === null
          ? null
          : String(row.project_name)
        : undefined,
  };
}

function clampLimit(limit: number | undefined, fallback = 20): number {
  if (limit === undefined) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

async function assertProject(projectId: string): Promise<void> {
  if (!(await projectExists(projectId))) {
    throw new Error("Projeto não encontrado.");
  }
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const title = input.title.trim();

  if (!title) {
    throw new Error("O título da tarefa não pode ficar vazio.");
  }

  if (input.project_id) {
    await assertProject(input.project_id);
  }

  const id = randomUUID();
  const at = nowIso();
  const dueAt = input.due_at
    ? normalizeInstant(input.due_at, "due_at")
    : null;

  await getDb().execute({
    sql: `INSERT INTO tasks
            (id, title, notes, status, priority, due_at, created_at, updated_at, completed_at, project_id)
          VALUES (?, ?, ?, 'open', ?, ?, ?, ?, NULL, ?)`,
    args: [
      id,
      title,
      input.notes?.trim() || null,
      input.priority ?? "normal",
      dueAt,
      at,
      at,
      input.project_id ?? null,
    ],
  });

  const task = await getTask(id);

  if (!task) {
    throw new Error("Tarefa não encontrada após a criação.");
  }

  return task;
}

export async function getTask(id: string): Promise<TaskView | null> {
  const result = await getDb().execute({
    sql: `SELECT t.*, p.name AS project_name
          FROM tasks t
          LEFT JOIN projects p ON p.id = t.project_id
          WHERE t.id = ?`,
    args: [id],
  });

  const row = result.rows[0];

  return row ? toTaskView(row as Record<string, unknown>) : null;
}

export async function listTasks(
  filters: ListTasksFilters = {},
): Promise<TaskView[]> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  const status = filters.status ?? "open";

  if (status !== "all") {
    conditions.push("t.status = ?");
    args.push(status);
  }

  if (filters.priority) {
    conditions.push("t.priority = ?");
    args.push(filters.priority);
  }

  if (filters.project_id) {
    conditions.push("t.project_id = ?");
    args.push(filters.project_id);
  }

  if (filters.overdue_only) {
    conditions.push("t.status = 'open' AND t.due_at IS NOT NULL AND t.due_at < ?");
    args.push(nowIso());
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  args.push(clampLimit(filters.limit));

  const result = await getDb().execute({
    sql: `SELECT t.*, p.name AS project_name
          FROM tasks t
          LEFT JOIN projects p ON p.id = t.project_id
          ${where}
          ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END,
                   t.due_at ASC,
                   t.created_at DESC
          LIMIT ?`,
    args,
  });

  return result.rows.map((row) => toTaskView(row as Record<string, unknown>));
}

export async function updateTask(
  id: string,
  patch: UpdateTaskInput,
): Promise<Task> {
  const sets: string[] = [];
  const args: (string | null)[] = [];

  if (patch.title !== undefined) {
    const title = patch.title.trim();

    if (!title) {
      throw new Error("O título da tarefa não pode ficar vazio.");
    }

    sets.push("title = ?");
    args.push(title);
  }

  if (patch.notes !== undefined) {
    sets.push("notes = ?");
    args.push(patch.notes?.trim() || null);
  }

  if (patch.priority !== undefined) {
    sets.push("priority = ?");
    args.push(patch.priority);
  }

  if (patch.due_at !== undefined) {
    sets.push("due_at = ?");
    args.push(
      patch.due_at ? normalizeInstant(patch.due_at, "due_at") : null,
    );
  }

  if (patch.project_id !== undefined) {
    if (patch.project_id) {
      await assertProject(patch.project_id);
    }

    sets.push("project_id = ?");
    args.push(patch.project_id);
  }

  if (sets.length === 0) {
    const current = await getTask(id);

    if (!current) {
      throw new Error("Tarefa não encontrada.");
    }

    return current;
  }

  sets.push("updated_at = ?");
  args.push(nowIso());
  args.push(id);

  const result = await getDb().execute({
    sql: `UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`,
    args,
  });

  if (result.rowsAffected === 0) {
    throw new Error("Tarefa não encontrada.");
  }

  const task = await getTask(id);

  if (!task) {
    throw new Error("Tarefa não encontrada.");
  }

  return task;
}

export async function completeTask(id: string): Promise<Task> {
  const current = await getTask(id);

  if (!current) {
    throw new Error("Tarefa não encontrada.");
  }

  if (current.status === "done") {
    return current;
  }

  if (current.status === "cancelled") {
    throw new Error("Tarefa cancelada não pode ser concluída.");
  }

  const at = nowIso();

  await getDb().execute({
    sql: `UPDATE tasks
          SET status = 'done', completed_at = ?, updated_at = ?
          WHERE id = ?`,
    args: [at, at, id],
  });

  const task = await getTask(id);

  if (!task) {
    throw new Error("Tarefa não encontrada.");
  }

  return task;
}

export async function deleteTask(
  id: string,
  mode: "cancel" | "delete" = "cancel",
): Promise<{ id: string; mode: "cancel" | "delete"; status: TaskStatus }> {
  const db = getDb();
  const current = await getTask(id);

  if (!current) {
    throw new Error("Tarefa não encontrada.");
  }

  if (mode === "delete") {
    await db.execute({
      sql: "DELETE FROM reminders WHERE task_id = ?",
      args: [id],
    });

    await db.execute({
      sql: "DELETE FROM tasks WHERE id = ?",
      args: [id],
    });

    return { id, mode, status: current.status };
  }

  if (current.status !== "cancelled") {
    await db.execute({
      sql: `UPDATE tasks
            SET status = 'cancelled', updated_at = ?
            WHERE id = ?`,
      args: [nowIso(), id],
    });
  }

  return { id, mode, status: "cancelled" };
}
