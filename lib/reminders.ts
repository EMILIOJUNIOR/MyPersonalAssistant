import { getDb } from "./db";
import {
  localDateKey,
  localDayLabel,
  localDayRangeUtc,
  localLabel,
  normalizeInstant,
  nowIso,
} from "./time";
import {
  rowToTask,
  toTaskView,
  type TaskStatus,
  type TaskView,
} from "./tasks";

export interface Reminder {
  id: string;
  task_id: string;
  remind_at: string;
  sent_at: string | null;
  created_at: string;
  task_title: string;
  task_status: TaskStatus;
  remind_local: string;
}

export interface ListRemindersFilters {
  task_id?: string;
  pending_only?: boolean;
  from?: string;
  to?: string;
  limit?: number;
}

export interface AgendaTask extends TaskView {
  reminders: {
    id: string;
    remind_at: string;
    remind_local: string;
    sent_at: string | null;
  }[];
}

export interface AgendaDay {
  date: string;
  label: string;
  tasks: AgendaTask[];
}

function clampLimit(limit: number | undefined, fallback = 20): number {
  if (limit === undefined) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), 50);
}

function rowToReminder(row: Record<string, unknown>): Reminder {
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    remind_at: String(row.remind_at),
    sent_at: row.sent_at === null ? null : String(row.sent_at),
    created_at: String(row.created_at),
    task_title: String(row.task_title),
    task_status: row.task_status as TaskStatus,
    remind_local: localLabel(String(row.remind_at)),
  };
}

export async function setReminder(
  taskId: string,
  remindAt: string,
): Promise<Reminder> {
  const normalized = normalizeInstant(remindAt, "remind_at");

  if (new Date(normalized).getTime() <= Date.now()) {
    throw new Error("O lembrete precisa estar no futuro.");
  }

  const task = await getDb().execute({
    sql: "SELECT id, status FROM tasks WHERE id = ?",
    args: [taskId],
  });

  const row = task.rows[0];

  if (!row) {
    throw new Error("Tarefa não encontrada.");
  }

  if (row.status !== "open") {
    throw new Error("Só é possível criar lembrete para tarefa aberta.");
  }

  const id = crypto.randomUUID();
  const at = nowIso();

  await getDb().execute({
    sql: `INSERT INTO reminders (id, task_id, remind_at, sent_at, created_at)
          VALUES (?, ?, ?, NULL, ?)`,
    args: [id, taskId, normalized, at],
  });

  const result = await getDb().execute({
    sql: `SELECT r.*, t.title AS task_title, t.status AS task_status
          FROM reminders r
          JOIN tasks t ON t.id = r.task_id
          WHERE r.id = ?`,
    args: [id],
  });

  const created = result.rows[0];

  if (!created) {
    throw new Error("Lembrete não encontrado após a criação.");
  }

  return rowToReminder(created as Record<string, unknown>);
}

export async function listReminders(
  filters: ListRemindersFilters = {},
): Promise<Reminder[]> {
  const conditions: string[] = ["1 = 1"];
  const args: (string | number)[] = [];

  if (filters.task_id) {
    conditions.push("r.task_id = ?");
    args.push(filters.task_id);
  }

  if (filters.pending_only !== false) {
    conditions.push("r.sent_at IS NULL");
    conditions.push("t.status = 'open'");
  }

  if (filters.from) {
    conditions.push("r.remind_at >= ?");
    args.push(normalizeInstant(filters.from, "from"));
  }

  if (filters.to) {
    conditions.push("r.remind_at <= ?");
    args.push(normalizeInstant(filters.to, "to"));
  }

  args.push(clampLimit(filters.limit));

  const result = await getDb().execute({
    sql: `SELECT r.*, t.title AS task_title, t.status AS task_status
          FROM reminders r
          JOIN tasks t ON t.id = r.task_id
          WHERE ${conditions.join(" AND ")}
          ORDER BY r.remind_at ASC
          LIMIT ?`,
    args,
  });

  return result.rows.map((row) =>
    rowToReminder(row as Record<string, unknown>),
  );
}

