import { randomUUID } from "node:crypto";
import path from "node:path";

import { z } from "zod";

import { createMutex, readTextIfExists, writeTextAtomic } from "../fs-utils";
import {
  AgendaAlreadyCancelledError,
  AgendaConflictError,
  AgendaCorruptedError,
  AgendaInvalidRangeError,
  AgendaNotFoundError,
} from "./errors";
import type {
  AgendaRepository,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
  WriteOptions,
} from "./repository";
import {
  appointmentSchema,
  conflictsWith,
  sorted,
  timeOf,
  type Appointment,
} from "./types";

const storeSchema = z.object({
  version: z.literal(1),
  appointments: z.array(appointmentSchema),
});

type Store = z.infer<typeof storeSchema>;

export const AGENDA_FILE_NAME = "compromissos.json";

/** Local file used until a database driver replaces this one. */
export function defaultAgendaFile(): string {
  return process.env.LUMIA_DATA_FILE ?? path.resolve(process.cwd(), "data", AGENDA_FILE_NAME);
}

function emptyStore(): Store {
  return { version: 1, appointments: [] };
}

function newId(): string {
  return `appt_${randomUUID().slice(0, 8)}`;
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function assertRange(start: string, end: string): void {
  const startMs = timeOf(start);
  const endMs = timeOf(end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new AgendaInvalidRangeError(
      "Use datas ISO com fuso, por exemplo 2026-11-20T15:00:00-03:00.",
    );
  }
  if (endMs <= startMs) {
    throw new AgendaInvalidRangeError();
  }
}

function boundary(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new AgendaInvalidRangeError(
      `Não entendi ${label} "${value}"; use ISO 8601, por exemplo 2026-11-20T00:00:00-03:00.`,
    );
  }
  return ms;
}

export function createJsonAgendaRepository(file = defaultAgendaFile()): AgendaRepository {
  // One queue per repository instance, so two tool calls in one turn can't interleave writes.
  const enqueue = createMutex();

  async function load(): Promise<Store> {
    const raw = await readTextIfExists(file);
    if (raw === null) return emptyStore();

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AgendaCorruptedError(file);
    }

    const parsed = storeSchema.safeParse(json);
    if (!parsed.success) {
      // Never overwrite a file we can't understand: it may be the user's data.
      throw new AgendaCorruptedError(file);
    }
    return parsed.data;
  }

  async function save(store: Store): Promise<void> {
    await writeTextAtomic(file, `${JSON.stringify(store, null, 2)}\n`);
  }

  return {
    kind: "json",
    location: file,

    async list(query: ListAppointmentsQuery = {}) {
      const store = await load();
      const fromMs = boundary(query.from, -Infinity, "o início");
      const toMs = boundary(query.to, Infinity, "o fim");
      const needle = query.search?.trim().toLowerCase();
      const limit = query.limit ?? 50;

      return sorted(store.appointments)
        .filter((item) => query.includeCancelled || item.status === "confirmed")
        .filter((item) => timeOf(item.start) < toMs && timeOf(item.end) > fromMs)
        .filter((item) =>
          needle
            ? [item.title, item.location, item.notes]
                .filter(Boolean)
                .some((field) => field!.toLowerCase().includes(needle))
            : true,
        )
        .slice(0, limit);
    },

    async get(id: string) {
      const store = await load();
      return store.appointments.find((item) => item.id === id) ?? null;
    },

    async create(input: CreateAppointmentInput, options: WriteOptions = {}) {
      assertRange(input.start, input.end);

      return enqueue(async () => {
        const store = await load();
        if (!options.allowOverlap) {
          const conflicts = conflictsWith(input, store.appointments);
          if (conflicts.length > 0) throw new AgendaConflictError(conflicts);
        }

        const now = new Date().toISOString();
        const created: Appointment = {
          id: newId(),
          title: input.title.trim(),
          start: input.start,
          end: input.end,
          status: "confirmed",
          createdAt: now,
          updatedAt: now,
        };

        const location = normalizeOptional(input.location);
        if (location) created.location = location;
        const notes = normalizeOptional(input.notes);
        if (notes) created.notes = notes;

        store.appointments.push(created);
        await save(store);
        return created;
      });
    },

    async update(input: UpdateAppointmentInput, options: WriteOptions = {}) {
      return enqueue(async () => {
        const store = await load();
        const found = store.appointments.find((item) => item.id === input.id);
        if (!found) throw new AgendaNotFoundError(input.id);

        const nextStart = input.start ?? found.start;
        const nextEnd = input.end ?? found.end;
        assertRange(nextStart, nextEnd);

        const confirming = input.status === "confirmed" && found.status !== "confirmed";
        const timesChanged = input.start !== undefined || input.end !== undefined;
        if ((timesChanged || confirming) && !options.allowOverlap) {
          const conflicts = conflictsWith(
            { start: nextStart, end: nextEnd },
            store.appointments,
            input.id,
          );
          if (conflicts.length > 0) throw new AgendaConflictError(conflicts);
        }

        if (input.title !== undefined) found.title = input.title.trim();
        if (input.start !== undefined) found.start = input.start;
        if (input.end !== undefined) found.end = input.end;

        if (input.location !== undefined) {
          const location = normalizeOptional(input.location);
          if (location) found.location = location;
          else delete found.location;
        }
        if (input.notes !== undefined) {
          const notes = normalizeOptional(input.notes);
          if (notes) found.notes = notes;
          else delete found.notes;
        }
        if (input.status !== undefined) found.status = input.status;

        found.updatedAt = new Date().toISOString();
        await save(store);
        return { ...found };
      });
    },

    async cancel(id: string, reason?: string) {
      return enqueue(async () => {
        const store = await load();
        const found = store.appointments.find((item) => item.id === id);
        if (!found) throw new AgendaNotFoundError(id);
        if (found.status === "cancelled") throw new AgendaAlreadyCancelledError(id);

        found.status = "cancelled";
        const note = normalizeOptional(reason);
        if (note) {
          found.notes = [found.notes, `Cancelado: ${note}`].filter(Boolean).join(" | ");
        }
        found.updatedAt = new Date().toISOString();

        await save(store);
        return { ...found };
      });
    },
  };
}
