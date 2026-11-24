import { randomUUID } from "node:crypto";

import { getDb } from "./db";
import { normalizeInstant, parseInstant, nowIso } from "./time";

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

function overlaps(
  start: string,
  end: string,
  otherStart: string,
  otherEnd: string,
): boolean {
  return Date.parse(start) < Date.parse(otherEnd) &&
    Date.parse(otherStart) < Date.parse(end);
}

async function conflicts(
  start: string,
  end: string,
  ignoreId?: string,
): Promise<Appointment[]> {
  const result = await getDb().execute({
    sql: `SELECT * FROM appointments
          WHERE status = 'confirmed'
            AND (? IS NULL OR id != ?)
            AND start_at < ?
            AND end_at > ?
          ORDER BY start_at ASC`,
    args: [ignoreId ?? null, ignoreId ?? null, end, start],
  });

  return result.rows.map((row) => {
    const appointment = rowToAppointment(row as Record<string, unknown>);
    appointmentCache.set(appointment.id, appointment);
    return appointment;
  });
}

export async function listAppointments(options: {
  from?: string;
  to?: string;
  search?: string;
  includeCancelled?: boolean;
  limit?: number;
} = {}): Promise<Appointment[]> {
  const conditions: string[] = [];
  const args: (string | number)[] = [];

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

export async function getAppointment(id: string): Promise<Appointment | null> {
  const result = await getDb().execute({
    sql: "SELECT * FROM appointments WHERE id = ?",
    args: [id],
  });
  const row = result.rows[0];
  if (!row) return null;
  const appointment = rowToAppointment(row as Record<string, unknown>);
  appointmentCache.set(appointment.id, appointment);
  return appointment;
}

export async function createAppointment(
  input: AppointmentInput,
  allowOverlap = false,
): Promise<Appointment> {
  const title = input.title.trim();
  if (!title) throw new Error("O título do compromisso não pode ficar vazio.");
  const range = validateRange(input.start, input.end);

  if (!allowOverlap) {
    const existing = await conflicts(range.start, range.end);
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
          (id, title, start_at, end_at, location, notes, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
    args: [
      id,
      title,
      range.start,
      range.end,
      cleanOptional(input.location),
      cleanOptional(input.notes),
      at,
      at,
    ],
  });

  const created = await getAppointment(id);
  if (!created) throw new Error("Compromisso não encontrado após a criação.");
  return created;
}

export async function updateAppointment(
  input: AppointmentUpdate,
  allowOverlap = false,
): Promise<Appointment> {
  const current = await getAppointment(input.id);
  if (!current) throw new Error(`Não encontrei o compromisso ${input.id}.`);

  const range = validateRange(input.start ?? current.start, input.end ?? current.end);
  const confirming = input.status === "confirmed" && current.status !== "confirmed";
  const timesChanged = input.start !== undefined || input.end !== undefined;

  if ((confirming || timesChanged) && !allowOverlap) {
    const existing = await conflicts(range.start, range.end, input.id);
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
          WHERE id = ?`,
    args: [
      next.title,
      range.start,
      range.end,
      next.location,
      next.notes,
      next.status,
      nowIso(),
      input.id,
    ],
  });

  const updated = await getAppointment(input.id);
  if (!updated) throw new Error("Compromisso não encontrado após a atualização.");
  return updated;
}

export async function cancelAppointment(id: string, reason?: string): Promise<Appointment> {
  const current = await getAppointment(id);
  if (!current) throw new Error(`Não encontrei o compromisso ${id}.`);
  if (current.status === "cancelled") throw new Error(`O compromisso ${id} já está cancelado.`);

  const notes = [current.notes, cleanOptional(reason) ? `Cancelado: ${cleanOptional(reason)}` : null]
    .filter(Boolean)
    .join(" | ") || null;

  await getDb().execute({
    sql: "UPDATE appointments SET status = 'cancelled', notes = ?, updated_at = ? WHERE id = ?",
    args: [notes, nowIso(), id],
  });

  const cancelled = await getAppointment(id);
  if (!cancelled) throw new Error("Compromisso não encontrado após o cancelamento.");
  return cancelled;
}