export async function cancelReminder(id: string): Promise<void> {
  const db = getDb();
  const result = await db.execute({
    sql: "SELECT id, sent_at FROM reminders WHERE id = ?",
    args: [id],
  });

  const row = result.rows[0];

  if (!row) {
    throw new Error("Lembrete não encontrado.");
  }

  if (row.sent_at !== null) {
    throw new Error("Este lembrete já foi enviado e não pode ser cancelado.");
  }

  await db.execute({
    sql: "DELETE FROM reminders WHERE id = ?",
    args: [id],
  });
}

export async function claimDueReminders(
  at = nowIso(),
  limit = 50,
): Promise<Reminder[]> {
  const result = await getDb().execute({
    sql: `SELECT r.*, t.title AS task_title, t.status AS task_status
          FROM reminders r
          JOIN tasks t ON t.id = r.task_id
          WHERE r.sent_at IS NULL
            AND r.remind_at <= ?
            AND t.status = 'open'
          ORDER BY r.remind_at ASC
          LIMIT ?`,
    args: [at, clampLimit(limit)],
  });

  return result.rows.map((row) =>
    rowToReminder(row as Record<string, unknown>),
  );
}

export async function markReminderSent(
  id: string,
  at = nowIso(),
): Promise<void> {
  const result = await getDb().execute({
    sql: "UPDATE reminders SET sent_at = ? WHERE id = ? AND sent_at IS NULL",
    args: [at, id],
  });

  if (result.rowsAffected === 0) {
    throw new Error("Lembrete não encontrado ou já marcado como enviado.");
  }
}

export async function getAgenda(
  fromDateKey: string,
  toDateKey: string,
  includeDone = false,
): Promise<{
  from: string;
  to: string;
  start_utc: string;
  end_utc: string;
  days: AgendaDay[];
  count: number;
}> {
  const { start, endExclusive } = localDayRangeUtc(fromDateKey, toDateKey);
  const conditions = [
    "t.due_at IS NOT NULL",
    "t.due_at >= ?",
    "t.due_at < ?",
    "t.status != 'cancelled'",
  ];
  const args: string[] = [start, endExclusive];

  if (!includeDone) {
    conditions.push("t.status = 'open'");
  }

  const tasksResult = await getDb().execute({
    sql: `SELECT t.*, p.name AS project_name
          FROM tasks t
          LEFT JOIN projects p ON p.id = t.project_id
          WHERE ${conditions.join(" AND ")}
          ORDER BY t.due_at ASC
          LIMIT 100`,
    args,
  });

  const tasks = tasksResult.rows.map((row) =>
    toTaskView(row as Record<string, unknown>),
  );

  const remindersByTask = new Map<string, AgendaTask["reminders"]>();

  if (tasks.length > 0) {
    const placeholders = tasks.map(() => "?").join(", ");
    const remindersResult = await getDb().execute({
      sql: `SELECT id, task_id, remind_at, sent_at
            FROM reminders
            WHERE task_id IN (${placeholders}) AND sent_at IS NULL
            ORDER BY remind_at ASC`,
      args: tasks.map((task) => task.id),
    });

    for (const row of remindersResult.rows) {
      const taskId = String(row.task_id);
      const list = remindersByTask.get(taskId) ?? [];

      list.push({
        id: String(row.id),
        remind_at: String(row.remind_at),
        remind_local: localLabel(String(row.remind_at)),
        sent_at: row.sent_at === null ? null : String(row.sent_at),
      });
      remindersByTask.set(taskId, list);
    }
  }

  const days = new Map<string, AgendaDay>();

  for (const task of tasks) {
    if (!task.due_at) continue;

    const dateKey = localDateKey(task.due_at);
    const day = days.get(dateKey) ?? {
      date: dateKey,
      label: localDayLabel(dateKey),
      tasks: [],
    };

    day.tasks.push({
      ...task,
      reminders: remindersByTask.get(task.id) ?? [],
    });
    days.set(dateKey, day);
  }

  return {
    from: fromDateKey,
    to: toDateKey,
    start_utc: start,
    end_utc: endExclusive,
    days: [...days.values()],
    count: tasks.length,
  };
}
