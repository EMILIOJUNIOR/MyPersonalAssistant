import { randomUUID } from "node:crypto";

import { getDb } from "./db";
import { normalizeInstant, nowIso } from "./time";

export type AppointmentStatus = "confirmed" | "cancelled";

export interface Appointment {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentInput {
  title: string;
  start: string;
  end: string;
  location?: string | null;
  notes?: string | null;
}

export interface AppointmentUpdate extends Partial<AppointmentInput> {
  id: string;
  status?: AppointmentStatus;
}

const appointmentCache = new Map<string, Appointment>();

export function cachedAppointment(id: string): Appointment | null {
  return appointmentCache.get(id) ?? null;
}

function cleanOptional(value: string | null | undefined): string | null {
  const result = value?.trim();
  return result ? result : null;
}

function validateRange(start: string, end: string): { start: string; end: string } {
  const normalizedStart = normalizeInstant(start, "start");
  const normalizedEnd = normalizeInstant(end, "end");

  if (Date.parse(normalizedEnd) <= Date.parse(normalizedStart)) {
    throw new Error("O fim do compromisso precisa ser depois do início.");
  }

  return { start: normalizedStart, end: normalizedEnd };
}

function rowToAppointment(row: Record<string, unknown>): Appointment {
  const appointment: Appointment = {
    id: String(row.id),
    title: String(row.title),
    start: String(row.start_at),
    end: String(row.end_at),
    status: row.status as AppointmentStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };

  if (row.location !== null && row.location !== undefined) {
    appointment.location = String(row.location);
  }
  if (row.notes !== null && row.notes !== undefined) {
    appointment.notes = String(row.notes);
  }

  return appointment;
}

async function conflicts(
  tenantId: string,
  start: string,
  end: string,
  ignoreId?: string,
): Promise<Appointment[]> {
  const result = await getDb().execute({
    sql: `SELECT * FROM appointments
           WHERE tenant_id = ? AND status = 'confirmed'
            AND (? IS NULL OR id != ?)
            AND start_at < ?
            AND end_at > ?
          ORDER BY start_at ASC`,
    args: [tenantId, ignoreId ?? null, ignoreId ?? null, end, start],
  });

  return result.rows.map((row) => {
    const appointment = rowToAppointment(row as Record<string, unknown>);
    appointmentCache.set(appointment.id, appointment);
    return appointment;
  });
}

export async function listAppointments(options: {
  tenantId: string;
  from?: string;
  to?: string;
  search?: string;
  includeCancelled?: boolean;
  limit?: number;
}): Promise<Appointment[]> {
  const conditions: string[] = ["tenant_id = ?"];
  const args: (string | number)[] = [options.tenantId];

  if (!options.includeCancelled) conditions.push("status = 'confirmed'");
  if (options.from) {
    conditions.push("end_at > ?");
    args.push(normalizeInstant(options.from, "from"));
  }
  if (options.to) {
    conditions.push("start_at < ?");
    args.push(normalizeInstant(options.to, "to"));
  }
  if (options.search?.trim()) {
    conditions.push("(lower(title) LIKE lower(?) OR lower(location) LIKE lower(?) OR lower(notes) LIKE lower(?))");
    const needle = `%${options.search.trim()}%`;
    args.push(needle, needle, needle);
  }

  args.push(Math.min(Math.max(Math.trunc(options.limit ?? 50), 1), 200));
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await getDb().execute({
    sql: `SELECT * FROM appointments ${where}
          ORDER BY start_at ASC LIMIT ?`,
    args,
  });

  return result.rows.map((row) => rowToAppointment(row as Record<string, unknown>));
}

export async function getAppointment(tenantId: string, id: string): Promise<Appointment | null> {
  const result = await getDb().execute({
    sql: "SELECT * FROM appointments WHERE tenant_id = ? AND id = ?",
    args: [tenantId, id],
  });
  const row = result.rows[0];
  if (!row) return null;
  const appointment = rowToAppointment(row as Record<string, unknown>);
  appointmentCache.set(appointment.id, appointment);
  return appointment;
}

export async function createAppointment(
  tenantId: string,
  input: AppointmentInput,
  allowOverlap = false,
): Promise<Appointment> {
  const title = input.title.trim();
  if (!title) throw new Error("O título do compromisso não pode ficar vazio.");
  const range = validateRange(input.start, input.end);

  if (!allowOverlap) {
    const existing = await conflicts(tenantId, range.start, range.end);
    if (existing.length > 0) {
      throw new Error(
        `Conflito de horário com: ${existing.map((item) => `${item.title} (${item.start} → ${item.end})`).join("; ")}. Pergunte ao usuário se deseja manter assim.`,
      );
    }
  }

  const id = `appt_${randomUUID().slice(0, 8)}`;
  const at = nowIso();
  await getDb().execute({
    sql: `INSERT INTO appointments
          (id, tenant_id, title, start_at, end_at, location, notes, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
    args: [
      id,
      tenantId,
      title,
      range.start,
      range.end,
      cleanOptional(input.location),
      cleanOptional(input.notes),
      at,
      at,
    ],
  });

  const created = await getAppointment(tenantId, id);
  if (!created) throw new Error("Compromisso não encontrado após a criação.");
  await scheduleAppointmentReminders(tenantId, created.id, created.start);
  return created;
}

export async function updateAppointment(
  tenantId: string,
  input: AppointmentUpdate,
  allowOverlap = false,
): Promise<Appointment> {
  const current = await getAppointment(tenantId, input.id);
  if (!current) throw new Error(`Não encontrei o compromisso ${input.id}.`);

  const range = validateRange(input.start ?? current.start, input.end ?? current.end);
  const confirming = input.status === "confirmed" && current.status !== "confirmed";
  const timesChanged = input.start !== undefined || input.end !== undefined;

  if ((confirming || timesChanged) && !allowOverlap) {
    const existing = await conflicts(tenantId, range.start, range.end, input.id);
    if (existing.length > 0) {
      throw new Error(
        `Conflito de horário com: ${existing.map((item) => `${item.title} (${item.start} → ${item.end})`).join("; ")}. Pergunte ao usuário se deseja manter assim.`,
      );
    }
  }

  const next = {
    title: input.title === undefined ? current.title : input.title.trim(),
    location: input.location === undefined ? current.location ?? null : cleanOptional(input.location),
    notes: input.notes === undefined ? current.notes ?? null : cleanOptional(input.notes),
    status: input.status ?? current.status,
  };
  if (!next.title) throw new Error("O título do compromisso não pode ficar vazio.");

  await getDb().execute({
    sql: `UPDATE appointments
          SET title = ?, start_at = ?, end_at = ?, location = ?, notes = ?,
              status = ?, updated_at = ?
          WHERE tenant_id = ? AND id = ?`,
    args: [
      next.title,
      range.start,
      range.end,
      next.location,
      next.notes,
      next.status,
      nowIso(),
      tenantId,
      input.id,
    ],
  });

  if (next.status === "confirmed") {
    await scheduleAppointmentReminders(tenantId, input.id, range.start);
  } else {
    await clearAppointmentReminders(tenantId, input.id);
  }

  const updated = await getAppointment(tenantId, input.id);
  if (!updated) throw new Error("Compromisso não encontrado após a atualização.");
  return updated;
}

export async function cancelAppointment(tenantId: string, id: string, reason?: string): Promise<Appointment> {
  const current = await getAppointment(tenantId, id);
  if (!current) throw new Error(`Não encontrei o compromisso ${id}.`);
  if (current.status === "cancelled") throw new Error(`O compromisso ${id} já está cancelado.`);

  const notes = [current.notes, cleanOptional(reason) ? `Cancelado: ${cleanOptional(reason)}` : null]
    .filter(Boolean)
    .join(" | ") || null;

  await getDb().execute({
    sql: "UPDATE appointments SET status = 'cancelled', notes = ?, updated_at = ? WHERE tenant_id = ? AND id = ?",
    args: [notes, nowIso(), tenantId, id],
  });
  await clearAppointmentReminders(tenantId, id);

  const cancelled = await getAppointment(tenantId, id);
  if (!cancelled) throw new Error("Compromisso não encontrado após o cancelamento.");
  return cancelled;
}

export interface AppointmentReminder {
  id: string;
  appointment_id: string;
  title: string;
  start: string;
  kind: "24h" | "15m";
  remind_at: string;
  sent_at: string | null;
}

export async function scheduleAppointmentReminders(
  tenantId: string,
  appointmentId: string,
  start: string,
): Promise<void> {
  await clearAppointmentReminders(tenantId, appointmentId);

  const startMs = Date.parse(start);
  const nowMs = Date.now();

  const createdAt = nowIso();
  const reminders = [
    { kind: "24h" as const, offset: 24 * 60 * 60 * 1000 },
    { kind: "15m" as const, offset: 15 * 60 * 1000 },
  ];

  for (const reminder of reminders) {
    const remindAt = startMs - reminder.offset;
    if (remindAt <= nowMs) continue;

    await getDb().execute({
      sql: `INSERT INTO appointment_reminders
            (id, tenant_id, appointment_id, kind, remind_at, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      args: [
        randomUUID(),
        tenantId,
        appointmentId,
        reminder.kind,
        new Date(remindAt).toISOString(),
        createdAt,
      ],
    });
  }
}

async function clearAppointmentReminders(tenantId: string, appointmentId: string): Promise<void> {
  await getDb().execute({
    sql: "DELETE FROM appointment_reminders WHERE tenant_id = ? AND appointment_id = ?",
    args: [tenantId, appointmentId],
  });
}

export async function claimDueAppointmentReminders(
  tenantId: string,
  at = nowIso(),
  limit = 50,
): Promise<AppointmentReminder[]> {
  const result = await getDb().execute({
    sql: `SELECT r.id, r.appointment_id, r.kind, r.remind_at, r.sent_at,
                 a.title, a.start_at
          FROM appointment_reminders r
          JOIN appointments a ON a.id = r.appointment_id
           WHERE r.tenant_id = ?
             AND r.sent_at IS NULL
            AND r.remind_at <= ?
            AND a.status = 'confirmed'
          ORDER BY r.remind_at ASC
          LIMIT ?`,
    args: [tenantId, at, limit],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    appointment_id: String(row.appointment_id),
    title: String(row.title),
    start: String(row.start_at),
    kind: row.kind as "24h" | "15m",
    remind_at: String(row.remind_at),
    sent_at: row.sent_at === null ? null : String(row.sent_at),
  }));
}

export async function markAppointmentReminderSent(
  tenantId: string,
  id: string,
  at = nowIso(),
): Promise<void> {
  await getDb().execute({
    sql: "UPDATE appointment_reminders SET sent_at = ? WHERE tenant_id = ? AND id = ? AND sent_at IS NULL",
    args: [at, tenantId, id],
  });
}
