import type { Appointment } from "./types";

/**
 * Storage port for the agenda.
 *
 * Tools only know this interface, never the file or the database. The JSON driver
 * (`json-repository.ts`) implements it today; a SQL driver would implement the same methods,
 * moving the conflict check into a transaction. Methods throw the typed errors from
 * `errors.ts`, so callers keep the same messages after the swap.
 */

export interface ListAppointmentsQuery {
  /** ISO start of the window. Omit for no lower bound. */
  from?: string;
  /** ISO end of the window. Omit for no upper bound. */
  to?: string;
  /** Case-insensitive text matched against title, location and notes. */
  search?: string;
  includeCancelled?: boolean;
  limit?: number;
}

export interface CreateAppointmentInput {
  title: string;
  start: string;
  end: string;
  /** null clears the field (also used by update to remove a value). */
  location?: string | null;
  notes?: string | null;
}

export interface UpdateAppointmentInput {
  id: string;
  title?: string;
  start?: string;
  end?: string;
  location?: string | null;
  notes?: string | null;
  status?: "confirmed" | "cancelled";
}

export interface WriteOptions {
  /** Skip the overlap check. Only set it with explicit user authorization. */
  allowOverlap?: boolean;
}

export interface AgendaRepository {
  /** Driver name, such as "json" or "postgres". */
  readonly kind: string;
  /** Human-readable place the data lives, shown in tool output for debugging. */
  readonly location: string;

  list(query?: ListAppointmentsQuery): Promise<Appointment[]>;
  get(id: string): Promise<Appointment | null>;
  create(input: CreateAppointmentInput, options?: WriteOptions): Promise<Appointment>;
  update(input: UpdateAppointmentInput, options?: WriteOptions): Promise<Appointment>;
  /** Reversible: the entry stays stored with status "cancelled". */
  cancel(id: string, reason?: string): Promise<Appointment>;
}
